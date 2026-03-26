import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { MstackConfig } from "../src/types.js";
import { run } from "../src/runner.js";
import {
  createWorkflowDir,
  writeWorkflowRoot,
} from "../src/utils/workflow-manager.js";

describe("runner dispatch", () => {
  const origCwd = process.cwd();
  let tmpDir: string;

  function makeConfig(
    overrides: Partial<MstackConfig> = {},
  ): MstackConfig {
    return {
      name: "test-project",
      outputDir: ".mstack/",
      model: "claude-sonnet-4-6",
      orchestration: "code",
      phases: {
        analysis: {
          enabled: true,
          skill: "analysis",
          input: null,
          pre: [],
          post: [],
        },
      },
      maxRetries: 0,
      tdd: { enabled: true },
      ...overrides,
    };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-runner-"));
    process.chdir(tmpDir);

    // Set up minimal .mstack structure
    const mstackDir = path.join(tmpDir, ".mstack");
    fs.mkdirSync(path.join(mstackDir, "skills"), { recursive: true });
    fs.mkdirSync(path.join(mstackDir, "prompts"), { recursive: true });
    fs.mkdirSync(path.join(mstackDir, "knowledge"), { recursive: true });

    fs.writeFileSync(
      path.join(mstackDir, "skills", "analysis.md"),
      "# Analysis\n\n## Task\n\nAnalyze.\n\n## Constraints\n\n- None",
    );
    fs.writeFileSync(
      path.join(mstackDir, "prompts", "universal.md"),
      "# Universal\n\nPhase: {phase}",
    );
    fs.writeFileSync(
      path.join(mstackDir, "skills", "orchestrator.md"),
      "# Orchestrator\n\n## Task\n\nOrchestrate.",
    );
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs code mode and produces output files", async () => {
    const config = makeConfig();
    const slug = "2026-03-26-test-task";
    const workflowDir = createWorkflowDir(config, slug);
    writeWorkflowRoot(workflowDir, config, "test task");

    await run(config, "test task", workflowDir);

    // Should have created analysis.md output
    expect(
      fs.existsSync(path.join(workflowDir, "analysis.md")),
    ).toBe(true);

    const output = fs.readFileSync(
      path.join(workflowDir, "analysis.md"),
      "utf8",
    );
    expect(output).toContain("Mock agent output");

    // workflow.md should be updated
    const workflow = fs.readFileSync(
      path.join(workflowDir, "workflow.md"),
      "utf8",
    );
    expect(workflow).toContain("status: complete");
  });

  it("skips disabled phases", async () => {
    const config = makeConfig({
      phases: {
        analysis: {
          enabled: false,
          skill: "analysis",
          pre: [],
          post: [],
        },
        plan: {
          enabled: true,
          skill: "analysis", // reuse for simplicity
          input: null,
          pre: [],
          post: [],
        },
      },
    });

    // Create plan skill too
    fs.writeFileSync(
      path.join(tmpDir, ".mstack", "skills", "plan.md"),
      "# Plan",
    );

    const slug = "2026-03-26-test-skip";
    const workflowDir = createWorkflowDir(config, slug);
    writeWorkflowRoot(workflowDir, config, "test skip");

    await run(config, "test skip", workflowDir);

    // analysis should NOT exist
    expect(
      fs.existsSync(path.join(workflowDir, "analysis.md")),
    ).toBe(false);
    // plan should exist
    expect(
      fs.existsSync(path.join(workflowDir, "plan.md")),
    ).toBe(true);
  });

  it("dispatches to prompt mode", async () => {
    const config = makeConfig({ orchestration: "prompt" });
    const slug = "2026-03-26-prompt-test";
    const workflowDir = createWorkflowDir(config, slug);
    writeWorkflowRoot(workflowDir, config, "prompt test");

    // Should not throw — prompt mode calls SDK with orchestrator skill
    await run(config, "prompt test", workflowDir);
  });
});
