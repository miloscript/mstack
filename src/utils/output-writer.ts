import * as fs from "node:fs";
import * as path from "node:path";
import type { PhaseConfig } from "../types.js";

export function writePhaseOutput(
  workflowDir: string,
  phaseName: string,
  agentResult: string,
  phaseConfig: PhaseConfig,
  userTask: string,
  userFeedback?: Record<string, string>,
): void {
  const slug = path.basename(workflowDir);
  const model = phaseConfig.model || "default";

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

  fs.writeFileSync(path.join(workflowDir, `${phaseName}.md`), doc);
}

export function writeErrorOutput(
  workflowDir: string,
  phaseName: string,
  error: string,
  phaseConfig: PhaseConfig,
  userTask: string,
): void {
  const slug = path.basename(workflowDir);
  const model = phaseConfig.model || "default";

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

  fs.writeFileSync(path.join(workflowDir, `${phaseName}.md`), doc);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
