import * as fs from "node:fs";
import * as path from "node:path";
import type { MstackConfig } from "./types.js";

export async function createSkill(
  config: MstackConfig,
  name: string,
): Promise<void> {
  const skillPath = path.join(
    process.cwd(),
    config.outputDir,
    "skills",
    `${name}.md`,
  );

  if (fs.existsSync(skillPath)) {
    console.log(`Skill already exists: ${skillPath}`);
    return;
  }

  // Ensure skills directory exists
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });

  const template = `---
name: ${name}
description: {one-line description}
---

# ${capitalize(name)}

## Identity

{1-2 sentences defining what this agent does — functional, not persona-based}

## Task

{specific instructions for what to do, numbered steps}

1. ...
2. ...
3. ...

## Constraints

- DO {required behaviors}
- DO NOT {prohibited behaviors}

## Output Format

{exact structure of what to produce}

## Red Flags

- "{rationalization the agent might generate}" — STOP. {why it's wrong}.
`;

  fs.writeFileSync(skillPath, template);

  console.log(`✓ Created skill: ${skillPath}`);
  console.log("");
  console.log("To use this skill, reference it in your config:");
  console.log(`  skill: "${name}"`);
  console.log("  or");
  console.log(`  skill: "./.mstack/skills/${name}.md"`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
