import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, getEnabledPhases } from "../src/config.js";

const FIXTURES = path.join(import.meta.dirname, "fixtures");

describe("loadConfig", () => {
  const origCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-config-"));
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads config from explicit path", async () => {
    const configPath = path.join(FIXTURES, "sample-config.js");
    process.chdir(tmpDir);
    const config = await loadConfig(configPath);

    expect(config.name).toBe("test-project");
    expect(config.orchestration).toBe("code");
    expect(config.maxRetries).toBe(1);
    expect(config.tdd.enabled).toBe(false);
  });

  it("loads config from .mstack/mstack.config.js", async () => {
    const mstackDir = path.join(tmpDir, ".mstack");
    fs.mkdirSync(mstackDir, { recursive: true });
    fs.copyFileSync(
      path.join(FIXTURES, "sample-config.js"),
      path.join(mstackDir, "mstack.config.js"),
    );
    process.chdir(tmpDir);

    const config = await loadConfig();
    expect(config.name).toBe("test-project");
  });

  it("loads config from mstack.config.js in cwd", async () => {
    fs.copyFileSync(
      path.join(FIXTURES, "sample-config.js"),
      path.join(tmpDir, "mstack.config.js"),
    );
    process.chdir(tmpDir);

    const config = await loadConfig();
    expect(config.name).toBe("test-project");
  });

  it("throws when no config found", async () => {
    process.chdir(tmpDir);
    await expect(loadConfig()).rejects.toThrow("No mstack config found");
  });

  it("throws for invalid orchestration mode", async () => {
    const badConfig = path.join(tmpDir, "bad.config.js");
    fs.writeFileSync(
      badConfig,
      `export default { name: "x", orchestration: "bad", phases: { a: { skill: "a" } } };`,
    );
    process.chdir(tmpDir);
    await expect(loadConfig(badConfig)).rejects.toThrow("orchestration");
  });

  it("throws for missing name", async () => {
    const badConfig = path.join(tmpDir, "bad.config.js");
    fs.writeFileSync(
      badConfig,
      `export default { phases: { a: { skill: "a" } } };`,
    );
    process.chdir(tmpDir);
    await expect(loadConfig(badConfig)).rejects.toThrow("name");
  });

  it("applies default values", async () => {
    const minConfig = path.join(tmpDir, "min.config.js");
    fs.writeFileSync(
      minConfig,
      `export default { name: "minimal", phases: { a: { skill: "a" } } };`,
    );
    process.chdir(tmpDir);

    const config = await loadConfig(minConfig);
    expect(config.outputDir).toBe(".mstack/");
    expect(config.model).toBe("claude-sonnet-4-6");
    expect(config.orchestration).toBe("code");
    expect(config.maxRetries).toBe(2);
    expect(config.tdd.enabled).toBe(true);
  });
});

describe("getEnabledPhases", () => {
  it("filters out disabled phases", async () => {
    const configPath = path.join(FIXTURES, "sample-config.js");
    const origCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-phases-"));
    process.chdir(tmpDir);

    try {
      const config = await loadConfig(configPath);
      const enabled = getEnabledPhases(config);

      expect(enabled.map(([name]) => name)).toEqual([
        "analysis",
        "plan",
        "implementation",
      ]);
      expect(enabled.find(([name]) => name === "review")).toBeUndefined();
    } finally {
      process.chdir(origCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
