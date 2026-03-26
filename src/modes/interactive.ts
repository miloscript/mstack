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
import { runAgent } from "./code.js";

/**
 * Run a single phase in interactive mode.
 * Called from code.ts when a phase has orchestration: "interactive".
 */
export async function runInteractivePhase(
  config: MstackConfig,
  phaseName: string,
  phaseConfig: PhaseConfig,
  userTask: string,
  workflowDir: string,
  universal: string,
  userFeedback: Record<string, string>,
): Promise<void> {
  console.log(`\n▶ Starting ${phaseName} phase (interactive)...`);

  // Pre-hooks
  await runInteractiveHooks(
    phaseConfig.pre || [],
    "pre",
    phaseName,
    workflowDir,
    userFeedback,
  );

  const skill = loadSkill(phaseConfig.skill, phaseConfig.overrides, config);
  const inputs = resolveInputs(phaseConfig.input, workflowDir);
  const knowledge = loadKnowledge(config);
  const prompt = assemblePrompt({
    universal,
    skill,
    inputs,
    knowledge,
    userTask,
    phaseName,
    workflowDir,
    config,
  });

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

      result = await runAgent(prompt, phaseConfig, config);
      lastError = null;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.log(
        `  ✗ ${phaseName} failed${attempt < config.maxRetries ? ", retrying..." : ""}`,
      );
    }
  }

  if (result === null) {
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
    return;
  }

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
  await runInteractiveHooks(
    phaseConfig.post || [],
    "post",
    phaseName,
    workflowDir,
    userFeedback,
  );
}

/**
 * Full interactive mode runner — CLI drives the loop, each phase is interactive.
 */
export async function runInteractiveMode(
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
    if (completedPhases.includes(phaseName)) {
      console.log(`⏭  Skipping ${phaseName} (already complete)`);
      continue;
    }

    await runInteractivePhase(
      config,
      phaseName,
      phaseConfig,
      userTask,
      workflowDir,
      universal,
      userFeedback,
    );
  }

  updateWorkflowFinalStatus(workflowDir, "complete");
  printWorkflowSummary(workflowDir);
}

async function runInteractiveHooks(
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
