import * as fs from "node:fs";
import * as path from "node:path";
import type { MstackConfig, PhaseConfig } from "../types.js";

export interface AssemblePromptParams {
  universal: string;
  skill: string;
  inputs: Record<string, string>;
  knowledge: Record<string, string>;
  userTask: string;
  phaseName: string;
  workflowDir: string;
  config: MstackConfig;
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
  if (Object.keys(params.inputs).length > 0) {
    sections.push("---\n\n## Input Documents\n");
    for (const [name, content] of Object.entries(params.inputs)) {
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
  sections.push(`---\n\n## User Task\n\n${params.userTask}`);
  sections.push(
    `\n## Workflow Metadata\n\n- Phase: ${params.phaseName}\n- Workflow: ${path.basename(params.workflowDir)}\n- Output path: ${params.workflowDir}/${params.phaseName}.md\n- TDD: ${params.config.tdd.enabled ? "enabled" : "disabled"}`,
  );

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
  return path.join(
    process.cwd(),
    config.outputDir,
    "skills",
    `${skillRef}.md`,
  );
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

export function resolveInputs(
  input: PhaseConfig["input"],
  workflowDir: string,
): Record<string, string> {
  if (!input) return {};

  if (typeof input === "string") {
    const filePath = path.join(workflowDir, input);
    if (fs.existsSync(filePath)) {
      return { [input]: fs.readFileSync(filePath, "utf8") };
    }
    return {};
  }

  // Record<string, string>
  const result: Record<string, string> = {};
  for (const [key, fileName] of Object.entries(input)) {
    const filePath = path.join(workflowDir, fileName);
    if (fs.existsSync(filePath)) {
      result[key] = fs.readFileSync(filePath, "utf8");
    }
  }
  return result;
}

export function loadKnowledge(
  config: MstackConfig,
): Record<string, string> {
  const knowledgeDir = path.join(
    process.cwd(),
    config.outputDir,
    "knowledge",
  );
  if (!fs.existsSync(knowledgeDir)) return {};

  const result: Record<string, string> = {};
  for (const file of fs.readdirSync(knowledgeDir)) {
    if (file.endsWith(".md")) {
      result[file] = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
    }
  }
  return result;
}
