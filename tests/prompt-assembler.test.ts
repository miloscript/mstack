import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  assemblePrompt,
  loadSkill,
  resolveInputs,
  loadKnowledge,
} from "../src/utils/prompt-assembler.js";
import type { MstackConfig } from "../src/types.js";

describe("assemblePrompt", () => {
  it("assembles all sections in order", () => {
    const result = assemblePrompt({
      universal: "# Universal\n\nPhase: {phase}, Workflow: {workflow}, Retries: {maxRetries}",
      skill: "# Skill\n\nDo the thing.",
      inputs: { "analysis.md": "Analysis content here" },
      knowledge: {
        "patterns.md":
          "# Patterns\n\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6",
      },
      userTask: "Add JWT auth",
      phaseName: "plan",
      workflowDir: "/tmp/workflows/2026-03-26-add-jwt-auth",
      config: {
        name: "test",
        outputDir: ".mstack/",
        model: "claude-sonnet-4-6",
        orchestration: "code",
        phases: {},
        maxRetries: 2,
        tdd: { enabled: true },
      },
    });

    // Universal prompt with placeholders filled
    expect(result).toContain("Phase: plan");
    expect(result).toContain("Workflow: 2026-03-26-add-jwt-auth");
    expect(result).toContain("Retries: 2");

    // Skill
    expect(result).toContain("# Skill");

    // Inputs
    expect(result).toContain("## Input Documents");
    expect(result).toContain("### analysis.md");
    expect(result).toContain("Analysis content here");

    // Knowledge
    expect(result).toContain("## Project Knowledge");
    expect(result).toContain("### patterns.md");

    // User task
    expect(result).toContain("## User Task");
    expect(result).toContain("Add JWT auth");

    // Metadata
    expect(result).toContain("Phase: plan");
    expect(result).toContain("TDD: enabled");
  });

  it("skips empty knowledge files", () => {
    const result = assemblePrompt({
      universal: "Universal",
      skill: "Skill",
      inputs: {},
      knowledge: {
        "mistakes.md": "# Mistakes\n\n<!-- skeleton -->",
      },
      userTask: "task",
      phaseName: "analysis",
      workflowDir: "/tmp/wf",
      config: {
        name: "test",
        outputDir: ".mstack/",
        model: "claude-sonnet-4-6",
        orchestration: "code",
        phases: {},
        maxRetries: 2,
        tdd: { enabled: false },
      },
    });

    expect(result).not.toContain("### mistakes.md");
    expect(result).toContain("TDD: disabled");
  });

  it("skips input section when no inputs", () => {
    const result = assemblePrompt({
      universal: "Universal",
      skill: "Skill",
      inputs: {},
      knowledge: {},
      userTask: "task",
      phaseName: "analysis",
      workflowDir: "/tmp/wf",
      config: {
        name: "test",
        outputDir: ".mstack/",
        model: "claude-sonnet-4-6",
        orchestration: "code",
        phases: {},
        maxRetries: 2,
        tdd: { enabled: true },
      },
    });

    expect(result).not.toContain("## Input Documents");
  });
});

describe("loadSkill", () => {
  const origCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-skill-"));
    process.chdir(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".mstack", "skills"), { recursive: true });
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const config: MstackConfig = {
    name: "test",
    outputDir: ".mstack/",
    model: "claude-sonnet-4-6",
    orchestration: "code",
    phases: {},
    maxRetries: 2,
    tdd: { enabled: true },
  };

  it("loads a skill by name", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".mstack", "skills", "analysis.md"),
      "# Analysis\n\n## Task\n\nDo analysis.\n\n## Constraints\n\n- Be thorough",
    );

    const skill = loadSkill("analysis", undefined, config);
    expect(skill).toContain("# Analysis");
  });

  it("loads a skill by relative path", () => {
    fs.writeFileSync(
      path.join(tmpDir, "custom-skill.md"),
      "# Custom Skill",
    );

    const skill = loadSkill("./custom-skill.md", undefined, config);
    expect(skill).toContain("# Custom Skill");
  });

  it("merges constraint overrides", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".mstack", "skills", "plan.md"),
      "# Plan\n\n## Constraints\n\n- Original constraint\n\n## Output Format\n\nDone",
    );

    const skill = loadSkill(
      "plan",
      { constraints: ["Extra constraint 1", "Extra constraint 2"] },
      config,
    );
    expect(skill).toContain("- Extra constraint 1");
    expect(skill).toContain("- Extra constraint 2");
    expect(skill).toContain("- Original constraint");
  });

  it("merges context overrides", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".mstack", "skills", "impl.md"),
      "# Impl\n\n## Task\n\nWrite code.\n\n## Constraints\n\n- None",
    );

    const skill = loadSkill(
      "impl",
      { context: "This is a Node.js project using Express." },
      config,
    );
    expect(skill).toContain("**Project context:** This is a Node.js project using Express.");
  });
});

describe("resolveInputs", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-inputs-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty for null input", () => {
    expect(resolveInputs(null, tmpDir)).toEqual({});
    expect(resolveInputs(undefined, tmpDir)).toEqual({});
  });

  it("resolves a single string input", () => {
    fs.writeFileSync(path.join(tmpDir, "analysis.md"), "Analysis output");

    const result = resolveInputs("analysis.md", tmpDir);
    expect(result).toEqual({ "analysis.md": "Analysis output" });
  });

  it("resolves record inputs", () => {
    fs.writeFileSync(path.join(tmpDir, "plan.md"), "Plan output");
    fs.writeFileSync(path.join(tmpDir, "impl.md"), "Impl output");

    const result = resolveInputs(
      { plan: "plan.md", impl: "impl.md" },
      tmpDir,
    );
    expect(result).toEqual({
      plan: "Plan output",
      impl: "Impl output",
    });
  });

  it("skips missing input files", () => {
    const result = resolveInputs("nonexistent.md", tmpDir);
    expect(result).toEqual({});
  });

  it("falls back to numbered file when exact path not found (string input)", () => {
    // Config says "analysis.md" but file on disk is "01-analysis.md"
    fs.writeFileSync(path.join(tmpDir, "01-analysis.md"), "Numbered analysis output");

    const result = resolveInputs("analysis.md", tmpDir);
    expect(result).toEqual({ "analysis.md": "Numbered analysis output" });
  });

  it("falls back to numbered file for record inputs", () => {
    fs.writeFileSync(path.join(tmpDir, "02-plan.md"), "Numbered plan output");

    const result = resolveInputs({ plan: "plan.md" }, tmpDir);
    expect(result).toEqual({ plan: "Numbered plan output" });
  });

  it("prefers exact path over numbered fallback", () => {
    fs.writeFileSync(path.join(tmpDir, "analysis.md"), "Exact match");
    fs.writeFileSync(path.join(tmpDir, "01-analysis.md"), "Numbered");

    const result = resolveInputs("analysis.md", tmpDir);
    expect(result).toEqual({ "analysis.md": "Exact match" });
  });
});

describe("assemblePrompt with initial-user-input.md", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(import.meta.dirname, ".tmp-spec-"),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const baseConfig: MstackConfig = {
    name: "test",
    outputDir: ".mstack/",
    model: "claude-sonnet-4-6",
    orchestration: "code",
    phases: {},
    maxRetries: 2,
    tdd: { enabled: true },
  };

  it("includes initial-user-input.md content if present in workflowDir", () => {
    fs.writeFileSync(
      path.join(tmpDir, "initial-user-input.md"),
      "This is the original spec content",
    );

    const result = assemblePrompt({
      universal: "Universal",
      skill: "Skill",
      inputs: {},
      knowledge: {},
      userTask: "short task title",
      phaseName: "implementation",
      workflowDir: tmpDir,
      config: baseConfig,
    });

    expect(result).toContain("initial-user-input.md");
    expect(result).toContain("This is the original spec content");
  });

  it("does not include spec section when initial-user-input.md does not exist", () => {
    const result = assemblePrompt({
      universal: "Universal",
      skill: "Skill",
      inputs: {},
      knowledge: {},
      userTask: "task",
      phaseName: "analysis",
      workflowDir: tmpDir,
      config: baseConfig,
    });

    expect(result).not.toContain("initial-user-input.md");
  });

  it("includes phaseIndex in output path metadata when provided", () => {
    const result = assemblePrompt({
      universal: "Universal",
      skill: "Skill",
      inputs: {},
      knowledge: {},
      userTask: "task",
      phaseName: "analysis",
      workflowDir: tmpDir,
      config: baseConfig,
      phaseIndex: 1,
    });

    expect(result).toContain("01-analysis.md");
  });

  it("uses plain filename in output path when phaseIndex not provided", () => {
    const result = assemblePrompt({
      universal: "Universal",
      skill: "Skill",
      inputs: {},
      knowledge: {},
      userTask: "task",
      phaseName: "analysis",
      workflowDir: tmpDir,
      config: baseConfig,
    });

    expect(result).toContain("analysis.md");
    expect(result).not.toContain("01-analysis.md");
  });
});

describe("loadKnowledge", () => {
  const origCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-knowledge-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads all .md files from knowledge dir", () => {
    const knowledgeDir = path.join(tmpDir, ".mstack", "knowledge");
    fs.mkdirSync(knowledgeDir, { recursive: true });
    fs.writeFileSync(path.join(knowledgeDir, "mistakes.md"), "# Mistakes");
    fs.writeFileSync(path.join(knowledgeDir, "patterns.md"), "# Patterns");
    fs.writeFileSync(path.join(knowledgeDir, "not-md.txt"), "ignored");

    const config: MstackConfig = {
      name: "test",
      outputDir: ".mstack/",
      model: "claude-sonnet-4-6",
      orchestration: "code",
      phases: {},
      maxRetries: 2,
      tdd: { enabled: true },
    };

    const result = loadKnowledge(config);
    expect(Object.keys(result)).toEqual(["mistakes.md", "patterns.md"]);
    expect(result["mistakes.md"]).toContain("# Mistakes");
  });

  it("returns empty if knowledge dir doesn't exist", () => {
    const config: MstackConfig = {
      name: "test",
      outputDir: ".mstack/",
      model: "claude-sonnet-4-6",
      orchestration: "code",
      phases: {},
      maxRetries: 2,
      tdd: { enabled: true },
    };

    expect(loadKnowledge(config)).toEqual({});
  });
});
