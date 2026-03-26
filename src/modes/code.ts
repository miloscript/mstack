import * as fs from "node:fs";
import type { MstackConfig, PhaseConfig } from "../types.js";
import { getEnabledPhases } from "../config.js";
import {
  assemblePrompt,
  loadSkill,
  resolveInputs,
  resolvePromptPath,
  loadKnowledge,
} from "../utils/prompt-assembler.js";
import { writePhaseOutput, writeErrorOutput } from "../utils/output-writer.js";
import {
  updateWorkflowStatus,
  updateWorkflowFinalStatus,
  recordUserInput,
  getCompletedPhases,
} from "../utils/workflow-manager.js";
import { humanCheckpoint } from "../utils/human-checkpoint.js";
import { runInteractivePhase } from "./interactive.js";

export function isHumanAttended(phaseConfig: PhaseConfig): boolean {
  return (
    (phaseConfig.pre || []).includes("human") ||
    (phaseConfig.post || []).includes("human")
  );
}

export async function runCodeMode(
  config: MstackConfig,
  userTask: string,
  workflowDir: string,
): Promise<void> {
  const universal = fs.readFileSync(
    resolvePromptPath("universal", config),
    "utf8",
  );
  const enabledPhases = getEnabledPhases(config);
  const completedPhases = getCompletedPhases(workflowDir);
  const userFeedback: Record<string, string> = {};

  for (const [phaseName, phaseConfig] of enabledPhases) {
    // Skip already completed phases (resume support)
    if (completedPhases.includes(phaseName)) {
      console.log(`⏭  Skipping ${phaseName} (already complete)`);
      continue;
    }

    // Resolve per-phase orchestration override
    const phaseMode = phaseConfig.orchestration || config.orchestration;
    if (phaseMode === "interactive") {
      await runInteractivePhase(
        config,
        phaseName,
        phaseConfig,
        userTask,
        workflowDir,
        universal,
        userFeedback,
      );
      continue;
    }

    console.log(`\n▶ Starting ${phaseName} phase...`);

    // Pre-hooks
    await runHooks(
      phaseConfig.pre || [],
      "pre",
      phaseName,
      workflowDir,
      userFeedback,
    );

    // Assemble prompt
    const skill = loadSkill(phaseConfig.skill, phaseConfig.overrides, config);
    const inputs = resolveInputs(phaseConfig.input, workflowDir);
    const knowledge = loadKnowledge(config);
    const humanAttended = isHumanAttended(phaseConfig);
    const prompt = assemblePrompt({
      universal,
      skill,
      inputs,
      knowledge,
      userTask,
      phaseName,
      workflowDir,
      config,
      humanAttended,
    });

    // Spawn headless agent with retries
    let result: string | null = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `  ↻ Retry ${attempt}/${config.maxRetries} for ${phaseName}...`,
          );
        }

        updateWorkflowStatus(
          workflowDir,
          phaseName,
          attempt > 0 ? `retry-${attempt}` : "in-progress",
          phaseConfig.model || config.model,
        );

        result = await runAgent(prompt, phaseConfig, config, humanAttended);
        lastError = null;
        break;
      } catch (err) {
        lastError =
          err instanceof Error ? err.message : String(err);
        console.log(
          `  ✗ ${phaseName} failed${attempt < config.maxRetries ? ", retrying..." : ""}`,
        );
      }
    }

    if (result === null) {
      // All retries exhausted
      writeErrorOutput(
        workflowDir,
        phaseName,
        `Phase failed after ${config.maxRetries + 1} attempts.\n\nLast error: ${lastError}`,
        phaseConfig,
        userTask,
      );
      updateWorkflowStatus(
        workflowDir,
        phaseName,
        "failed",
        phaseConfig.model || config.model,
      );
      updateWorkflowFinalStatus(workflowDir, "failed");
      console.log(
        `\n✗ Workflow stopped: ${phaseName} phase failed after ${config.maxRetries + 1} attempts.`,
      );
      console.log(`  Error: ${lastError}`);
      console.log(
        `  Use \`mstack resume\` to retry after fixing the issue.`,
      );
      return;
    }

    // Write output document
    writePhaseOutput(
      workflowDir,
      phaseName,
      result,
      phaseConfig,
      userTask,
      userFeedback,
    );
    updateWorkflowStatus(
      workflowDir,
      phaseName,
      "complete",
      phaseConfig.model || config.model,
    );

    console.log(`  ✓ ${phaseName} complete`);

    // Post-hooks
    await runHooks(
      phaseConfig.post || [],
      "post",
      phaseName,
      workflowDir,
      userFeedback,
    );
  }

  updateWorkflowFinalStatus(workflowDir, "complete");
  printWorkflowSummary(workflowDir);
}

export async function runAgent(
  prompt: string,
  phaseConfig: PhaseConfig,
  config: MstackConfig,
  humanAttended = false,
): Promise<string> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const conversation = query({
    prompt,
    options: {
      cwd: process.cwd(),
      model: phaseConfig.model || config.model,
      allowedTools: phaseConfig.tools,
      disallowedTools: humanAttended ? undefined : ["AskUserQuestion"],
      permissionMode: phaseConfig.permissionMode || config.permissionMode || "acceptEdits",
      includePartialMessages: true,
    },
  });

  let resultText = "";
  let currentTool = "";
  let currentToolInput = "";

  for await (const message of conversation) {
    switch (message.type) {
      case "stream_event": {
        const streamMsg = message as import("@anthropic-ai/claude-agent-sdk").SDKStreamEvent;
        const event = streamMsg.event;
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
          process.stdout.write(event.delta.text);
        } else if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta" && event.delta.partial_json) {
          currentToolInput += event.delta.partial_json;
        } else if (event.type === "content_block_start" && event.content_block?.type === "tool_use" && event.content_block.name) {
          currentTool = event.content_block.name;
          currentToolInput = "";
        } else if (event.type === "content_block_stop" && currentTool) {
          const summary = formatToolSummary(currentTool, currentToolInput);
          console.log(`\n  🔧 ${summary}`);
          currentTool = "";
          currentToolInput = "";
        }
        break;
      }
      case "result": {
        const msg = message as { type: string; subtype?: string; result?: string; error?: string; is_error?: boolean };
        if (msg.is_error) {
          throw new Error(msg.error || "Agent returned an error");
        }
        resultText = msg.result || "";
        break;
      }
    }
  }

  if (!resultText.trim()) {
    throw new Error("Agent produced no output");
  }

  return resultText;
}

async function runHooks(
  hooks: string[],
  type: "pre" | "post",
  phaseName: string,
  workflowDir: string,
  userFeedback: Record<string, string>,
): Promise<void> {
  for (const hook of hooks) {
    if (hook === "human") {
      const context =
        type === "pre"
          ? `Phase "${phaseName}" is about to execute.`
          : `Phase "${phaseName}" has finished.`;
      const feedback = await humanCheckpoint(type, phaseName, context);
      if (feedback !== "approved") {
        userFeedback[phaseName] = feedback;
        recordUserInput(workflowDir, phaseName, type, feedback);
      }
    } else if (hook === "review") {
      console.log(
        `  ⚡ Review hook for ${phaseName} — spawning review sub-agent`,
      );
    } else {
      // Custom script hook
      const { execSync } = await import("node:child_process");
      try {
        execSync(hook, { cwd: process.cwd(), stdio: "inherit" });
      } catch (err) {
        console.log(
          `  ⚠ Hook "${hook}" failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}

export function formatToolSummary(tool: string, rawInput: string): string {
  try {
    const input = JSON.parse(rawInput);
    switch (tool) {
      case "Write":
      case "Read":
        return `${tool} ${input.file_path}`;
      case "Edit":
        return `${tool} ${input.file_path}`;
      case "Bash":
        return `${tool} $ ${input.command?.length > 80 ? input.command.slice(0, 80) + "…" : input.command}`;
      case "Glob":
        return `${tool} ${input.pattern}`;
      case "Grep":
        return `${tool} ${input.pattern}${input.path ? ` in ${input.path}` : ""}`;
      case "Agent":
        return `${tool} ${input.description || "sub-agent"}`;
      default:
        return tool;
    }
  } catch {
    return tool;
  }
}

function printWorkflowSummary(workflowDir: string): void {
  console.log("\n" + "=".repeat(60));
  console.log("  Workflow complete!");
  console.log("=".repeat(60));
  console.log(`\n  Output: ${workflowDir}`);

  const files = fs.readdirSync(workflowDir).filter((f) => f.endsWith(".md"));
  console.log(`  Phase outputs: ${files.length} documents`);
  for (const f of files) {
    console.log(`    - ${f}`);
  }
  console.log("");
}
