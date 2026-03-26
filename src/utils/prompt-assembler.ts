import * as fs from "node:fs";
import * as path from "node:path";
import type { MstackConfig, PhaseConfig } from "../types.js";
import { phaseFileName } from "./output-writer.js";

export interface AssemblePromptParams {
  universal: string;
  skill: string;
  inputs: Record<string, string>;
  knowledge: Record<string, string>;
  userTask: string;
  phaseName: string;
  workflowDir: string;
  config: MstackConfig;
  humanAttended?: boolean;
  /** 1-based position in the phase execution order; used to build the output path. */
  phaseIndex?: number;
}

export function assemblePrompt(params: AssemblePromptParams): string {
  const sections: string[] = [];

  // 1. Universal prompt — fill placeholders
  let universal = params.universal;
  universal = universal.replace(/\{phase\}/g, params.phaseName);
  universal = universal.replace(
    /\{workflow\}/g,
    path.basename(params.workflowDir),
  );
  universal = universal.replace(
    /\{maxRetries\}/g,
    String(params.config.maxRetries),
  );
  sections.push(universal);

  // 2. Skill file (with overrides applied)
  sections.push(params.skill);

  // 3. Input documents
  const allInputs = { ...params.inputs };

  // Auto-include initial-user-input.md if it exists in the workflow dir
  // (and not already in inputs)
  const specFilePath = path.join(params.workflowDir, "initial-user-input.md");
  if (
    fs.existsSync(specFilePath) &&
    !Object.prototype.hasOwnProperty.call(allInputs, "initial-user-input.md")
  ) {
    allInputs["initial-user-input.md"] = fs.readFileSync(specFilePath, "utf8");
  }

  if (Object.keys(allInputs).length > 0) {
    sections.push("---\n\n## Input Documents\n");
    for (const [name, content] of Object.entries(allInputs)) {
      sections.push(`### ${name}\n\n${content}\n`);
    }
  }

  // 4. Knowledge files
  if (Object.keys(params.knowledge).length > 0) {
    sections.push("---\n\n## Project Knowledge\n");
    for (const [name, content] of Object.entries(params.knowledge)) {
      // Only include knowledge files that have content beyond the skeleton
      if (content.trim().split("\n").length > 5) {
        sections.push(`### ${name}\n\n${content}\n`);
      }
    }
  }

  // 5. User task and metadata
  const outputFile = phaseFileName(params.phaseName, params.phaseIndex);
  sections.push(`---\n\n## User Task\n\n${params.userTask}`);
  sections.push(
    `\n## Workflow Metadata\n\n- Phase: ${params.phaseName}\n- Workflow: ${path.basename(params.workflowDir)}\n- Output path: ${params.workflowDir}/${outputFile}\n- TDD: ${params.config.tdd.enabled ? "enabled" : "disabled"}`,
  );

  if (params.humanAttended === false) {
    sections.push(
      `\n## Human Availability\n\nNo human is available during this phase. Do not attempt to ask questions — make reasonable decisions autonomously based on the context provided.`,
    );
  } else if (params.humanAttended === true) {
    sections.push(
      `\n## Human Availability\n\nA human is available during this phase. Use AskUserQuestion when you need clarification or approval.`,
    );
  }

  return sections.join("\n\n");
}

export function loadSkill(
  skillRef: string,
  overrides: PhaseConfig["overrides"],
  config: MstackConfig,
): string {
  const skillPath = resolveSkillPath(skillRef, config);
  let skill = fs.readFileSync(skillPath, "utf8");

  if (overrides?.constraints?.length) {
    const constraintBlock = overrides.constraints
      .map((c) => `- ${c}`)
      .join("\n");
    // Append after the ## Constraints section
    const replaced = skill.replace(
      /(## Constraints\n[\s\S]*?)(\n## )/,
      `$1\n${constraintBlock}\n$2`,
    );
    if (replaced !== skill) {
      skill = replaced;
    } else {
      // If Constraints is the last section, append at the end of the section
      skill = skill.replace(
        /(## Constraints\n[\s\S]*?)$/,
        `$1\n${constraintBlock}`,
      );
    }
  }

  if (overrides?.context) {
    skill = skill.replace(
      /## Task\n/,
      `## Task\n\n**Project context:** ${overrides.context}\n\n`,
    );
  }

  return skill;
}

export function resolveSkillPath(
  skillRef: string,
  config: MstackConfig,
): string {
  if (skillRef.startsWith("./")) {
    return path.resolve(process.cwd(), skillRef);
  }
  return path.join(process.cwd(), config.outputDir, "skills", `${skillRef}.md`);
}

export function resolvePromptPath(
  promptName: string,
  config: MstackConfig,
): string {
  return path.join(
    process.cwd(),
    config.outputDir,
    "prompts",
    `${promptName}.md`,
  );
}

/**
 * Resolves input file references to their content.
 *
 * Supports both plain filenames (e.g. `analysis.md`) and numbered filenames
 * (e.g. `01-analysis.md`). When the exact path is not found the function
 * falls back to any file matching `NN-{basename}.md` in the workflow dir.
 * This ensures backward compatibility for configs still using `"analysis.md"`
 * after the numbering feature was introduced.
 */
export function resolveInputs(
  input: PhaseConfig["input"],
  workflowDir: string,
): Record<string, string> {
  if (!input) return {};

  if (typeof input === "string") {
    const content = resolveOneInput(input, workflowDir);
    if (content !== null) {
      return { [input]: content };
    }
    return {};
  }

  // Record<string, string>
  const result: Record<string, string> = {};
  for (const [key, fileName] of Object.entries(input)) {
    const content = resolveOneInput(fileName, workflowDir);
    if (content !== null) {
      result[key] = content;
    }
  }
  return result;
}

/**
 * Attempts to read `fileName` from `workflowDir`.
 * Falls back to a `NN-{stem}.md` numbered variant when exact path is missing.
 * Returns null if neither exists.
 */
function resolveOneInput(fileName: string, workflowDir: string): string | null {
  // 1. Exact match
  const exactPath = path.join(workflowDir, fileName);
  if (fs.existsSync(exactPath)) {
    return fs.readFileSync(exactPath, "utf8");
  }

  // 2. Numbered fallback: look for any `NN-{stem}.md` file
  const stem = path.basename(fileName, ".md");
  const numberedPattern = new RegExp(`^\\d+-${escapeRegExp(stem)}\\.md$`);
  let files: string[];
  try {
    files = fs.readdirSync(workflowDir);
  } catch {
    return null;
  }
  const match = files.find((f) => numberedPattern.test(f));
  if (match) {
    return fs.readFileSync(path.join(workflowDir, match), "utf8");
  }

  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function loadKnowledge(config: MstackConfig): Record<string, string> {
  const knowledgeDir = path.join(process.cwd(), config.outputDir, "knowledge");
  if (!fs.existsSync(knowledgeDir)) return {};

  const result: Record<string, string> = {};
  for (const file of fs.readdirSync(knowledgeDir)) {
    if (file.endsWith(".md")) {
      result[file] = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
    }
  }
  return result;
}
