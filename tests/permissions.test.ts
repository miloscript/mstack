import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ensurePermissions } from "../src/utils/permissions.js";

describe("ensurePermissions", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-perms-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates .claude/settings.local.json when it does not exist", () => {
    ensurePermissions(["Bash(git:*)", "WebFetch"], tmpDir);

    const settingsPath = path.join(tmpDir, ".claude", "settings.local.json");
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(settings.permissions.allow).toEqual(["Bash(git:*)", "WebFetch"]);
  });

  it("merges into existing settings without removing user entries", () => {
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.local.json"),
      JSON.stringify({
        permissions: { allow: ["Bash(docker:*)", "WebSearch"] },
      }),
    );

    ensurePermissions(["Bash(git:*)", "WebSearch"], tmpDir);

    const settings = JSON.parse(
      fs.readFileSync(path.join(claudeDir, "settings.local.json"), "utf8"),
    );
    expect(settings.permissions.allow).toEqual([
      "Bash(docker:*)",
      "WebSearch",
      "Bash(git:*)",
    ]);
  });

  it("is idempotent — does not duplicate existing entries", () => {
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.local.json"),
      JSON.stringify({
        permissions: { allow: ["Bash(git:*)", "WebFetch"] },
      }),
    );

    ensurePermissions(["Bash(git:*)", "WebFetch"], tmpDir);

    const settings = JSON.parse(
      fs.readFileSync(path.join(claudeDir, "settings.local.json"), "utf8"),
    );
    expect(settings.permissions.allow).toEqual(["Bash(git:*)", "WebFetch"]);
  });

  it("does not write file when nothing needs to be added", () => {
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    const settingsPath = path.join(claudeDir, "settings.local.json");
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ permissions: { allow: ["Bash(git:*)"] } }),
    );
    const mtimeBefore = fs.statSync(settingsPath).mtimeMs;

    ensurePermissions(["Bash(git:*)"], tmpDir);

    const mtimeAfter = fs.statSync(settingsPath).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it("preserves other settings keys", () => {
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.local.json"),
      JSON.stringify({
        permissions: { allow: ["WebSearch"], deny: ["Bash(rm:*)"] },
        someOtherKey: true,
      }),
    );

    ensurePermissions(["Bash(git:*)"], tmpDir);

    const settings = JSON.parse(
      fs.readFileSync(path.join(claudeDir, "settings.local.json"), "utf8"),
    );
    expect(settings.someOtherKey).toBe(true);
    expect(settings.permissions.deny).toEqual(["Bash(rm:*)"]);
    expect(settings.permissions.allow).toEqual(["WebSearch", "Bash(git:*)"]);
  });

  it("handles empty permissions array as a no-op", () => {
    ensurePermissions([], tmpDir);

    const settingsPath = path.join(tmpDir, ".claude", "settings.local.json");
    expect(fs.existsSync(settingsPath)).toBe(false);
  });

  it("recovers from malformed JSON by backing up and starting fresh", () => {
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    const settingsPath = path.join(claudeDir, "settings.local.json");
    fs.writeFileSync(settingsPath, "{ broken json !!!");

    ensurePermissions(["Bash(git:*)"], tmpDir);

    // Backup should exist
    expect(fs.existsSync(settingsPath + ".bak")).toBe(true);
    // New settings should be valid
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(settings.permissions.allow).toEqual(["Bash(git:*)"]);
  });
});
