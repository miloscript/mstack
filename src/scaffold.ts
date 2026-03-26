import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { MstackConfig } from "./types.js";
import { loadConfig } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// defaults/ lives at package root, one level up from src/
const DEFAULTS_DIR = path.resolve(__dirname, "..", "defaults");
// When running from dist/, defaults is two levels up
const DEFAULTS_DIR_DIST = path.resolve(__dirname, "..", "..", "defaults");

function getDefaultsDir(): string {
  if (fs.existsSync(DEFAULTS_DIR)) return DEFAULTS_DIR;
  if (fs.existsSync(DEFAULTS_DIR_DIST)) return DEFAULTS_DIR_DIST;
  throw new Error("Cannot locate defaults/ directory in mstack package.");
}

export interface ScaffoldOptions {
  force?: boolean;
}

export async function scaffold(opts: ScaffoldOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const mstackDir = path.join(cwd, ".mstack");
  const claudeCommandDir = path.join(cwd, ".claude", "commands");

  // Check for existing .mstack/
  if (fs.existsSync(mstackDir) && !opts.force) {
    console.log(
      "⚠  .mstack/ already exists. Use `mstack init --force` to re-scaffold.",
    );
    console.log(
      "   (--force preserves knowledge/ and workflows/, overwrites everything else)",
    );
    return;
  }

  const defaultsDir = getDefaultsDir();

  if (opts.force && fs.existsSync(mstackDir)) {
    // Preserve knowledge/ and workflows/
    const preserve = ["knowledge", "workflows"];
    const entries = fs.readdirSync(mstackDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!preserve.includes(entry.name)) {
        const fullPath = path.join(mstackDir, entry.name);
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
    // Archive existing init.md if it exists
    const initMd = path.join(mstackDir, "init.md");
    if (fs.existsSync(initMd)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.renameSync(initMd, path.join(mstackDir, `init.${timestamp}.md`));
    }
  }

  // Create directory structure
  const dirs = [
    mstackDir,
    path.join(mstackDir, "skills"),
    path.join(mstackDir, "prompts"),
    path.join(mstackDir, "knowledge"),
    path.join(mstackDir, "workflows"),
    claudeCommandDir,
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Copy defaults
  copyDir(path.join(defaultsDir, "skills"), path.join(mstackDir, "skills"));
  copyDir(path.join(defaultsDir, "prompts"), path.join(mstackDir, "prompts"));
  fs.copyFileSync(
    path.join(defaultsDir, "mstack.config.js"),
    path.join(mstackDir, "mstack.config.js"),
  );

  // Create knowledge skeletons (only if they don't exist — preserves on --force)
  writeIfNotExists(
    path.join(mstackDir, "knowledge", "mistakes.md"),
    `# Mistakes

<!-- Entries are added by the review phase when issues are found.
     Format:
     ## YYYY-MM-DD: Brief description
     - **What happened:** ...
     - **Root cause:** ...
     - **Prevention:** ...
-->
`,
  );

  writeIfNotExists(
    path.join(mstackDir, "knowledge", "patterns.md"),
    `# Patterns

<!-- Entries are added by the init and analysis phases as patterns are discovered.
     Organize by domain (API Routes, Testing, Database, etc.)
-->
`,
  );

  // Install slash command
  fs.copyFileSync(
    path.join(defaultsDir, "commands", "mstack.md"),
    path.join(claudeCommandDir, "mstack.md"),
  );

  console.log("✓ Scaffolded .mstack/ directory");
  console.log("✓ Installed /mstack slash command");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Edit .mstack/mstack.config.js to set your project name");
  console.log('  2. Run `mstack run "your task"` to start a workflow');
  console.log("  3. Or use /mstack inside Claude Code");

  // Run init phase scan
  console.log("");
  console.log("Running init scan...");
  try {
    await runInitPhase();
    console.log("✓ Project profile written to .mstack/init.md");
  } catch (err) {
    console.log(
      "⚠  Init scan skipped (Claude Code SDK not available or failed).",
    );
    console.log("   You can re-run it later with `mstack init --force`.");
  }
}

async function runInitPhase(): Promise<void> {
  // Dynamic import to avoid hard failure if SDK isn't available
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const cwd = process.cwd();
  const mstackDir = path.join(cwd, ".mstack");

  const initSkill = fs.readFileSync(
    path.join(mstackDir, "skills", "init.md"),
    "utf8",
  );
  const universal = fs.readFileSync(
    path.join(mstackDir, "prompts", "universal.md"),
    "utf8",
  );

  let config: MstackConfig;
  try {
    config = await loadConfig();
  } catch {
    config = { model: "claude-sonnet-4-6" } as MstackConfig;
  }

  const prompt = `${universal}\n\n${initSkill}\n\nScan this project and produce a project profile. Output the full project profile as your response.`;

  const conversation = query({
    prompt,
    options: {
      cwd,
      model: config.model,
    },
  });

  let resultText = "";
  for await (const message of conversation) {
    if (message.type === "result") {
      const msg = message as { type: string; result?: string; is_error?: boolean };
      if (!msg.is_error && msg.result) {
        resultText = msg.result;
      }
    }
  }

  if (resultText.trim()) {
    fs.writeFileSync(path.join(mstackDir, "init.md"), resultText);
  }
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function writeIfNotExists(filePath: string, content: string): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
  }
}
