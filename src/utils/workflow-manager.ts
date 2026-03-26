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
  title?: string,
): void {
  const slug = path.basename(workflowDir);
  const heading = title ?? userTask;
  const doc = `---
workflow: ${slug}
created: ${new Date().toISOString()}
status: in-progress
completed:
---
# Workflow: ${heading}

## Task Body

${userTask}

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

/**
 * Writes the original user task to initial-user-input.md in the workflow dir.
 * This file is a stable record of the user's original request and is
 * auto-included in agent prompts so every phase has easy access to the spec.
 */
export function writeInitialUserInput(
  workflowDir: string,
  userTask: string,
): void {
  fs.writeFileSync(path.join(workflowDir, "initial-user-input.md"), userTask);
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
  status: "complete" | "failed" | "shipping" | "permission-error",
): void {
  const workflowPath = path.join(workflowDir, "workflow.md");
  let content = fs.readFileSync(workflowPath, "utf8");

  // Replace whatever the current status is (may be in-progress, shipping, etc.)
  content = content.replace(
    /^status: .+$/m,
    `status: ${status}`,
  );

  // Stamp completed timestamp for terminal states only
  if (status === "complete" || status === "failed" || status === "permission-error") {
    content = content.replace(
      /completed:\s*$|completed:\s*(?=\n)/m,
      `completed: ${new Date().toISOString()}`,
    );
  }

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

/**
 * Returns the list of phase names that have already been completed.
 *
 * Handles both legacy filenames (e.g. `analysis.md`) and numbered filenames
 * (e.g. `01-analysis.md`) introduced in mstack v0.2+. Also excludes
 * workflow.md and initial-user-input.md which are metadata files, not phase outputs.
 */
export function getCompletedPhases(workflowDir: string): string[] {
  const EXCLUDED = new Set(["workflow.md", "initial-user-input.md"]);

  const files = fs.readdirSync(workflowDir);
  return files
    .filter((f) => f.endsWith(".md") && !EXCLUDED.has(f))
    .map((f) => {
      const name = f.replace(/\.md$/, "");
      // Strip leading numeric prefix, e.g. "01-analysis" → "analysis"
      return name.replace(/^\d+-/, "");
    });
}

export function extractUserTask(workflowMd: string): string {
  // Prefer ## Task Body section (new format)
  // No `m` flag: `$` means end-of-string (safe fallback); `\n## ` terminates at next heading
  const bodyMatch = workflowMd.match(/## Task Body\n\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (bodyMatch) return bodyMatch[1].trim();
  // Fallback: extract from # Workflow: heading (legacy format)
  const headingMatch = workflowMd.match(/^# Workflow: (.+)$/m);
  return headingMatch ? headingMatch[1] : "Unknown task";
}

export function resolveRunInput(opts: {
  task?: string;
  fileContent?: string;
  fileStem?: string;
}): { title: string; userTask: string } {
  const { task, fileContent, fileStem } = opts;
  if (!task && !fileContent) {
    throw new Error(
      "Must provide either a task description (-t / positional) or a spec file (-f).",
    );
  }
  if (task && !fileContent) {
    return { title: task, userTask: task };
  }
  if (!task && fileContent) {
    return { title: fileStem ?? "untitled", userTask: fileContent };
  }
  // Both task and fileContent supplied: task becomes title, combined content becomes userTask
  return {
    title: task!,
    userTask: `${task}\n\n${fileContent}`,
  };
}
