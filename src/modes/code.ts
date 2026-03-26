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
import {
  PermissionError,
  isPermissionError,
} from "../utils/permission-error.js";
import { ensurePermissions } from "../utils/permissions.js";
import {
  createSpinner,
  formatPhaseHeader,
  printPhaseComplete,
  printPhaseFailed,
  printPhaseSkipped,
  printWorkflowSummary,
  printPermissionError,
  printRetry,
  type Spinner,
} from "../utils/ui.js";
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

  // Determine the last phase name for shipping-state logic
  const lastPhaseName =
    enabledPhases.length > 0
      ? enabledPhases[enabledPhases.length - 1][0]
      : null;

  for (let i = 0; i < enabledPhases.length; i++) {
    const [phaseName, phaseConfig] = enabledPhases[i];
    const phaseIndex = i + 1; // 1-based, used for file naming

    // Skip already completed phases (resume support)
    if (completedPhases.includes(phaseName)) {
      printPhaseSkipped(phaseName);
      continue;
    }

    // Mark workflow as "shipping" just before the last phase executes
    if (phaseName === lastPhaseName) {
      updateWorkflowFinalStatus(workflowDir, "shipping");
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
        phaseIndex,
      );
      continue;
    }

    console.log(formatPhaseHeader(phaseName, false));

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
      phaseIndex,
    });

    // Spawn headless agent with retries
    let result: string | null = null;
    let lastError: string | null = null;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      if (attempt > 0) {
        printRetry(phaseName, attempt, config.maxRetries);
      }

      updateWorkflowStatus(
        workflowDir,
        phaseName,
        attempt > 0 ? `retry-${attempt}` : "in-progress",
        phaseConfig.model || config.model,
      );

      const spinner = createSpinner(`Running ${phaseName}...`);
      spinner.start();

      try {
        result = await runAgent(prompt, phaseConfig, config, humanAttended, spinner);
        lastError = null;
        break;
      } catch (err) {
        spinner.stop();

        // Permission errors must not be retried — exit immediately
        if (err instanceof PermissionError) {
          const errMsg = err.message;
          writeErrorOutput(
            workflowDir,
            phaseName,
            `Permission error: ${errMsg}`,
            phaseConfig,
            userTask,
            phaseIndex,
          );
          updateWorkflowStatus(
            workflowDir,
            phaseName,
            "failed",
            phaseConfig.model || config.model,
          );
          updateWorkflowFinalStatus(workflowDir, "permission-error");
          ensurePermissions(config.permissions || []);
          printPermissionError(phaseName, errMsg);
          return;
        }

        lastError = err instanceof Error ? err.message : String(err);
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
        phaseIndex,
      );
      updateWorkflowStatus(
        workflowDir,
        phaseName,
        "failed",
        phaseConfig.model || config.model,
      );
      updateWorkflowFinalStatus(workflowDir, "failed");
      printPhaseFailed(phaseName, config.maxRetries + 1);
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
      phaseIndex,
    );
    updateWorkflowStatus(
      workflowDir,
      phaseName,
      "complete",
      phaseConfig.model || config.model,
    );

    printPhaseComplete(phaseName, Date.now() - startTime);

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
  spinner?: Spinner,
): Promise<string> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const conversation = query({
    prompt,
    options: {
      cwd: process.cwd(),
      model: phaseConfig.model || config.model,
      allowedTools: phaseConfig.tools,
      disallowedTools: humanAttended ? undefined : ["AskUserQuestion"],
      permissionMode:
        phaseConfig.permissionMode ||
        config.permissionMode ||
        "acceptEdits",
      includePartialMessages: true,
    },
  });

  let resultText = "";
  let firstOutput = true;
  // Track tool state per context (null = top-level, string = parent tool use id)
  const toolState = new Map<string, { tool: string; input: string }>();

  for await (const message of conversation) {
    switch (message.type) {
      case "stream_event": {
        const streamMsg =
          message as import("@anthropic-ai/claude-agent-sdk").SDKStreamEvent;
        const event = streamMsg.event;
        const contextKey = streamMsg.parent_tool_use_id || "root";
        const isNested = streamMsg.parent_tool_use_id !== null;
        const indent = isNested ? "    " : "  ";

        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta" &&
          event.delta.text
        ) {
          if (!isNested) {
            // Stop spinner before first text output
            if (firstOutput) {
              spinner?.stop();
              firstOutput = false;
            }
            process.stdout.write(event.delta.text);
          }
        } else if (
          event.type === "content_block_delta" &&
          event.delta?.type === "input_json_delta" &&
          event.delta.partial_json
        ) {
          const state = toolState.get(contextKey);
          if (state) {
            state.input += event.delta.partial_json;
          }
        } else if (
          event.type === "content_block_start" &&
          event.content_block?.type === "tool_use" &&
          event.content_block.name
        ) {
          toolState.set(contextKey, {
            tool: event.content_block.name,
            input: "",
          });
        } else if (event.type === "content_block_stop") {
          const state = toolState.get(contextKey);
          if (state) {
            // Stop spinner before first tool output
            if (firstOutput) {
              spinner?.stop();
              firstOutput = false;
            }
            const summary = formatToolSummary(state.tool, state.input);
            console.log(`\n${indent}🔧 ${summary}`);
            toolState.delete(contextKey);
          }
        }
        break;
      }
      case "result": {
        const msg = message as {
          type: string;
          subtype?: string;
          result?: string;
          error?: string;
          is_error?: boolean;
        };
        if (msg.is_error) {
          throw new Error(msg.error || "Agent returned an error");
        }
        resultText = msg.result || "";
        break;
      }
    }
  }

  // Ensure spinner is cleared even if no output was produced
  spinner?.stop();

  if (!resultText.trim()) {
    throw new Error("Agent produced no output");
  }

  // Detect permission errors in the final result text
  if (isPermissionError(resultText)) {
    throw new PermissionError(
      resultText.substring(0, 500),
    );
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
        return `${tool} $ ${
          input.command?.length > 80
            ? input.command.slice(0, 80) + "…"
            : input.command
        }`;
      case "Glob":
        return `${tool} ${input.pattern}`;
      case "Grep":
        return `${tool} ${input.pattern}${
          input.path ? ` in ${input.path}` : ""
        }`;
      case "Agent":
        return `${tool} ${input.description || "sub-agent"}`;
      default:
        return tool;
    }
  } catch {
    return tool;
  }
}
