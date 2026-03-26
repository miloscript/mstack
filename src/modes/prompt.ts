import * as fs from "node:fs";
import type { MstackConfig } from "../types.js";
import { resolveSkillPath, resolvePromptPath } from "../utils/prompt-assembler.js";

export async function runPromptMode(
  config: MstackConfig,
  userTask: string,
  workflowDir: string,
): Promise<void> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const orchestratorSkill = fs.readFileSync(
    resolveSkillPath("orchestrator", config),
    "utf8",
  );
  const universal = fs.readFileSync(
    resolvePromptPath("universal", config),
    "utf8",
  );

  const systemPrompt = `${universal}\n\n${orchestratorSkill}`;

  console.log("▶ Starting workflow in prompt mode (Claude drives the loop)...\n");

  const conversation = query({
    prompt: `Run mstack workflow for the following task:\n\n${userTask}\n\nWorkflow directory: ${workflowDir}\nConfig path: ${config.outputDir}/mstack.config.js`,
    options: {
      systemPrompt,
      cwd: process.cwd(),
      model: config.model,
      permissionMode: config.permissionMode || "acceptEdits",
    },
  });

  for await (const message of conversation) {
    switch (message.type) {
      case "assistant": {
        const assistantMsg = message as { type: string; content?: Array<{ type: string; text?: string; name?: string }> };
        for (const block of assistantMsg.content || []) {
          if (block.type === "text" && block.text) {
            process.stdout.write(block.text);
          } else if (block.type === "tool_use" && block.name) {
            console.log(`\n  🔧 ${block.name}`);
          }
        }
        break;
      }
      case "tool_use_summary": {
        const summary = message as { type: string; tool_name?: string; summary?: string };
        if (summary.summary) {
          console.log(`  ↳ ${summary.tool_name}: ${summary.summary}`);
        }
        break;
      }
      case "result": {
        const msg = message as { type: string; is_error?: boolean; error?: string };
        if (msg.is_error) {
          console.error(`Workflow error: ${msg.error}`);
        }
        break;
      }
    }
  }
}
