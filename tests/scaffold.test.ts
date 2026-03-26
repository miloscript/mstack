import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { scaffold } from "../src/scaffold.js";

describe("scaffold", () => {
  const origCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(import.meta.dirname, ".tmp-scaffold-"),
    );
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates .mstack/ directory structure", async () => {
    await scaffold();

    expect(fs.existsSync(path.join(tmpDir, ".mstack"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".mstack", "skills"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".mstack", "prompts"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".mstack", "knowledge"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".mstack", "workflows"))).toBe(true);
  });

  it("copies config and skill files", async () => {
    await scaffold();

    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "mstack.config.js")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "orchestrator.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "analysis.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "plan.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "implementation.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "review.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "test.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "document.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "ship.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".mstack", "skills", "mistake.md")),
    ).toBe(true);
  });

  it("copies universal prompt", async () => {
    await scaffold();

    expect(
      fs.existsSync(
        path.join(tmpDir, ".mstack", "prompts", "universal.md"),
      ),
    ).toBe(true);
  });

  it("creates knowledge skeletons", async () => {
    await scaffold();

    const mistakes = fs.readFileSync(
      path.join(tmpDir, ".mstack", "knowledge", "mistakes.md"),
      "utf8",
    );
    expect(mistakes).toContain("# Mistakes");

    const patterns = fs.readFileSync(
      path.join(tmpDir, ".mstack", "knowledge", "patterns.md"),
      "utf8",
    );
    expect(patterns).toContain("# Patterns");
  });

  it("installs slash command", async () => {
    await scaffold();

    expect(
      fs.existsSync(
        path.join(tmpDir, ".claude", "commands", "mstack.md"),
      ),
    ).toBe(true);

    const cmd = fs.readFileSync(
      path.join(tmpDir, ".claude", "commands", "mstack.md"),
      "utf8",
    );
    expect(cmd).toContain("$ARGUMENTS");
  });

  it("warns and exits if .mstack/ exists without --force", async () => {
    fs.mkdirSync(path.join(tmpDir, ".mstack"), { recursive: true });

    const consoleSpy = vi.spyOn(console, "log");
    await scaffold();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("already exists"),
    );
    consoleSpy.mockRestore();
  });

  it("re-scaffolds with --force, preserving knowledge and workflows", async () => {
    // First scaffold
    await scaffold();

    // Add content to knowledge
    fs.writeFileSync(
      path.join(tmpDir, ".mstack", "knowledge", "mistakes.md"),
      "# Mistakes\n\n## 2026-01-01: Custom mistake",
    );

    // Add a workflow dir
    fs.mkdirSync(
      path.join(tmpDir, ".mstack", "workflows", "test-workflow"),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        tmpDir,
        ".mstack",
        "workflows",
        "test-workflow",
        "workflow.md",
      ),
      "test",
    );

    // Force re-scaffold
    await scaffold({ force: true });

    // Knowledge preserved
    const mistakes = fs.readFileSync(
      path.join(tmpDir, ".mstack", "knowledge", "mistakes.md"),
      "utf8",
    );
    expect(mistakes).toContain("Custom mistake");

    // Workflow preserved
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          ".mstack",
          "workflows",
          "test-workflow",
          "workflow.md",
        ),
      ),
    ).toBe(true);

    // Config was overwritten (fresh default)
    const config = fs.readFileSync(
      path.join(tmpDir, ".mstack", "mstack.config.js"),
      "utf8",
    );
    expect(config).toContain("my-project");
  });
});
