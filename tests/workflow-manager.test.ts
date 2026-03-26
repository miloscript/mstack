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
  resolveRunInput,
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
    expect(content).toContain("completed:");
    expect(content).toContain("# Workflow: Add auth");
    expect(content).toContain('"name": "test"');
    expect(content).toContain("## Phase Status");
    expect(content).toContain("## User Inputs");
    expect(content).toContain("## Task Body");
    expect(content).toContain("Add auth");
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

  it("updates status to complete and stamps completed timestamp", () => {
    const before = new Date();
    updateWorkflowFinalStatus(tmpDir, "complete");
    const after = new Date();

    const content = fs.readFileSync(
      path.join(tmpDir, "workflow.md"),
      "utf8",
    );
    expect(content).toContain("status: complete");
    expect(content).not.toContain("status: in-progress");
    const match = content.match(/completed: (.+)/);
    expect(match).not.toBeNull();
    const stamped = new Date(match![1].trim());
    expect(stamped.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(stamped.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("updates status to failed and stamps completed timestamp", () => {
    updateWorkflowFinalStatus(tmpDir, "failed");

    const content = fs.readFileSync(
      path.join(tmpDir, "workflow.md"),
      "utf8",
    );
    expect(content).toContain("status: failed");
    expect(content).not.toContain("status: in-progress");
    expect(content).toMatch(/completed: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
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

  it("prefers Task Body section over heading when present", () => {
    const md = `---\nworkflow: test\n---\n# Workflow: Short title\n\n## Task Body\n\nThis is a long\nmultiline task\n\n## Config`;
    expect(extractUserTask(md)).toBe("This is a long\nmultiline task");
  });
});

describe("resolveRunInput", () => {
  it("throws when neither task nor fileContent is provided", () => {
    expect(() => resolveRunInput({})).toThrow();
  });

  it("returns task as both title and userTask when only task provided", () => {
    const result = resolveRunInput({ task: "Add auth" });
    expect(result.title).toBe("Add auth");
    expect(result.userTask).toBe("Add auth");
  });

  it("uses fileStem as title and fileContent as userTask when only file provided", () => {
    const result = resolveRunInput({ fileContent: "Build a login form", fileStem: "login-spec" });
    expect(result.title).toBe("login-spec");
    expect(result.userTask).toBe("Build a login form");
  });

  it("uses task as title and combines both when task and fileContent are provided", () => {
    const result = resolveRunInput({ task: "Add auth", fileContent: "Detailed spec here", fileStem: "spec" });
    expect(result.title).toBe("Add auth");
    expect(result.userTask).toContain("Add auth");
    expect(result.userTask).toContain("Detailed spec here");
  });
});
