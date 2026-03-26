import type { MstackConfig } from "./types.js";
import { runPromptMode } from "./modes/prompt.js";
import { runCodeMode } from "./modes/code.js";
import { runInteractiveMode } from "./modes/interactive.js";
import { ensurePermissions } from "./utils/permissions.js";

export async function run(
  config: MstackConfig,
  userTask: string,
  workflowDir: string,
): Promise<void> {
  // Merge required permissions into .claude/settings.local.json before running
  if (config.permissions?.length) {
    ensurePermissions(config.permissions);
  }

  switch (config.orchestration) {
    case "prompt":
      return runPromptMode(config, userTask, workflowDir);
    case "code":
      return runCodeMode(config, userTask, workflowDir);
    case "interactive":
      return runInteractiveMode(config, userTask, workflowDir);
    default:
      throw new Error(
        `Unknown orchestration mode: ${config.orchestration}`,
      );
  }
}
