import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  writePhaseOutput,
  writeErrorOutput,
} from "../src/utils/output-writer.js";
import type { PhaseConfig } from "../src/types.js";

function makePhaseConfig(): PhaseConfig {
  return {
    enabled: true,
    skill: "analysis",
    pre: [],
    post: [],
  };
}

describe("writePhaseOutput", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(import.meta.dirname, ".tmp-output-"),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes un-numbered output file when no phaseIndex given", () => {
    writePhaseOutput(
      tmpDir,
      "analysis",
      "Analysis result here",
      makePhaseConfig(),
      "user task",
    );

    expect(fs.existsSync(path.join(tmpDir, "analysis.md"))).toBe(true);
  });

  it("writes numbered output file when phaseIndex given", () => {
    writePhaseOutput(
      tmpDir,
      "analysis",
      "Analysis result here",
      makePhaseConfig(),
      "user task",
      undefined,
      1,
    );

    expect(fs.existsSync(path.join(tmpDir, "01-analysis.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "analysis.md"))).toBe(false);
  });

  it("pads single-digit phase index with leading zero", () => {
    writePhaseOutput(
      tmpDir,
      "plan",
      "Plan result here",
      makePhaseConfig(),
      "user task",
      undefined,
      2,
    );

    expect(fs.existsSync(path.join(tmpDir, "02-plan.md"))).toBe(true);
  });

  it("handles two-digit phase index", () => {
    writePhaseOutput(
      tmpDir,
      "document",
      "Document result here",
      makePhaseConfig(),
      "user task",
      undefined,
      10,
    );

    expect(fs.existsSync(path.join(tmpDir, "10-document.md"))).toBe(true);
  });

  it("includes agent result in output", () => {
    writePhaseOutput(
      tmpDir,
      "analysis",
      "The big finding",
      makePhaseConfig(),
      "user task",
    );

    const content = fs.readFileSync(
      path.join(tmpDir, "analysis.md"),
      "utf8",
    );
    expect(content).toContain("The big finding");
    expect(content).toContain("status: complete");
  });

  it("includes user feedback when present", () => {
    writePhaseOutput(
      tmpDir,
      "analysis",
      "Result",
      makePhaseConfig(),
      "user task",
      { analysis: "Please revise" },
    );

    const content = fs.readFileSync(
      path.join(tmpDir, "analysis.md"),
      "utf8",
    );
    expect(content).toContain("Please revise");
  });
});

describe("writeErrorOutput", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(import.meta.dirname, ".tmp-errout-"),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes un-numbered error file when no phaseIndex given", () => {
    writeErrorOutput(
      tmpDir,
      "analysis",
      "Something failed",
      makePhaseConfig(),
      "user task",
    );

    expect(fs.existsSync(path.join(tmpDir, "analysis.md"))).toBe(true);
    const content = fs.readFileSync(
      path.join(tmpDir, "analysis.md"),
      "utf8",
    );
    expect(content).toContain("status: failed");
    expect(content).toContain("Something failed");
  });

  it("writes numbered error file when phaseIndex given", () => {
    writeErrorOutput(
      tmpDir,
      "analysis",
      "Something failed",
      makePhaseConfig(),
      "user task",
      1,
    );

    expect(fs.existsSync(path.join(tmpDir, "01-analysis.md"))).toBe(true);
  });
});
