import * as fs from "node:fs";
import * as path from "node:path";
import type { MstackConfig } from "./types.js";

export async function printStatus(
  config: MstackConfig,
  workflowSlug?: string,
): Promise<void> {
  const workflowsDir = path.join(
    process.cwd(),
    config.outputDir,
    "workflows",
  );

  if (!fs.existsSync(workflowsDir)) {
    console.log("No workflows found. Run `mstack run` to start one.");
    return;
  }

  if (workflowSlug) {
    printSingleWorkflow(workflowsDir, workflowSlug);
  } else {
    printAllWorkflows(workflowsDir);
  }
}

function printAllWorkflows(workflowsDir: string): void {
  const entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  if (dirs.length === 0) {
    console.log("No workflows found. Run `mstack run` to start one.");
    return;
  }

  console.log("\nWorkflows:\n");
  console.log(
    padRight("Workflow", 50) +
      padRight("Status", 15) +
      padRight("Last Phase", 20) +
      "Created",
  );
  console.log("-".repeat(100));

  for (const dir of dirs) {
    const workflowPath = path.join(workflowsDir, dir.name, "workflow.md");
    if (!fs.existsSync(workflowPath)) continue;

    const content = fs.readFileSync(workflowPath, "utf8");
    const status = extractFrontmatter(content, "status") || "unknown";
    const created = extractFrontmatter(content, "created") || "—";
    const lastPhase = getLastPhase(
      path.join(workflowsDir, dir.name),
    );

    console.log(
      padRight(dir.name, 50) +
        padRight(status, 15) +
        padRight(lastPhase, 20) +
        created.substring(0, 10),
    );
  }
  console.log("");
}

function printSingleWorkflow(
  workflowsDir: string,
  slug: string,
): void {
  const workflowDir = path.join(workflowsDir, slug);
  const workflowPath = path.join(workflowDir, "workflow.md");

  if (!fs.existsSync(workflowPath)) {
    console.log(`Workflow not found: ${slug}`);
    return;
  }

  const content = fs.readFileSync(workflowPath, "utf8");
  const status = extractFrontmatter(content, "status") || "unknown";
  const created = extractFrontmatter(content, "created") || "—";

  console.log(`\nWorkflow: ${slug}`);
  console.log(`Status:   ${status}`);
  console.log(`Created:  ${created}`);
  console.log("");

  // Print phase status table
  console.log(
    padRight("Phase", 20) +
      padRight("Status", 15) +
      padRight("Model", 25) +
      "Timestamp",
  );
  console.log("-".repeat(75));

  // Parse phase status rows from the table in workflow.md
  const tableMatch = content.match(
    /## Phase Status\n\|.*\n\|.*\n([\s\S]*?)(?=\n## |$)/,
  );
  if (tableMatch) {
    const rows = tableMatch[1]
      .trim()
      .split("\n")
      .filter((r) => r.startsWith("|"));
    for (const row of rows) {
      const cols = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length >= 4) {
        console.log(
          padRight(cols[0], 20) +
            padRight(cols[1], 15) +
            padRight(cols[2], 25) +
            cols[3],
        );
      }
    }
  }

  // List output files
  const files = fs
    .readdirSync(workflowDir)
    .filter((f) => f.endsWith(".md") && f !== "workflow.md");
  if (files.length > 0) {
    console.log("\nOutput documents:");
    for (const f of files) {
      console.log(`  - ${f}`);
    }
  }
  console.log("");
}

function getLastPhase(workflowDir: string): string {
  const files = fs
    .readdirSync(workflowDir)
    .filter((f) => f.endsWith(".md") && f !== "workflow.md")
    .map((f) => f.replace(".md", ""));
  return files[files.length - 1] || "—";
}

function extractFrontmatter(
  content: string,
  key: string,
): string | null {
  const match = content.match(
    new RegExp(`^${key}:\\s*(.+)$`, "m"),
  );
  return match ? match[1].trim() : null;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}
