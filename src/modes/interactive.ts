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
import { PermissionError } from "../utils/permission-error.js";
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
} from "../utils/ui.js";
import { runAgent, isHumanAttended } from "./code.js";

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
  phaseIndex?: number,
): Promise<void> {
  console.log(formatPhaseHeader(phaseName, true));

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
      result = await runAgent(
        prompt,
        phaseConfig,
        config,
        isHumanAttended(phaseConfig),
        spinner,
      );
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
    return;
  }

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

  // Determine the last phase name for shipping-state logic
  const lastPhaseName =
    enabledPhases.length > 0
      ? enabledPhases[enabledPhases.length - 1][0]
      : null;

  for (let i = 0; i < enabledPhases.length; i++) {
    const [phaseName, phaseConfig] = enabledPhases[i];
    const phaseIndex = i + 1;

    if (completedPhases.includes(phaseName)) {
      printPhaseSkipped(phaseName);
      continue;
    }

    // Mark workflow as "shipping" just before the last phase executes
    if (phaseName === lastPhaseName) {
      updateWorkflowFinalStatus(workflowDir, "shipping");
    }

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
          `  ⚠ Hook "${hook}" failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
