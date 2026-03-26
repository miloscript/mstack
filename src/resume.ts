import * as fs from "node:fs";
import * as path from "node:path";
import type { MstackConfig } from "./types.js";
import { getEnabledPhases } from "./config.js";
import { run } from "./runner.js";
import {
  getCompletedPhases,
  extractUserTask,
} from "./utils/workflow-manager.js";

export async function resume(
  config: MstackConfig,
  workflowSlug: string,
): Promise<void> {
  const workflowDir = path.join(
    process.cwd(),
    config.outputDir,
    "workflows",
    workflowSlug,
  );

  if (!fs.existsSync(workflowDir)) {
    throw new Error(`Workflow not found: ${workflowSlug}`);
  }

  // Read workflow.md to get the original task
  const workflowMd = fs.readFileSync(
    path.join(workflowDir, "workflow.md"),
    "utf8",
  );
  const userTask = extractUserTask(workflowMd);

  // Determine completed phases
  const completedPhases = getCompletedPhases(workflowDir);
  const enabledPhases = getEnabledPhases(config);

  // Find remaining phases
  const remainingPhases = enabledPhases.filter(
    ([name]) => !completedPhases.includes(name),
  );

  if (remainingPhases.length === 0) {
    console.log("All phases complete. Nothing to resume.");
    return;
  }

  console.log(`Resuming from phase: ${remainingPhases[0][0]}`);
  console.log(`Completed: ${completedPhases.join(", ") || "none"}`);
  console.log("");

  // Run remaining phases using the configured mode
  // (The runner skips phases that already have output files)
  await run(config, userTask, workflowDir);
}
