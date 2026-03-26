import type { MstackConfig } from "./types.js";
import { runPromptMode } from "./modes/prompt.js";
import { runCodeMode } from "./modes/code.js";
import { runInteractiveMode } from "./modes/interactive.js";

export async function run(
  config: MstackConfig,
  userTask: string,
  workflowDir: string,
): Promise<void> {
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
