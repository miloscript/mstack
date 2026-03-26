import * as fs from "node:fs";
import * as path from "node:path";

interface SettingsJson {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  [key: string]: unknown;
}

/**
 * Ensures all required permission patterns are present in .claude/settings.local.json.
 * Merges into existing settings — never removes user-added entries.
 */
export function ensurePermissions(
  requiredPermissions: string[],
  cwd: string = process.cwd(),
): void {
  if (!requiredPermissions.length) return;

  const claudeDir = path.join(cwd, ".claude");
  const settingsPath = path.join(claudeDir, "settings.local.json");

  // Read existing settings or start fresh
  let settings: SettingsJson = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      // Malformed JSON — back it up and start fresh
      const backup = settingsPath + ".bak";
      fs.copyFileSync(settingsPath, backup);
      console.log(`  ⚠ Backed up malformed settings.local.json to ${backup}`);
    }
  }

  // Ensure structure exists
  if (!settings.permissions) {
    settings.permissions = {};
  }
  if (!Array.isArray(settings.permissions.allow)) {
    settings.permissions.allow = [];
  }

  // Merge — only add patterns not already present
  const existing = new Set(settings.permissions.allow);
  const added: string[] = [];
  for (const perm of requiredPermissions) {
    if (!existing.has(perm)) {
      settings.permissions.allow.push(perm);
      added.push(perm);
    }
  }

  if (added.length === 0) return; // Nothing to do

  // Ensure .claude/ directory exists
  fs.mkdirSync(claudeDir, { recursive: true });

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(
    `  ✓ Added ${added.length} permission(s) to .claude/settings.local.json`,
  );
}
