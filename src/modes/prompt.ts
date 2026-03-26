import * as fs from "node:fs";
import type { MstackConfig } from "../types.js";
import { resolveSkillPath, resolvePromptPath } from "../utils/prompt-assembler.js";
import { formatToolSummary, isHumanAttended } from "./code.js";

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

  const anyHumanPhase = Object.values(config.phases).some(isHumanAttended);
  const humanContext = anyHumanPhase
    ? "\n\n## Human Availability\n\nSome phases have human checkpoints configured. Check each phase's pre/post hooks — use AskUserQuestion only during phases with a \"human\" hook. For all other phases, make decisions autonomously."
    : "\n\n## Human Availability\n\nNo human checkpoints are configured for this workflow. Make all decisions autonomously — do not use AskUserQuestion.";

  const systemPrompt = `${universal}\n\n${orchestratorSkill}${humanContext}`;

  console.log("▶ Starting workflow in prompt mode (Claude drives the loop)...\n");

  const conversation = query({
    prompt: `Run mstack workflow for the following task:\n\n${userTask}\n\nWorkflow directory: ${workflowDir}\nConfig path: ${config.outputDir}/mstack.config.js`,
    options: {
      systemPrompt,
      cwd: process.cwd(),
      model: config.model,
      permissionMode: config.permissionMode || "acceptEdits",
      disallowedTools: anyHumanPhase ? undefined : ["AskUserQuestion"],
      includePartialMessages: true,
    },
  });

  const toolState = new Map<string, { tool: string; input: string }>();

  for await (const message of conversation) {
    switch (message.type) {
      case "stream_event": {
        const streamMsg = message as import("@anthropic-ai/claude-agent-sdk").SDKStreamEvent;
        const event = streamMsg.event;
        const contextKey = streamMsg.parent_tool_use_id || "root";
        const isNested = streamMsg.parent_tool_use_id !== null;
        const indent = isNested ? "    " : "  ";

        if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
          if (!isNested) {
            process.stdout.write(event.delta.text);
          }
        } else if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta" && event.delta.partial_json) {
          const state = toolState.get(contextKey);
          if (state) {
            state.input += event.delta.partial_json;
          }
        } else if (event.type === "content_block_start" && event.content_block?.type === "tool_use" && event.content_block.name) {
          toolState.set(contextKey, { tool: event.content_block.name, input: "" });
        } else if (event.type === "content_block_stop") {
          const state = toolState.get(contextKey);
          if (state) {
            const summary = formatToolSummary(state.tool, state.input);
            console.log(`\n${indent}🔧 ${summary}`);
            toolState.delete(contextKey);
          }
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
