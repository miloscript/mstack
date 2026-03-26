import * as fs from "node:fs";
import * as path from "node:path";
import type { MstackConfig } from "./types.js";
import { loadConfig } from "./config.js";

/**
 * Runs the `mstack mistake` flow:
 * 1. Lists recent workflows for context
 * 2. Spawns an interactive agent that asks the user to describe the mistake
 * 3. Appends a structured entry to .mstack/knowledge/mistakes.md
 */
export async function recordMistake(
  config: MstackConfig,
  workflowSlug?: string,
): Promise<void> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const cwd = process.cwd();
  const mstackDir = path.join(cwd, config.outputDir);
  const skillPath = path.join(mstackDir, "skills", "mistake.md");
  const knowledgeDir = path.join(mstackDir, "knowledge");
  const mistakesFile = path.join(knowledgeDir, "mistakes.md");

  if (!fs.existsSync(skillPath)) {
    throw new Error(
      `Mistake skill not found at ${skillPath}. Run \`mstack init --force\` to reinstall default skills.`,
    );
  }

  const skill = fs.readFileSync(skillPath, "utf8");

  // Build context: include recent workflow summary and/or specific workflow
  let workflowContext = "";
  if (workflowSlug) {
    const wfDir = path.join(mstackDir, "workflows", workflowSlug);
    if (fs.existsSync(wfDir)) {
      const wfFiles = fs
        .readdirSync(wfDir)
        .filter((f) => f.endsWith(".md"))
        .slice(0, 5); // Limit context size
      const snippets = wfFiles
        .map((f) => {
          const content = fs.readFileSync(path.join(wfDir, f), "utf8");
          return `### ${f}\n\n${content.substring(0, 1000)}${content.length > 1000 ? "\n...(truncated)" : ""}`;
        })
        .join("\n\n");
      workflowContext = `\n\n## Recent Workflow: ${workflowSlug}\n\n${snippets}`;
    }
  } else {
    // List the 3 most recent workflow slugs for context
    const wfRoot = path.join(mstackDir, "workflows");
    if (fs.existsSync(wfRoot)) {
      const slugs = fs
        .readdirSync(wfRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
        .reverse()
        .slice(0, 3);
      if (slugs.length > 0) {
        workflowContext = `\n\n## Recent Workflows\n\n${slugs.map((s) => `- ${s}`).join("\n")}`;
      }
    }
  }

  // Current mistakes file content for context
  let currentMistakes = "";
  if (fs.existsSync(mistakesFile)) {
    currentMistakes = `\n\n## Current mistakes.md\n\n${fs.readFileSync(mistakesFile, "utf8")}`;
  }

  const prompt = `${skill}

## Context

You have access to:
- The project mistakes file at: ${mistakesFile}
- The mstack knowledge directory: ${knowledgeDir}
${workflowContext}${currentMistakes}

## Instructions

Use AskUserQuestion to ask the user to describe the mistake they observed.
Then analyse the mistake in context of recent workflow outputs and append a well-structured entry to ${mistakesFile}.
`;

  console.log("\n📝 mstack mistake — recording a mistake for future consideration\n");

  const conversation = query({
    prompt,
    options: {
      cwd,
      model: config.model,
      permissionMode: config.permissionMode || "acceptEdits",
      includePartialMessages: true,
    },
  });

  for await (const message of conversation) {
    if (message.type === "stream_event") {
      const streamMsg =
        message as import("@anthropic-ai/claude-agent-sdk").SDKStreamEvent;
      const event = streamMsg.event;
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        process.stdout.write(event.delta.text);
      }
    } else if (message.type === "result") {
      const msg = message as {
        type: string;
        is_error?: boolean;
        error?: string;
      };
      if (msg.is_error) {
        throw new Error(msg.error || "Mistake agent returned an error");
      }
    }
  }

  console.log("\n\n✓ Mistake recorded to .mstack/knowledge/mistakes.md\n");
}
