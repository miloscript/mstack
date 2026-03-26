import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  generateSlug,
  createWorkflowDir,
  writeWorkflowRoot,
  updateWorkflowStatus,
  updateWorkflowFinalStatus,
  getCompletedPhases,
  extractUserTask,
  recordUserInput,
} from "../src/utils/workflow-manager.js";
import type { MstackConfig } from "../src/types.js";

describe("generateSlug", () => {
  it("generates date-prefixed slug", () => {
    const slug = generateSlug("Add JWT auth to API");
    const datePrefix = new Date().toISOString().split("T")[0];
    expect(slug).toMatch(new RegExp(`^${datePrefix}-`));
    expect(slug).toContain("add-jwt-auth-to-api");
  });

  it("removes special characters", () => {
    const slug = generateSlug("Fix bug #123 (urgent!)");
    expect(slug).not.toContain("#");
    expect(slug).not.toContain("(");
    expect(slug).not.toContain("!");
  });

  it("truncates long task descriptions", () => {
    const longTask = "a".repeat(100);
    const slug = generateSlug(longTask);
    // Date prefix (11 chars) + slug (50 chars max)
    expect(slug.length).toBeLessThanOrEqual(61);
  });
});

describe("createWorkflowDir", () => {
  const origCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-wfdir-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates workflow directory", () => {
    const config: MstackConfig = {
      name: "test",
      outputDir: ".mstack/",
      model: "claude-sonnet-4-6",
      orchestration: "code",
      phases: {},
      maxRetries: 2,
      tdd: { enabled: true },
    };

    const dir = createWorkflowDir(config, "2026-03-26-test");
    expect(fs.existsSync(dir)).toBe(true);
    expect(dir).toContain("2026-03-26-test");
  });
});

describe("writeWorkflowRoot", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-wfroot-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes workflow.md with frontmatter and config", () => {
    const config: MstackConfig = {
      name: "test",
      outputDir: ".mstack/",
      model: "claude-sonnet-4-6",
      orchestration: "code",
      phases: {},
      maxRetries: 2,
      tdd: { enabled: true },
    };

    writeWorkflowRoot(tmpDir, config, "Add auth");

    const content = fs.readFileSync(
      path.join(tmpDir, "workflow.md"),
      "utf8",
    );
    expect(content).toContain("status: in-progress");
    expect(content).toContain("# Workflow: Add auth");
    expect(content).toContain('"name": "test"');
    expect(content).toContain("## Phase Status");
    expect(content).toContain("## User Inputs");
  });
});

describe("updateWorkflowStatus", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-wfstatus-"));
    const config: MstackConfig = {
      name: "test",
      outputDir: ".mstack/",
      model: "claude-sonnet-4-6",
      orchestration: "code",
      phases: {},
      maxRetries: 2,
      tdd: { enabled: true },
    };
    writeWorkflowRoot(tmpDir, config, "task");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends phase status row", () => {
    updateWorkflowStatus(tmpDir, "analysis", "complete", "claude-sonnet-4-6");

    const content = fs.readFileSync(
      path.join(tmpDir, "workflow.md"),
      "utf8",
    );
    expect(content).toContain("| analysis | complete |");
  });
});

describe("updateWorkflowFinalStatus", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-wffinal-"));
    const config: MstackConfig = {
      name: "test",
      outputDir: ".mstack/",
      model: "claude-sonnet-4-6",
      orchestration: "code",
      phases: {},
      maxRetries: 2,
      tdd: { enabled: true },
    };
    writeWorkflowRoot(tmpDir, config, "task");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("updates status to complete", () => {
    updateWorkflowFinalStatus(tmpDir, "complete");

    const content = fs.readFileSync(
      path.join(tmpDir, "workflow.md"),
      "utf8",
    );
    expect(content).toContain("status: complete");
    expect(content).not.toContain("status: in-progress");
  });
});

describe("recordUserInput", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-wfinput-"));
    const config: MstackConfig = {
      name: "test",
      outputDir: ".mstack/",
      model: "claude-sonnet-4-6",
      orchestration: "code",
      phases: {},
      maxRetries: 2,
      tdd: { enabled: true },
    };
    writeWorkflowRoot(tmpDir, config, "task");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("records user feedback", () => {
    recordUserInput(tmpDir, "analysis", "post", "Use UUID tokens");

    const content = fs.readFileSync(
      path.join(tmpDir, "workflow.md"),
      "utf8",
    );
    expect(content).toContain('**analysis (post):** "Use UUID tokens"');
  });
});

describe("getCompletedPhases", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-wfphases-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists completed phases from output files", () => {
    fs.writeFileSync(path.join(tmpDir, "workflow.md"), "root");
    fs.writeFileSync(path.join(tmpDir, "analysis.md"), "done");
    fs.writeFileSync(path.join(tmpDir, "plan.md"), "done");

    const phases = getCompletedPhases(tmpDir);
    expect(phases).toContain("analysis");
    expect(phases).toContain("plan");
    expect(phases).not.toContain("workflow");
  });
});

describe("extractUserTask", () => {
  it("extracts task from workflow heading", () => {
    const md = `---\nworkflow: test\n---\n# Workflow: Add JWT auth\n\n## Config`;
    expect(extractUserTask(md)).toBe("Add JWT auth");
  });

  it("returns fallback for missing heading", () => {
    expect(extractUserTask("no heading")).toBe("Unknown task");
  });
});
