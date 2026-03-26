import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { MstackConfig, PhaseConfig } from "./types.js";

const VALID_MODES = ["prompt", "code", "interactive"] as const;

const PHASE_DEFAULTS: Partial<PhaseConfig> = {
  enabled: true,
  pre: [],
  post: [],
};

const CONFIG_DEFAULTS: Partial<MstackConfig> = {
  outputDir: ".mstack/",
  model: "claude-sonnet-4-6",
  orchestration: "code",
  permissionMode: "acceptEdits",
  maxRetries: 2,
  tdd: { enabled: true },
};

export async function loadConfig(configPath?: string): Promise<MstackConfig> {
  const resolvedPath = resolveConfigPath(configPath);
  if (!resolvedPath) {
    throw new Error(
      "No mstack config found. Run `mstack init` first.",
    );
  }

  // Use dynamic import with cache-busting query to ensure fresh reads
  const fileUrl = pathToFileURL(resolvedPath).href + `?t=${Date.now()}`;
  const imported = await import(fileUrl);
  const raw = (imported.default || imported) as Record<string, unknown>;

  return validateAndApplyDefaults(raw);
}

function resolveConfigPath(explicit?: string): string | null {
  if (explicit) {
    const abs = path.resolve(process.cwd(), explicit);
    if (fs.existsSync(abs)) return abs;
    throw new Error(`Config file not found: ${explicit}`);
  }

  // 1. .mstack/mstack.config.js
  const primary = path.join(process.cwd(), ".mstack", "mstack.config.js");
  if (fs.existsSync(primary)) return primary;

  // 2. mstack.config.js in cwd
  const fallback = path.join(process.cwd(), "mstack.config.js");
  if (fs.existsSync(fallback)) return fallback;

  return null;
}

function validateAndApplyDefaults(raw: Record<string, unknown>): MstackConfig {
  const config = { ...CONFIG_DEFAULTS, ...raw } as MstackConfig;

  // Validate required fields
  if (!config.name || typeof config.name !== "string") {
    throw new Error("Config error: `name` is required and must be a string.");
  }

  // Validate orchestration mode
  if (!VALID_MODES.includes(config.orchestration as typeof VALID_MODES[number])) {
    throw new Error(
      `Config error: \`orchestration\` must be one of: ${VALID_MODES.join(", ")}. Got: "${config.orchestration}"`,
    );
  }

  // Validate phases
  if (!config.phases || typeof config.phases !== "object") {
    throw new Error("Config error: `phases` is required and must be an object.");
  }

  for (const [name, phase] of Object.entries(config.phases)) {
    config.phases[name] = validatePhase(name, phase);
  }

  // Validate maxRetries
  if (typeof config.maxRetries !== "number" || config.maxRetries < 0) {
    config.maxRetries = 2;
  }

  // Validate tdd
  if (!config.tdd || typeof config.tdd !== "object") {
    config.tdd = { enabled: true };
  }

  return config;
}

function validatePhase(name: string, raw: Partial<PhaseConfig>): PhaseConfig {
  const phase = { ...PHASE_DEFAULTS, ...raw } as PhaseConfig;

  if (!phase.skill || typeof phase.skill !== "string") {
    throw new Error(
      `Config error: phase "${name}" must have a \`skill\` string.`,
    );
  }

  if (phase.orchestration && !VALID_MODES.includes(phase.orchestration as typeof VALID_MODES[number])) {
    throw new Error(
      `Config error: phase "${name}" has invalid orchestration mode: "${phase.orchestration}"`,
    );
  }

  if (phase.pre && !Array.isArray(phase.pre)) {
    throw new Error(`Config error: phase "${name}" \`pre\` must be an array.`);
  }
  if (phase.post && !Array.isArray(phase.post)) {
    throw new Error(`Config error: phase "${name}" \`post\` must be an array.`);
  }

  return phase;
}

export function getEnabledPhases(config: MstackConfig): [string, PhaseConfig][] {
  return Object.entries(config.phases).filter(([, phase]) => phase.enabled);
}
