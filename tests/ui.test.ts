import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSpinner, formatDuration, formatPhaseHeader } from "../src/utils/ui.js";

describe("formatDuration", () => {
  it("formats sub-second durations", () => {
    expect(formatDuration(500)).toBe("0s");
  });

  it("formats whole seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(30000)).toBe("30s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60000)).toBe("1m0s");
    expect(formatDuration(65000)).toBe("1m5s");
    expect(formatDuration(125000)).toBe("2m5s");
  });
});

describe("formatPhaseHeader", () => {
  it("includes phase name", () => {
    const result = formatPhaseHeader("analysis", false);
    expect(result).toContain("analysis");
  });

  it("includes (interactive) suffix for interactive mode", () => {
    const result = formatPhaseHeader("plan", true);
    expect(result).toContain("plan");
    expect(result).toContain("interactive");
  });

  it("does not include (interactive) for non-interactive mode", () => {
    const result = formatPhaseHeader("analysis", false);
    expect(result).not.toContain("interactive");
  });
});

describe("createSpinner", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("returns object with start, stop, fail, clear methods", () => {
    const spinner = createSpinner("Loading");
    expect(typeof spinner.start).toBe("function");
    expect(typeof spinner.stop).toBe("function");
    expect(typeof spinner.fail).toBe("function");
    expect(typeof spinner.clear).toBe("function");
  });

  it("clear() writes ANSI erase-line sequence to stdout", () => {
    const spinner = createSpinner("Loading");
    spinner.clear();
    const calls = stdoutSpy.mock.calls.map((c) => c[0]);
    // Should write a carriage return or erase sequence
    expect(calls.some((c) => String(c).includes("\r") || String(c).includes("\x1b["))).toBe(true);
  });

  it("stop() is idempotent — can be called multiple times safely", () => {
    const spinner = createSpinner("Loading");
    expect(() => {
      spinner.stop();
      spinner.stop();
      spinner.stop();
    }).not.toThrow();
  });

  it("fail() is idempotent — can be called multiple times safely", () => {
    const spinner = createSpinner("Loading");
    expect(() => {
      spinner.fail("error message");
      spinner.fail("error message");
    }).not.toThrow();
  });

  it("fail() writes error message to stderr", () => {
    const spinner = createSpinner("Loading");
    spinner.fail("Something went wrong");
    const calls = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("Something went wrong"))).toBe(true);
  });
});
