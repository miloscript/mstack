import * as fs from "node:fs";
import * as path from "node:path";
import type { PhaseConfig } from "../types.js";

/**
 * Derives the output filename for a phase.
 * If phaseIndex is given, prefixes with zero-padded number (e.g. "01-analysis.md").
 * Otherwise uses the plain name (e.g. "analysis.md") for backward compat.
 */
export function phaseFileName(phaseName: string, phaseIndex?: number): string {
  if (phaseIndex !== undefined && phaseIndex > 0) {
    return `${String(phaseIndex).padStart(2, "0")}-${phaseName}.md`;
  }
  return `${phaseName}.md`;
}

export function writePhaseOutput(
  workflowDir: string,
  phaseName: string,
  agentResult: string,
  phaseConfig: PhaseConfig,
  userTask: string,
  userFeedback?: Record<string, string>,
  phaseIndex?: number,
): void {
  const slug = path.basename(workflowDir);
  const model = phaseConfig.model || "default";
  const fileName = phaseFileName(phaseName, phaseIndex);

  const doc = `---
phase: ${phaseName}
workflow: ${slug}
timestamp: ${new Date().toISOString()}
model: ${model}
status: complete
---
# ${capitalize(phaseName)} — ${slug}

## User Input

> ${userTask}
${userFeedback?.[phaseName] ? `\n> **User feedback:** ${userFeedback[phaseName]}` : ""}

## Output

${agentResult}
`;

  fs.writeFileSync(path.join(workflowDir, fileName), doc);
}

export function writeErrorOutput(
  workflowDir: string,
  phaseName: string,
  error: string,
  phaseConfig: PhaseConfig,
  userTask: string,
  phaseIndex?: number,
): void {
  const slug = path.basename(workflowDir);
  const model = phaseConfig.model || "default";
  const fileName = phaseFileName(phaseName, phaseIndex);

  const doc = `---
phase: ${phaseName}
workflow: ${slug}
timestamp: ${new Date().toISOString()}
model: ${model}
status: failed
---
# ${capitalize(phaseName)} — ${slug}

## User Input

> ${userTask}

## Error

${error}
`;

  fs.writeFileSync(path.join(workflowDir, fileName), doc);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
