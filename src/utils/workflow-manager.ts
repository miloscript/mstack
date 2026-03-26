import * as fs from "node:fs";
import * as path from "node:path";
import type { MstackConfig } from "../types.js";

export function generateSlug(task: string): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);
  return `${date}-${slug}`;
}

export function createWorkflowDir(
  config: MstackConfig,
  slug: string,
): string {
  const dir = path.join(process.cwd(), config.outputDir, "workflows", slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeWorkflowRoot(
  workflowDir: string,
  config: MstackConfig,
  userTask: string,
): void {
  const slug = path.basename(workflowDir);
  const doc = `---
workflow: ${slug}
created: ${new Date().toISOString()}
status: in-progress
---
# Workflow: ${userTask}

## Config

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## Phase Status

| Phase | Status | Model | Timestamp |
|-------|--------|-------|-----------|

## User Inputs

`;
  fs.writeFileSync(path.join(workflowDir, "workflow.md"), doc);
}

export function updateWorkflowStatus(
  workflowDir: string,
  phaseName: string,
  status: string,
  model?: string,
): void {
  const workflowPath = path.join(workflowDir, "workflow.md");
  let content = fs.readFileSync(workflowPath, "utf8");

  const timestamp = new Date().toISOString().split("T")[1].substring(0, 5);
  const row = `| ${phaseName} | ${status} | ${model || "—"} | ${timestamp} |`;
  content = content.replace(
    /(## Phase Status\n+\|.*\n\|.*\n)([\s\S]*?)(## User Inputs)/,
    `$1$2${row}\n$3`,
  );

  fs.writeFileSync(workflowPath, content);
}

export function updateWorkflowFinalStatus(
  workflowDir: string,
  status: "complete" | "failed",
): void {
  const workflowPath = path.join(workflowDir, "workflow.md");
  let content = fs.readFileSync(workflowPath, "utf8");
  content = content.replace(/status: in-progress/, `status: ${status}`);
  fs.writeFileSync(workflowPath, content);
}

export function recordUserInput(
  workflowDir: string,
  phaseName: string,
  hookType: string,
  input: string,
): void {
  const workflowPath = path.join(workflowDir, "workflow.md");
  let content = fs.readFileSync(workflowPath, "utf8");
  const entry = `- **${phaseName} (${hookType}):** "${input}"`;
  content = content.replace(
    /## User Inputs\n/,
    `## User Inputs\n${entry}\n`,
  );
  fs.writeFileSync(workflowPath, content);
}

export function getCompletedPhases(workflowDir: string): string[] {
  const files = fs.readdirSync(workflowDir);
  return files
    .filter((f) => f.endsWith(".md") && f !== "workflow.md")
    .map((f) => f.replace(".md", ""));
}

export function extractUserTask(workflowMd: string): string {
  const match = workflowMd.match(/^# Workflow: (.+)$/m);
  return match ? match[1] : "Unknown task";
}
