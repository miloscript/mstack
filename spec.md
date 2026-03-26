# mstack — Development Specification

> **Purpose of this document:** This is a complete, implementation-ready specification for **mstack** — a config-driven, skill-based agentic dev workflow CLI built on top of Claude Code. This spec is designed to be fed into a Claude Code instance that will build the MVP from scratch. Every file, interface, algorithm, and default content is specified here. Nothing should require guesswork.

---

## 1. What mstack Is

mstack is an npm CLI tool that orchestrates multi-phase AI development workflows using Claude Code as its runtime. The user describes a task ("add JWT auth to the API"), and mstack drives it through configurable phases — analysis, planning, implementation, review, testing, and shipping — each executed by a separate Claude Code agent with fresh context.

**Core idea:** The workflow is defined as a JS config object (like `webpack.config`), not hardcoded in prose. Phases, skills, hooks, models, and behavior are all declarable and overridable.

### Design Philosophy

1. **Config-driven** — The workflow is a data structure. Changing what phases run, in what order, with what model, is a config change — not a prompt rewrite.
2. **Start simple, extend later** — Sequential execution, single model default, no parallelism. The architecture supports future complexity (worktrees, multi-model, parallel agents) but doesn't require it on day one.
3. **Brownfield-first** — Existing codebases are the default. The system explores before proposing, searches before building, and accumulates knowledge over time.

### What It Is NOT

- Not an execution engine or state machine — Claude is the runtime
- Not an agent framework — it uses the Claude Code SDK
- Not an API wrapper — it's a scaffolding + launcher tool
- Not a process manager — one sub-agent at a time (v1)

---

## 2. MVP Scope

### In Scope (v1)

- npm package with CLI binary
- `mstack init` — scaffold `.mstack/` directory with defaults
- `mstack run <task>` — launch a workflow
- `mstack resume <workflow>` — resume interrupted workflow
- `mstack status [workflow]` — print phase completion status
- `mstack create-skill <name>` — scaffold a custom skill file
- Three orchestration modes: `"prompt"`, `"code"`, `"interactive"`
- Eight default phases: init, analysis, plan, implementation, review, test, document, ship
- Default skill files for each phase + orchestrator
- Universal prompt template
- Config-driven phase toggling, ordering, model selection, input routing, hooks
- Human checkpoints (`pre`/`post` hooks with `"human"`)
- Knowledge accumulation (simple Markdown files)
- TDD by default (configurable)
- Adversarial review with fresh context
- Anti-sycophancy/anti-rationalization in skill Red Flags
- Error handling: retry twice, then stop
- Filesystem-based state (output docs = truth)
- Slash command entry point (`/mstack` inside Claude Code)

### Out of Scope (v2 — deferred)

- Parallel execution / git worktrees
- Cross-model review
- Full anti-rationalization tables (heavy prompt additions)
- PreToolUse hooks (`/careful`, `/freeze`, `/guard` style)
- Context window monitoring
- Confidence gating
- Task decomposition / wave execution
- JSONL knowledge base
- Skill weighting / priority scoring
- Multi-runtime support (Cursor, Codex, etc.)
- Homebrew distribution
- npm publishing pipeline, versioning strategy, and release process
- Skill/prompt update propagation — mechanism to sync updated defaults from the npm package into existing projects without overwriting local customizations (likely a hybrid approach where defaults load from the package and local files act as overrides)

---

## 3. Project Structure (npm Package Source)

```
mstack/
├── package.json
├── tsconfig.json
├── README.md
├── bin/
│   └── mstack.ts                    # CLI entry point (thin)
├── src/
│   ├── index.ts                     # main exports
│   ├── cli.ts                       # command parser (yargs or commander)
│   ├── config.ts                    # config loader + validation
│   ├── runner.ts                    # orchestration mode dispatcher
│   ├── modes/
│   │   ├── prompt.ts                # "prompt" mode runner
│   │   ├── code.ts                  # "code" mode runner
│   │   └── interactive.ts           # "interactive" mode runner
│   ├── scaffold.ts                  # `mstack init` scaffolding logic
│   ├── resume.ts                    # `mstack resume` logic
│   ├── status.ts                    # `mstack status` logic
│   ├── skill-builder.ts             # `mstack create-skill` logic
│   ├── utils/
│   │   ├── prompt-assembler.ts      # assembles universal + skill + inputs + overrides
│   │   ├── output-writer.ts         # writes phase output docs with template
│   │   ├── workflow-manager.ts      # creates workflow dirs, updates workflow.md
│   │   └── human-checkpoint.ts      # terminal prompt for human input (code/interactive modes)
│   └── types.ts                     # TypeScript interfaces
├── defaults/
│   ├── mstack.config.js             # default config file (copied on init)
│   ├── skills/
│   │   ├── orchestrator.md
│   │   ├── init.md
│   │   ├── analysis.md
│   │   ├── plan.md
│   │   ├── implementation.md
│   │   ├── review.md
│   │   ├── test.md
│   │   ├── document.md
│   │   └── ship.md
│   ├── prompts/
│   │   └── universal.md
│   └── commands/
│       └── mstack.md                # Claude Code slash command
└── tests/
    ├── config.test.ts
    ├── scaffold.test.ts
    ├── prompt-assembler.test.ts
    ├── runner.test.ts
    └── fixtures/
        └── sample-config.js
```

---

## 4. What `mstack init` Scaffolds (In the User's Project)

When a user runs `mstack init` in their project, it creates:

```
.mstack/
├── mstack.config.js                 # default config (editable)
├── skills/                          # skill files (one per phase + orchestrator)
│   ├── orchestrator.md
│   ├── init.md
│   ├── analysis.md
│   ├── plan.md
│   ├── implementation.md
│   ├── review.md
│   ├── test.md
│   ├── document.md
│   └── ship.md
├── prompts/
│   └── universal.md                 # universal prompt template
├── knowledge/                       # accumulated knowledge (populated over time)
│   ├── mistakes.md                  # empty skeleton
│   └── patterns.md                  # empty skeleton
└── workflows/                       # workflow output dirs (created per run)
```

It also installs the slash command:

```
.claude/
└── commands/
    └── mstack.md                    # Claude Code custom command
```

If `.mstack/` already exists, `mstack init` should warn and exit (no overwrite). Use `mstack init --force` to re-scaffold (preserves `knowledge/` and `workflows/`, overwrites everything else).

---

## 5. Config Schema

### TypeScript Interface

```typescript
// src/types.ts

export interface MstackConfig {
  /** Project name — used in workflow metadata */
  name: string;

  /** Output directory — default ".mstack/" */
  outputDir: string;

  /** Default model for all phases — can be overridden per phase */
  model: string;

  /** Orchestration mode: who drives the phase loop */
  orchestration: "prompt" | "code" | "interactive";

  /** Phase definitions — order of keys determines execution order */
  phases: Record<string, PhaseConfig>;

  /** Max retries per phase before stopping — default 2 */
  maxRetries: number;

  /** TDD settings */
  tdd: {
    enabled: boolean;
  };
}

export interface PhaseConfig {
  /** Whether this phase runs — default true */
  enabled: boolean;

  /** Skill file name (resolves to .mstack/skills/{skill}.md)
   *  or relative path (starts with "./") for custom skills */
  skill: string;

  /** Model override for this phase */
  model?: string;

  /** Orchestration mode override for this phase */
  orchestration?: "prompt" | "code" | "interactive";

  /** Input context for this phase:
   *  - null/undefined: no prior context
   *  - string: path to a single output doc from a previous phase (e.g. "analysis.md")
   *  - Record<string, string>: multiple named inputs (e.g. { plan: "plan.md", impl: "implementation.md" })
   */
  input?: null | string | Record<string, string>;

  /** Pre-phase hooks — run before the phase executes
   *  - "human": pause and ask user for input/approval
   *  - "review": run an additional review step
   *  - string path: execute a custom script
   */
  pre?: string[];

  /** Post-phase hooks — run after the phase completes */
  post?: string[];

  /** Per-phase skill overrides — merged into the skill at runtime */
  overrides?: {
    /** Additional constraints appended to the skill's Constraints section */
    constraints?: string[];
    /** Additional context prepended to the skill's Task section */
    context?: string;
  };

  /** Allowed tools for this phase (v1: prompt-level enforcement only)
   *  e.g. ["Read", "Glob", "Grep", "Bash"] */
  tools?: string[];
}
```

### Default Config File

```javascript
// defaults/mstack.config.js

module.exports = {
  name: "my-project",
  outputDir: ".mstack/",
  model: "claude-sonnet-4-6",
  orchestration: "code",

  phases: {
    analysis: {
      enabled: true,
      skill: "analysis",
      input: null,
      pre: [],
      post: ["human"],
    },

    plan: {
      enabled: true,
      skill: "plan",
      input: "analysis.md",
      pre: [],
      post: [],
    },

    implementation: {
      enabled: true,
      skill: "implementation",
      input: "plan.md",
      pre: [],
      post: [],
    },

    review: {
      enabled: true,
      skill: "review",
      input: {
        plan: "plan.md",
        implementation: "implementation.md",
      },
      pre: [],
      post: ["human"],
    },

    test: {
      enabled: true,
      skill: "test",
      input: "implementation.md",
      pre: [],
      post: [],
    },

    document: {
      enabled: false,
      skill: "document",
      input: "implementation.md",
      pre: [],
      post: [],
    },

    ship: {
      enabled: true,
      skill: "ship",
      input: "implementation.md",
      pre: ["human"],
      post: [],
    },
  },

  maxRetries: 2,

  tdd: {
    enabled: true,
  },
};
```

### Config Loading Logic (`src/config.ts`)

1. Look for `.mstack/mstack.config.js` in `process.cwd()`
2. If not found, look for `mstack.config.js` in `process.cwd()`
3. If not found, error: "No mstack config found. Run `mstack init` first."
4. Load with `require()` (supports JS module exports)
5. Validate against the schema — check required fields, valid orchestration modes, valid phase structure
6. Apply defaults for missing optional fields
7. Return the typed `MstackConfig`

---

## 6. CLI Commands

### `mstack init`

```
mstack init [--force]
```

**Behavior:**

1. Check if `.mstack/` exists
   - If exists and no `--force`: print warning and exit
   - If exists and `--force`: preserve `knowledge/` and `workflows/`, delete everything else, re-scaffold
   - If not exists: create it
2. Copy all files from `defaults/` into `.mstack/`
3. Create empty `knowledge/mistakes.md` and `knowledge/patterns.md` with skeleton headers
4. Create empty `workflows/` directory
5. Create `.claude/commands/mstack.md` (the slash command)
6. Print success message with next steps

**Empty knowledge file skeletons:**

`knowledge/mistakes.md`:

```markdown
# Mistakes

<!-- Entries are added by the review phase when issues are found.
     Format:
     ## YYYY-MM-DD: Brief description
     - **What happened:** ...
     - **Root cause:** ...
     - **Prevention:** ...
-->
```

`knowledge/patterns.md`:

```markdown
# Patterns

<!-- Entries are added by the init and analysis phases as patterns are discovered.
     Organize by domain (API Routes, Testing, Database, etc.)
-->
```

### `mstack run <task>`

```
mstack run "add JWT auth to the API" [--config path] [--mode prompt|code|interactive]
```

**Behavior:**

1. Load config
2. Override orchestration mode if `--mode` flag is present
3. Generate workflow slug: `YYYY-MM-DD-{slugified-task}` (max 50 chars for the slug portion)
4. Create workflow directory: `.mstack/workflows/{slug}/`
5. Write initial `workflow.md` with config snapshot and metadata
6. Dispatch to the appropriate runner based on `config.orchestration`
7. The runner executes enabled phases sequentially

### `mstack resume <workflow-slug>`

```
mstack resume 2026-03-26-add-auth [--mode prompt|code|interactive]
```

**Behavior:**

1. Load config
2. Read `.mstack/workflows/{slug}/workflow.md`
3. Determine last completed phase by checking which output files exist
4. Start execution from the next incomplete phase
5. Pass existing output docs as context to subsequent phases

### `mstack status [workflow-slug]`

```
mstack status                     # lists all workflows with their status
mstack status 2026-03-26-add-auth # shows detailed status for one workflow
```

**Behavior (list all):**

1. Read `.mstack/workflows/` directory
2. For each subdirectory, read `workflow.md` frontmatter
3. Print table: workflow name, status, last completed phase, timestamp

**Behavior (single workflow):**

1. Read `.mstack/workflows/{slug}/workflow.md`
2. Print phase-by-phase status table with timestamps and context usage

### `mstack create-skill <name>`

```
mstack create-skill security-review
```

**Behavior:**

1. Create `.mstack/skills/{name}.md` with the standard skill template (empty sections)
2. Print path and instructions for how to use it (reference in config via `skill: "./{name}"` or `skill: "{name}"`)

---

## 7. Runtime Architecture

### Core Principle

Claude Code is the runtime. mstack has no execution engine. The CLI is a thin launcher that starts Claude Code sessions with the right context loaded.

### Orchestration Mode Dispatch (`src/runner.ts`)

```typescript
export async function run(
  config: MstackConfig,
  userTask: string,
  workflowDir: string,
): Promise<void> {
  switch (config.orchestration) {
    case "prompt":
      return runPromptMode(config, userTask, workflowDir);
    case "code":
      return runCodeMode(config, userTask, workflowDir);
    case "interactive":
      return runInteractiveMode(config, userTask, workflowDir);
  }
}
```

### Mode 1: `"prompt"` — Claude Drives the Phase Loop

**File: `src/modes/prompt.ts`**

The simplest mode. Launches a single Claude Code session with the orchestrator skill loaded. Claude reads the config and drives the entire workflow conversationally.

```typescript
import { claude } from "@anthropic-ai/claude-code";

export async function runPromptMode(
  config: MstackConfig,
  userTask: string,
  workflowDir: string,
): Promise<void> {
  const orchestratorSkill = fs.readFileSync(
    resolveSkillPath("orchestrator", config),
    "utf8",
  );
  const universal = fs.readFileSync(
    resolvePromptPath("universal", config),
    "utf8",
  );

  const systemPrompt = `${universal}\n\n${orchestratorSkill}`;

  await claude({
    prompt: `Run mstack workflow for the following task:\n\n${userTask}\n\nWorkflow directory: ${workflowDir}\nConfig path: ${config.outputDir}/mstack.config.js`,
    systemPrompt,
    cwd: process.cwd(),
    model: config.model,
  });
}
```

**Characteristics:**

- Zero orchestration code — the orchestrator skill file IS the logic
- Fully conversational — user talks to Claude throughout
- Claude uses the Agent tool to spawn sub-agents for each phase
- Claude uses AskUserQuestion for human checkpoints
- Least deterministic — Claude follows instructions reliably but can deviate

### Mode 2: `"code"` — CLI Drives the Phase Loop (Headless)

**File: `src/modes/code.ts`**

The most deterministic mode. The CLI loops through phases in Node.js, spawning a headless Claude Code session for each phase via the SDK.

```typescript
import { claude } from "@anthropic-ai/claude-code";

export async function runCodeMode(
  config: MstackConfig,
  userTask: string,
  workflowDir: string,
): Promise<void> {
  const universal = fs.readFileSync(
    resolvePromptPath("universal", config),
    "utf8",
  );
  const enabledPhases = getEnabledPhases(config);

  for (const [phaseName, phaseConfig] of enabledPhases) {
    // Resolve per-phase orchestration override
    const phaseMode = phaseConfig.orchestration || config.orchestration;
    if (phaseMode === "interactive") {
      await runInteractivePhase(
        config,
        phaseName,
        phaseConfig,
        userTask,
        workflowDir,
        universal,
      );
      continue;
    }

    // Pre-hooks
    await runPreHooks(phaseConfig, phaseName, workflowDir);

    // Assemble prompt
    const skill = loadSkill(phaseConfig.skill, phaseConfig.overrides, config);
    const inputs = resolveInputs(phaseConfig.input, workflowDir);
    const knowledge = loadKnowledge(config);
    const prompt = assemblePrompt({
      universal,
      skill,
      inputs,
      knowledge,
      userTask,
      phaseName,
      workflowDir,
      config,
    });

    // Spawn headless agent
    const result = await claude({
      prompt,
      cwd: process.cwd(),
      model: phaseConfig.model || config.model,
      allowedTools: phaseConfig.tools,
    });

    // Write output document
    writePhaseOutput(workflowDir, phaseName, result, phaseConfig);
    updateWorkflowStatus(workflowDir, phaseName, "complete");

    // Post-hooks
    await runPostHooks(phaseConfig, phaseName, workflowDir);
  }

  printWorkflowSummary(workflowDir);
}
```

**Characteristics:**

- Phase ordering guaranteed — it's a `for` loop
- File I/O handled by code — output docs written by CLI, not agent
- Model routing is a simple SDK parameter per phase
- Human checkpoints are terminal prompts (`human-checkpoint.ts`)
- Most predictable — good for CI/CD and production

### Mode 3: `"interactive"` — CLI Drives Loop, Interactive Sessions Per Phase

**File: `src/modes/interactive.ts`**

Same code-driven loop as `"code"`, but each phase spawns an interactive Claude Code session. The user sees Claude working in real-time and can intervene.

Same structure as `code.ts` but with `interactive: true` in the `claude()` call:

```typescript
const result = await claude({
  prompt,
  cwd: process.cwd(),
  model: phaseConfig.model || config.model,
  allowedTools: phaseConfig.tools,
  interactive: true, // user sees real-time execution
});
```

**Characteristics:**

- Same determinism as `"code"` for orchestration
- Full real-time visibility into each phase
- User can ask questions, redirect, or course-correct mid-phase

### Per-Phase Mode Override

The config supports per-phase orchestration overrides:

```javascript
phases: {
  analysis:       { orchestration: "interactive" },  // watch analysis
  plan:           { },                               // uses project-level default
  implementation: { orchestration: "interactive" },  // watch coding
  review:         { orchestration: "code" },         // headless
  test:           { orchestration: "code" },         // headless
  ship:           { orchestration: "code" },         // headless
}
```

The runner checks `phase.orchestration || config.orchestration` for each phase and dispatches accordingly.

---

## 8. Prompt Assembly (`src/utils/prompt-assembler.ts`)

Each phase agent receives a single assembled prompt built from four layers:

```
┌────────────────────────────────┐
│ Universal Prompt               │  system awareness, scope rules, output format,
│ (.mstack/prompts/universal.md) │  error behavior, anti-sycophancy
├────────────────────────────────┤
│ Skill File                     │  phase-specific role, task, constraints,
│ (.mstack/skills/{phase}.md)    │  output structure, red flags
├────────────────────────────────┤
│ Input Documents                │  output from previous phases, knowledge files
│ (per config)                   │  (content injected, not file paths)
├────────────────────────────────┤
│ User Task + Metadata           │  original request, workflow slug, config
│                                │  snapshot, human checkpoint feedback
└────────────────────────────────┘
```

### Assembly Algorithm

```typescript
export function assemblePrompt(params: {
  universal: string;
  skill: string;
  inputs: Record<string, string>; // { "analysis.md": "content...", "plan.md": "content..." }
  knowledge: Record<string, string>; // { "mistakes.md": "content...", "patterns.md": "content..." }
  userTask: string;
  phaseName: string;
  workflowDir: string;
  config: MstackConfig;
}): string {
  const sections: string[] = [];

  // 1. Universal prompt
  sections.push(params.universal);

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
```

### Skill Override Merging

When a phase has `overrides` in its config, the assembler merges them into the skill text before inclusion:

```typescript
export function loadSkill(
  skillRef: string,
  overrides: PhaseConfig["overrides"],
  config: MstackConfig,
): string {
  // Resolve skill path
  const skillPath = skillRef.startsWith("./")
    ? path.resolve(process.cwd(), skillRef)
    : path.join(process.cwd(), config.outputDir, "skills", `${skillRef}.md`);

  let skill = fs.readFileSync(skillPath, "utf8");

  if (overrides?.constraints?.length) {
    const constraintBlock = overrides.constraints
      .map((c) => `- ${c}`)
      .join("\n");
    // Append after the ## Constraints section
    skill = skill.replace(
      /(## Constraints\n[\s\S]*?)(\n## )/,
      `$1\n${constraintBlock}\n$2`,
    );
    // If Constraints is the last section, append at the end of the section
    if (!skill.match(/(## Constraints\n[\s\S]*?)(\n## )/)) {
      skill = skill.replace(
        /(## Constraints\n[\s\S]*?)$/,
        `$1\n${constraintBlock}`,
      );
    }
  }

  if (overrides?.context) {
    // Prepend context to the ## Task section
    skill = skill.replace(
      /## Task\n/,
      `## Task\n\n**Project context:** ${overrides.context}\n\n`,
    );
  }

  return skill;
}
```

---

## 9. Output Document System

### Phase Output Template

Every phase writes a Markdown document to the workflow directory. The `"code"` and `"interactive"` modes use `output-writer.ts` to wrap the agent's result in this template. In `"prompt"` mode, the orchestrator skill instructs Claude to write in this format.

```markdown
---
phase: { phaseName }
workflow: { workflowSlug }
timestamp: { ISO 8601 }
model: { model used }
status: complete
---

# {Phase Title} — {Task Summary}

## User Input

> {copied verbatim from user's original request, plus any human checkpoint feedback}

## Output

{phase-specific content — this is the agent's actual work}

## Decisions Made

- {key decisions and rationale from this phase}

## Open Questions

- {anything unresolved, passed to next phase}
```

### Workflow Root Document (`workflow.md`)

Created at workflow start, updated after each phase completes.

```markdown
---
workflow: { slug }
created: { ISO 8601 }
status: in-progress | complete | failed
---

# Workflow: {Task Summary}

## Config

{full config object snapshot, as JSON, frozen at workflow start}

## Phase Status

| Phase          | Status      | Model             | Timestamp |
| -------------- | ----------- | ----------------- | --------- |
| analysis       | complete    | claude-sonnet-4-6 | 14:32     |
| plan           | complete    | claude-sonnet-4-6 | 14:38     |
| implementation | in-progress | —                 | 14:45     |

## User Inputs

- **analysis (post):** "Use UUID tokens stored in DB with a 1-hour expiry"
- **ship (pre):** "Ship it."
```

### Output Writer (`src/utils/output-writer.ts`)

```typescript
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
```

---

## 10. Skill System

### Skill File Template

Every skill follows this structure:

```markdown
---
name: { skill-name }
description: { one-line description }
---

# {Skill Title}

## Identity

{1-2 sentences defining what this agent does — functional, not persona-based}

## Task

{specific instructions for what to do, numbered steps}

## Constraints

- DO {required behaviors}
- DO NOT {prohibited behaviors}

## Output Format

{exact structure of what to produce}

## Red Flags

- "{rationalization the agent might generate}" — STOP. {why it's wrong}.
```

### Default Skill: `orchestrator.md`

This is the most critical file. It tells Claude how to drive the entire workflow in `"prompt"` mode.

```markdown
---
name: orchestrator
description: Drives the mstack workflow — reads config, loops through phases, manages checkpoints
---

# Orchestrator

## Identity

You are the mstack workflow orchestrator. You drive a config-driven, multi-phase
development workflow. You read the project config, execute phases in order by
spawning sub-agents, handle human checkpoints, and write output documents.

## Task

Execute the mstack workflow for the user's task:

1. Read `.mstack/mstack.config.js` to get the full workflow configuration
2. Generate a workflow slug from today's date and the task description
   - Format: `YYYY-MM-DD-{slugified-task}` (max 50 chars for slug portion)
   - Slugify: lowercase, replace spaces with hyphens, remove special characters
3. Create the workflow directory: `.mstack/workflows/{slug}/`
4. Write `workflow.md` with the config snapshot (as JSON) and initial metadata
5. Create a task list showing all enabled phases (use TaskCreate)
6. For each enabled phase, in config order:
   a. Update the task to in_progress (TaskUpdate)
   b. Read the skill file from `.mstack/skills/{phase.skill}.md`
   - If `skill` starts with `./`, read from that relative path instead
     c. Read the universal prompt from `.mstack/prompts/universal.md`
     d. Read input documents: resolve `phase.input` against the workflow directory
   - `null` → no input docs
   - `"analysis.md"` → read `.mstack/workflows/{slug}/analysis.md`
   - `{ plan: "plan.md", impl: "implementation.md" }` → read both
     e. Read knowledge files from `.mstack/knowledge/` (all .md files)
     f. If `phase.overrides` exists, merge constraints and context into the skill text
     g. **Pre-hooks:** For each entry in `phase.pre`:
   - `"human"` → Present what you're about to do and use AskUserQuestion. Record the response in workflow.md.
   - `"review"` → Spawn a review sub-agent on the previous phase's output
   - Any other string → Read and execute it as a script via Bash
     h. **Execute the phase:** Spawn a sub-agent using the Agent tool:
   - Prompt: universal prompt + skill + input docs + knowledge + user task
   - Model: `phase.model` or project-level `model`
     i. Write the sub-agent's output to `.mstack/workflows/{slug}/{phase}.md`
     using the output document template
     j. Update `workflow.md` with phase completion status and timestamp
     k. Mark the task as completed (TaskUpdate)
     l. **Post-hooks:** For each entry in `phase.post`:
   - `"human"` → Present the output summary and use AskUserQuestion. Record the response.
   - `"review"` → Spawn a review sub-agent on this phase's output
   - Any other string → Execute as a script
7. When all phases complete:
   - Update `workflow.md` status to `complete`
   - Present a final summary to the user: PR URL (if shipped), files changed, test results, review verdict

## Error Handling

If a sub-agent fails or produces an error:

1. Retry the phase up to `config.maxRetries` times (default 2)
2. Each retry is a fresh sub-agent with the same prompt
3. If still failing after retries, log the error in the phase output doc, update
   workflow.md status to `failed`, and stop
4. Tell the user what went wrong and which phase failed
5. Do NOT skip to the next phase. Do NOT guess at a fix.

## Constraints

- DO execute phases in the order they appear in the config
- DO spawn each phase as a separate sub-agent (Agent tool) with fresh context
- DO write output documents for every completed phase
- DO record all user inputs in workflow.md
- DO NOT execute disabled phases (enabled: false)
- DO NOT modify the config at runtime
- DO NOT skip human checkpoints — they are mandatory when configured
- DO NOT proceed to the next phase if the current phase fails after retries

## Output Format

Your own output (what the user sees) should be conversational status updates:

- "Starting {phase} phase..."
- A brief summary after each phase completes
- Human checkpoint conversations
- Final workflow summary

All substantive work is done by sub-agents and written to output docs.

## Red Flags

- "I'll skip this phase since it's not strictly necessary" — STOP. Run all enabled phases.
- "I'll combine these phases for efficiency" — STOP. Each phase is a separate sub-agent.
- "The user doesn't need to see this checkpoint" — STOP. Human checkpoints are mandatory.
- "I'll fix this error myself instead of retrying" — STOP. Retry the phase, don't patch around it.
```

### Default Skill: `init.md`

```markdown
---
name: init
description: Scan existing codebase and produce a project profile
---

# Init

## Identity

You are a codebase analyst. You scan an existing project and produce a structured
profile of its tech stack, patterns, conventions, and testing setup.

## Task

Scan the project root directory and produce a comprehensive project profile.
This is a brownfield-first scan — assume the project already exists with
established patterns.

1. Identify tech stack: languages, frameworks, runtimes, package managers
   - Read package.json / requirements.txt / go.mod / Cargo.toml / pyproject.toml
   - Read lock files to confirm versions
2. Map project structure: key directories, entry points, config files
   - Use Glob to discover structure
   - Identify the organizational pattern (layered, feature-based, monorepo, etc.)
3. Discover patterns: naming conventions, file organization, architecture
   - Read 3–5 representative source files
   - Look for consistent patterns in naming, imports, error handling
4. Document testing setup: framework, config, how to run, where tests live
   - Read test config files (jest.config, vitest.config, pytest.ini, etc.)
   - Read 1–2 representative test files for patterns
5. Document build/deploy: scripts, CI config, Dockerfile
   - Read scripts in package.json or Makefile
   - Check for .github/workflows/, .gitlab-ci.yml, Dockerfile
6. Find existing documentation: README, API docs, architecture docs, ADRs
   - List any docs/ directory contents

## Constraints

- DO NOT modify any files — read-only analysis
- DO NOT guess about patterns you cannot verify in the code
- DO read actual config and source files for facts
- DO read 3–5 representative source files to identify coding patterns
- If a section cannot be determined, write "Not detected" — do not guess

## Output Format

Write the project profile using this exact structure:
```

# Project Profile — {project name}

## Tech Stack

| Layer           | Technology | Version | Notes |
| --------------- | ---------- | ------- | ----- |
| Language        | ...        | ...     | ...   |
| Runtime         | ...        | ...     | ...   |
| Framework       | ...        | ...     | ...   |
| Database        | ...        | ...     | ...   |
| Testing         | ...        | ...     | ...   |
| Package Manager | ...        | ...     | ...   |

## Project Structure

{directory tree with annotations}

**Entry points:**

- ...

## Patterns and Conventions

### Naming

- Files: ...
- Functions: ...
- Types/Interfaces: ...
- Constants: ...

### Architecture

- ...

### Code Style

- ...

## Testing Setup

- **Framework:** ...
- **Run all:** ...
- **Test location:** ...
- **Naming:** ...
- **Coverage:** ...

## Build and Deploy

- **Build:** ...
- **Dev:** ...
- **CI:** ...
- **Deploy:** ...
- **Env:** ...

## Existing Documentation

- ...

```

## Red Flags

- "I'll assume they use X based on the project name" — STOP. Read actual config files.
- "This section isn't important" — STOP. Every section matters for downstream phases.
- "The codebase is too large to scan fully" — STOP. Read representative files. You don't need everything.
```

### Default Skill: `analysis.md`

```markdown
---
name: analysis
description: Functional analysis of the user's request against the existing codebase
---

# Analysis

## Identity

You are a requirements analyst. You analyze what needs to happen from a
functional perspective, grounded in the existing codebase.

## Task

Given the user's request:

1. Restate the request in precise technical terms
2. Read `.mstack/init.md` for project context (tech stack, patterns, structure)
3. Read knowledge files from `.mstack/knowledge/` for accumulated project knowledge
4. Search the codebase to identify which parts are affected
   - Use Glob to find relevant files
   - Use Grep to search for related patterns, function names, endpoints
5. Identify existing patterns that relate to this request
   - How does the codebase currently handle similar things?
   - What conventions must be followed?
6. Identify constraints (technical, architectural, dependency-based)
7. Break the request into discrete functional requirements (numbered)
8. Flag open questions that need user input

## Constraints

- DO NOT propose implementation details — that is the plan phase's job
- DO search the codebase before listing requirements
- DO read init.md and knowledge files for project context
- DO read actual source files to verify patterns exist
- Focus on WHAT, not HOW
- Every requirement must be traceable to the user's original request

## Output Format
```

## Functional Requirements

1. {requirement}
2. {requirement}
   ...

## Affected Areas

| File/Module | Why affected | Current behavior |
| ----------- | ------------ | ---------------- |
| ...         | ...          | ...              |

## Discovered Patterns

- {pattern}: {description, with file path reference}
- ...

## Constraints and Dependencies

- {constraint}: {why it matters}
- ...

## Open Questions

- {question} — needed before planning can proceed
- ...

```

## Red Flags

- "I already know how to implement this" — STOP. Your job is analysis, not planning.
- "There are no constraints" — STOP. There are always constraints. Read the codebase.
- "This is a simple feature" — STOP. Analyze it fully. Simple features have hidden complexity.
```

### Default Skill: `plan.md`

```markdown
---
name: plan
description: Implementation plan that fits the existing codebase
---

# Plan

## Identity

You are an implementation planner. You figure out HOW to implement the analyzed
requirements while fitting the existing codebase patterns.

## Task

Given the analysis document:

1. Read analysis requirements thoroughly
2. Read `.mstack/init.md` for project patterns and conventions
3. Read `.mstack/knowledge/patterns.md` and `.mstack/knowledge/mistakes.md`
4. For each requirement: specify exact file path, approach, and rationale
   - Is this a new file or a modification to an existing file?
   - What's the exact function/class/module that needs to change?
5. Define test strategy (what to test, where tests go, how to run)
6. Specify implementation order (dependencies between changes)
7. Estimate which files are new vs. modified

## Constraints

- DO NOT write any code — only plan it
- DO match existing patterns (naming, file organization, architecture)
- DO specify exact file paths, not vague descriptions
- DO include test file paths and test descriptions
- Every planned change must trace back to an analysis requirement
- If the analysis has open questions, flag them — do not assume answers

## Output Format
```

## File Changes

| #   | File Path                             | Action | Description                    | Traces to Req |
| --- | ------------------------------------- | ------ | ------------------------------ | ------------- |
| 1   | src/routes/auth.routes.ts             | modify | Add forgot-password route      | R1            |
| 2   | src/services/auth.service.ts          | modify | Add resetPassword()            | R1, R2        |
| 3   | src/**tests**/forgot-password.test.ts | new    | Tests for forgot-password flow | R1, R2, R3    |

## Implementation Order

1. {step} — depends on: nothing
2. {step} — depends on: step 1
3. {step} — depends on: step 1, 2

## Test Strategy

- **Test file:** {path}
- **Tests to write:**
  1. {test description}
  2. {test description}
- **Run command:** {command}
- **Existing tests to verify still pass:** {command}

## Pattern Compliance

- {pattern}: {how this plan follows it}
- ...

## Open Questions (from analysis)

- {question} — {impact on plan if unanswered}

```

## Red Flags

- "I'll figure out the exact file later" — STOP. Specificity is the whole point.
- "This doesn't match existing patterns but it's better" — STOP. Match the patterns.
- "Tests aren't needed for this" — STOP. Every change gets tests.
- "The analysis missed this requirement, I'll add it" — STOP. Flag it as a gap.
```

### Default Skill: `implementation.md`

```markdown
---
name: implementation
description: Write code following the plan, TDD by default
---

# Implementation

## Identity

You are a code implementer. You write code that follows the plan exactly,
using TDD when enabled.

## Task

Given the plan document, implement each change:

1. Read the plan completely before writing any code
2. Read the files that will be modified to understand current state
3. Before writing any new function, module, or endpoint:
   - Search the codebase for existing implementations that serve a similar purpose
   - If you find a duplicate or near-duplicate, STOP and document it — do not re-implement
   - If existing code can be extended rather than new code written, document this as a plan deviation and STOP
4. For each planned change, in the specified order:
   a. If TDD is enabled: write the failing test first
   b. Write the minimum code to pass the test
   c. Refactor if needed (keep changes minimal)
   d. If TDD is disabled: write the code, then write the tests
5. Run the full test suite after all changes
6. Document what you changed and any deviations from the plan

## Constraints

- DO NOT modify files not listed in the plan
- DO NOT add features, refactoring, or improvements not in the plan
- DO follow existing code style and patterns (read init.md if needed)
- DO write the test BEFORE the implementation when TDD is enabled
- If a planned change doesn't work as specified, document why and STOP
- If you discover a missing requirement, document it — do not implement it
- If you discover something that needs fixing but isn't in the plan, document it under "Discovered Issues" — do not fix it

## Output Format
```

## Changes Made

| #   | File Path | Action   | Lines Changed | Traces to Plan |
| --- | --------- | -------- | ------------- | -------------- |
| 1   | ...       | modified | +25 -3        | Plan item 1    |

## Test Results

- **Command:** {what you ran}
- **Result:** {pass/fail count}
- **New tests:** {count}
- **All existing tests still passing:** yes/no

## Deviations from Plan

- {deviation}: {explanation} (or "None")

## Discovered Issues

- {issue}: {description} (or "None")

```

## Red Flags

- "The plan says X but Y would be better" — STOP. Follow the plan. Document your concern.
- "I'll add this small improvement while I'm here" — STOP. Scope creep.
- "Tests can come later" — STOP. Test first. No exceptions (when TDD enabled).
- "This file isn't in the plan but it needs updating" — STOP. Document the gap.
- "I'll skip the duplicate check, this is clearly new" — STOP. Search first. Always.
```

### Default Skill: `review.md`

```markdown
---
name: review
description: Adversarial code review against plan and analysis
---

# Review

## Identity

You are an adversarial code reviewer. You do not trust the implementation
report. You verify everything independently.

## Task

Given the plan and implementation documents:

1. Read the plan to understand what SHOULD have been done
2. Read the analysis (if available in the workflow directory) to understand the original requirements
3. IGNORE the implementation report's claims — read the actual code
4. For each planned change, verify:
   a. Does the code exist at the specified path?
   b. Does it match what the plan described?
   c. Does it satisfy the original analysis requirement?
   d. Are there extra changes not in the plan?
5. Review test quality:
   a. Are tests substantive (not stubs, not hardcoded)?
   b. Do tests actually test the feature behavior?
   c. Missing edge cases?
6. Check for:
   - TODOs, FIXMEs, placeholder comments
   - Hardcoded values that should be configurable
   - Missing error handling at system boundaries
   - Security issues (injection, auth bypass, data exposure)
   - Scope violations (changes outside the plan)

## Constraints

- DO NOT trust the implementation summary — read the actual code
- DO NOT suggest improvements — only flag issues against plan/analysis
- DO compare actual code against the plan line by line
- DO run the tests yourself if a test command is available
- Adopt a suspicious stance: "The implementer may have cut corners."
- Performative agreement is banned: no "looks good overall", no "mostly correct"
- Every claim must cite specific file:line evidence

## Output Format
```

## Verdict: PASS | FAIL

## Findings

| #   | Severity | File:Line      | Finding                   | Violates     |
| --- | -------- | -------------- | ------------------------- | ------------ |
| 1   | critical | src/auth.ts:45 | Missing input validation  | Plan item 3  |
| 2   | minor    | src/test.ts:12 | Test uses hardcoded token | Test quality |

## Test Assessment

- Substantive: {count}
- Stubs or trivial: {count}
- Missing: {list of untested paths}

## Scope Check

- Extra changes (not in plan): {list or "None"}
- Missing changes (in plan but not implemented): {list or "None"}

```

## Red Flags

- "Looks good overall" — STOP. That is sycophancy. Find specific evidence for every claim.
- "Minor issue, not worth flagging" — STOP. Flag everything. Let the human decide severity.
- "The implementation report says it's done" — STOP. You don't trust the report.
- "I'll suggest a better approach" — STOP. Your job is to verify, not to redesign.
```

### Default Skill: `test.md`

```markdown
---
name: test
description: Run tests, validate coverage, catch stubs and TODOs
---

# Test

## Identity

You are a test validator. You run tests and verify they are substantive.

## Task

1. Read `.mstack/init.md` for the project's test command and framework
2. Run the full test suite using the project's standard test command
3. Run only the new/modified tests from the implementation (if identifiable)
4. Verify test quality for each new/modified test file:
   a. Not stubs (empty bodies, `pass`, `// TODO`, `test.skip`)
   b. Not hardcoded (assertions against magic values without logic)
   c. Cover actual feature behavior, not just happy path
   d. Include error/edge cases
5. Check coverage of the implemented feature (if coverage tooling exists)
6. Identify gaps: untested edge cases, error paths, boundary conditions

## Constraints

- DO NOT write new tests — only validate existing ones
- DO NOT modify implementation code
- DO run tests in the project's standard way (read init.md for test command)
- If tests fail, document the failure with full error output — do not fix it

## Output Format
```

## Test Run Results

- **Command:** {what you ran}
- **Total:** {count}
- **Passed:** {count}
- **Failed:** {count}
- **Skipped:** {count}

## New/Modified Test Quality

| Test File                  | Tests | Quality     | Issues |
| -------------------------- | ----- | ----------- | ------ |
| src/**tests**/auth.test.ts | 8     | substantive | None   |

## Coverage Gaps

- {untested path or scenario}
- ...

## Verdict: PASS | FAIL

{brief explanation}

```

## Red Flags

- "All tests pass so we're good" — STOP. Passing tests can be stubs. Check quality.
- "This edge case is unlikely" — STOP. Document it as a gap. Let the human decide.
- "I can't find the test command" — STOP. Read init.md. It's there.
```

### Default Skill: `document.md`

```markdown
---
name: document
description: Document the feature for human developers
---

# Document

## Identity

You are a technical writer. You document features for human developers
who will read and maintain this code.

## Task

1. Read the implementation output to understand what was built
2. Read the actual code to verify the implementation report
3. Write documentation aimed at developers, not AI context
4. Cover: what the feature does, how to use it, how it works, where the code lives
5. Update existing documentation if applicable (README, API docs, etc.)

## Constraints

- DO NOT write for AI consumption — write for humans
- DO NOT repeat the implementation summary — add value beyond it
- DO include code examples and usage instructions where helpful
- DO reference actual file paths for code locations
- DO check if README or other docs need updating

## Output Format
```

## Feature Summary

{1-2 paragraphs: what was built and why}

## Usage

{how to use the feature — code examples, API endpoints, CLI commands, etc.}

## Architecture

{how it fits the codebase — which layers, which patterns, data flow}

## Files

| File | Purpose |
| ---- | ------- |
| ...  | ...     |

## Documentation Updates

- {file}: {what was updated} (or "No existing docs needed updating")

```

## Red Flags

- "This is self-documenting code" — STOP. Document it anyway.
- "The implementation summary covers this" — STOP. Add value for humans.
```

### Default Skill: `ship.md`

```markdown
---
name: ship
description: Branch, commit, and create PR/MR
---

# Ship

## Identity

You are a release engineer. You push code through the git shipping process.

## Task

1. Check git status to see all changes from the implementation
2. Create a feature branch from the current main/default branch
   - Branch name: `feature/{workflow-slug}` (e.g., `feature/2026-03-26-add-auth`)
3. Stage all implementation changes (only files that were part of the plan)
4. Write a clear commit message that summarizes the FEATURE (not the process)
   - First line: concise summary (< 72 chars)
   - Body: what the feature does, key decisions, test coverage
5. Push the branch to the remote
6. Create a PR/MR with:
   - Title: feature summary
   - Body: summary of changes, test results, review verdict
   - Reference the workflow output directory for full details

## Constraints

- DO NOT force-push or rewrite history
- DO NOT commit files outside the implementation scope
- DO NOT commit secrets, .env files, or debug artifacts
- DO NOT commit mstack output files (.mstack/workflows/\*)
- DO write a clear commit message and PR description
- DO reference the review verdict (PASS/FAIL) in the PR description
- DO include test results summary in the PR description

## Output Format
```

## Ship Summary

- **Branch:** {branch name}
- **Commit:** {hash} — {first line of message}
- **PR/MR:** {URL}
- **Files committed:** {count} ({new count} new, {modified count} modified)
- **Review verdict:** {PASS/FAIL}
- **Tests:** {pass count} passing, {fail count} failing

```

## Red Flags

- "I'll force-push to clean up the history" — STOP. No force-push.
- "This .env file should be committed" — STOP. Never commit secrets.
- "I'll include the mstack output files" — STOP. Those stay local.
- "I'll commit everything with git add -A" — STOP. Stage specific files only.
```

---

## 11. Universal Prompt

**File: `defaults/prompts/universal.md`**

```markdown
# mstack — Universal Prompt

You are operating inside **mstack**, a config-driven development workflow system.
You are executing phase: **{phase}** of workflow: **{workflow}**.

## System Awareness

- mstack orchestrates multi-phase development workflows using Claude Code
- Each phase is a separate agent invocation with fresh context
- Your output will be written to a document that subsequent phases may read
- The workflow config determines which phases run, in what order, with what model

## Scope Rules

- Only do what your skill defines. Nothing more.
- Do not modify files outside the plan (if a plan exists).
- If you discover something that needs fixing but isn't in your scope, document it
  in the output document under "Discovered Issues." Do not fix it.
- If unsure whether something is in scope, stop and document the question.

## Output Rules

- Write your phase output as Markdown following the Output Format in your skill.
- Include all sections even if a section is "None" — downstream phases expect the structure.
- Be specific: file paths, line numbers, exact function names. No vague references.
- Do not claim completion unless every item in your task has been addressed.
  Partial completion is not completion.

## Error Behavior

- If you encounter an error, retry up to {maxRetries} times.
- If still failing, log the error in your output and STOP.
- Do not guess. Do not skip. Do not proceed with partial results.
- Document what failed, what you tried, and what the error was.

## Anti-Sycophancy Rules

These rules apply to ALL phases:

- Do not claim completion unless every planned item has been addressed.
  Partial completion is not completion.
- Do not agree with assumptions from previous phases if they contradict
  what you observe in the code. State the contradiction.
- If you are unsure, say so. Do not guess. Do not fill gaps with
  plausible-sounding but unverified information.
- If you are thinking "this is probably fine" — verify it.
  "Probably fine" is not evidence.
- Do not use hedging language: "seems to", "should work", "mostly correct".
  Either verify or say you didn't verify.

## Available Tools

You have access to the following Claude Code tools. Use the right tool for the job.

**File operations:**

- `Read` — Read file contents (code, images, PDFs, notebooks)
- `Write` — Create or completely overwrite a file
- `Edit` — Exact string replacement in a file (surgical edits)
- `Glob` — Find files by pattern (`**/*.ts`, `src/**/*.test.ts`)
- `Grep` — Search file contents by regex (built on ripgrep)

**Execution:**

- `Bash` — Execute shell commands (test suites, git, build scripts, package managers)

**Agent orchestration (used by orchestrator, not by phase agents):**

- `Agent` — Spawn a sub-agent with a prompt and optional model override
- `AskUserQuestion` — Pause and ask the user a question, wait for their response

**Task tracking:**

- `TaskCreate` — Create a tracked task (visible to user as checklist)
- `TaskUpdate` — Update task status (in_progress, completed)
- `TaskGet` / `TaskList` — Read current task state

**Planning and isolation:**

- `EnterPlanMode` — Switch to read-only research mode (no file edits)
- `ExitPlanMode` — Re-enable edits
- `EnterWorktree` — Create isolated git worktree (v2: parallel phases)
- `ExitWorktree` — Leave worktree

**Web access:**

- `WebFetch` — Fetch a URL and return its content
- `WebSearch` — Search the web and return results

Use `Read` instead of `cat`. Use `Edit` instead of `sed`. Use `Glob` instead of `find`.
Use `Grep` instead of `grep/rg`. Use `Write` for new files, `Edit` for modifications.

## Context

You have been given the following input documents (if any). Do not assume
access to anything beyond these documents and the project's filesystem.

{input documents are appended below by the prompt assembler}
```

Note: The `{phase}`, `{workflow}`, `{maxRetries}` placeholders are filled by the prompt assembler at runtime. The assembler replaces them with actual values from the config.

---

## 12. Slash Command

**File: `defaults/commands/mstack.md`**

This is a Claude Code custom command file placed at `.claude/commands/mstack.md`. It allows users to invoke mstack from within an existing Claude Code session by typing `/mstack add JWT auth`.

```markdown
You are the mstack workflow orchestrator. The user wants to run an mstack workflow.

Read `.mstack/mstack.config.js` to load the workflow configuration.
Read `.mstack/skills/orchestrator.md` for your full operating instructions.
Read `.mstack/prompts/universal.md` for the universal prompt rules.

Then execute the workflow for the following task:

$ARGUMENTS
```

---

## 13. Human Checkpoints (`src/utils/human-checkpoint.ts`)

In `"code"` and `"interactive"` modes, human checkpoints are terminal prompts handled by the CLI.

```typescript
import * as readline from "readline";

export async function humanCheckpoint(
  type: "pre" | "post",
  phaseName: string,
  context: string, // summary of what's about to happen or what just happened
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt =
    type === "pre"
      ? `\n📋 [${phaseName}] About to start. ${context}\n\nProceed? (Enter to continue, or type feedback): `
      : `\n✅ [${phaseName}] Complete. ${context}\n\nContinue? (Enter to continue, or type feedback): `;

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || "approved");
    });
  });
}
```

In `"prompt"` mode, human checkpoints happen conversationally — Claude uses `AskUserQuestion` to pause and ask the user.

---

## 14. Workflow Manager (`src/utils/workflow-manager.ts`)

Handles workflow directory creation, slug generation, and status tracking.

```typescript
export function generateSlug(task: string): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);
  return `${date}-${slug}`;
}

export function createWorkflowDir(config: MstackConfig, slug: string): string {
  const dir = path.join(process.cwd(), config.outputDir, "workflows", slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeWorkflowRoot(
  workflowDir: string,
  config: MstackConfig,
  userTask: string,
): void {
  const slug = path.basename(workflowDir);
  const doc = `---
workflow: ${slug}
created: ${new Date().toISOString()}
status: in-progress
---
# Workflow: ${userTask}

## Config

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## Phase Status

| Phase | Status | Model | Timestamp |
|-------|--------|-------|-----------|

## User Inputs

`;
  fs.writeFileSync(path.join(workflowDir, "workflow.md"), doc);
}

export function updateWorkflowStatus(
  workflowDir: string,
  phaseName: string,
  status: string,
): void {
  const workflowPath = path.join(workflowDir, "workflow.md");
  let content = fs.readFileSync(workflowPath, "utf8");

  // Append phase status row to the table
  const timestamp = new Date().toISOString().split("T")[1].substring(0, 5);
  const row = `| ${phaseName} | ${status} | — | ${timestamp} |`;
  content = content.replace(
    /(## Phase Status\n\|.*\n\|.*\n)([\s\S]*?)(## User Inputs)/,
    `$1$2${row}\n$3`,
  );

  fs.writeFileSync(workflowPath, content);
}

export function getCompletedPhases(workflowDir: string): string[] {
  const files = fs.readdirSync(workflowDir);
  return files
    .filter((f) => f.endsWith(".md") && f !== "workflow.md")
    .map((f) => f.replace(".md", ""));
}
```

---

## 15. Resume Logic (`src/resume.ts`)

```typescript
export async function resume(
  config: MstackConfig,
  workflowSlug: string,
): Promise<void> {
  const workflowDir = path.join(
    process.cwd(),
    config.outputDir,
    "workflows",
    workflowSlug,
  );

  if (!fs.existsSync(workflowDir)) {
    throw new Error(`Workflow not found: ${workflowSlug}`);
  }

  // Read workflow.md to get the original task
  const workflowMd = fs.readFileSync(
    path.join(workflowDir, "workflow.md"),
    "utf8",
  );
  const userTask = extractUserTask(workflowMd); // parse from the # Workflow: {task} heading

  // Determine completed phases
  const completedPhases = getCompletedPhases(workflowDir);
  const enabledPhases = getEnabledPhases(config);

  // Find the first incomplete phase
  const remainingPhases = enabledPhases.filter(
    ([name]) => !completedPhases.includes(name),
  );

  if (remainingPhases.length === 0) {
    console.log("All phases complete. Nothing to resume.");
    return;
  }

  console.log(`Resuming from phase: ${remainingPhases[0][0]}`);
  console.log(`Completed: ${completedPhases.join(", ") || "none"}`);

  // Run remaining phases using the configured mode
  // (The runner skips phases that already have output files)
  await run(config, userTask, workflowDir);
}
```

### Mid-Execution Interruption Policy

If a phase was interrupted mid-execution (the user killed the process, context ran out, etc.), there will be no output file for that phase — `{phase}.md` will not exist in the workflow directory. On resume:

- The interrupted phase restarts from scratch with a fresh agent and clean context
- Partially written code may exist in the codebase from the interrupted run — the restarted phase will discover it during its normal execution (reading files, searching patterns) and handle it
- No attempt is made to recover partial output — fresh start is safer and simpler

---

## 16. Knowledge System

### Structure

```
.mstack/knowledge/
├── mistakes.md     # Things that went wrong and how to prevent them
└── patterns.md     # Codebase patterns and conventions discovered over time
```

### How Knowledge Is Used

1. The `analysis` and `plan` skills read all `.md` files from `knowledge/` as additional context
2. The `review` skill can append to `mistakes.md` when it catches issues (instruction in its skill file)
3. The `init` skill populates `patterns.md` with discovered patterns
4. Knowledge files are human-readable and human-editable
5. Future: add more files as needed (`decisions.md`, `api-behaviors.md`) — the system reads all `.md` files in the directory without registration

### Integration

The prompt assembler reads all `.md` files from the `knowledge/` directory and includes them in the assembled prompt under a "## Project Knowledge" section. Files that are empty or contain only skeleton comments are skipped.

---

## 17. Error Handling

Simple and conservative:

1. If a phase agent fails (error, timeout, or produces no output):
   - Retry the phase up to `config.maxRetries` times (default: 2)
   - Each retry is a completely fresh agent invocation (new context)
2. After all retries exhausted:
   - Write error details to the phase output document
   - Update `workflow.md` status to `failed`
   - Print the error to the user
   - Stop execution — do not proceed to the next phase
3. The user can fix the issue and run `mstack resume` to continue

No automatic debug agent dispatch. No error classification. No escalation ladders. If it fails twice, a human looks at it.

---

## 18. Init Phase — Special Behavior

The `init` phase is different from other phases:

1. It runs once per project (not per workflow)
2. Its output goes to `.mstack/init.md` (project-level), not the workflow directory
3. It's not part of the regular workflow — it's invoked by `mstack init` after scaffolding
4. If `init.md` already exists, `mstack init` does NOT overwrite it (unless `--force`)
5. Re-running: `mstack init --force` re-runs the init scan and overwrites `init.md`. The previous version is archived to `init.{timestamp}.md`

### Init Execution

After `mstack init` scaffolds the directory structure, it automatically runs the init phase:

```typescript
// In scaffold.ts, after copying files:
async function runInitPhase(config: MstackConfig): Promise<void> {
  const initSkill = fs.readFileSync(
    path.join(config.outputDir, "skills", "init.md"),
    "utf8",
  );
  const universal = fs.readFileSync(
    path.join(config.outputDir, "prompts", "universal.md"),
    "utf8",
  );

  const result = await claude({
    prompt: `${universal}\n\n${initSkill}\n\nScan this project and produce a project profile. Write output to .mstack/init.md`,
    cwd: process.cwd(),
    model: config.model,
  });
}
```

---

## 19. Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/claude-code": "latest"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "vitest": "^2.0",
    "@types/node": "^22"
  }
}
```

The only runtime dependency is the Claude Code SDK. Everything else is Node.js built-ins.

### Build

- TypeScript compiled to `dist/`
- `bin/mstack.ts` → `dist/bin/mstack.js` (CLI entry point with `#!/usr/bin/env node` shebang)
- ESM modules (`"type": "module"` in package.json)

### package.json essentials

```json
{
  "name": "mstack",
  "version": "0.1.0",
  "description": "Config-driven agentic dev workflow CLI built on Claude Code",
  "type": "module",
  "bin": {
    "mstack": "./dist/bin/mstack.js"
  },
  "files": ["dist/", "defaults/"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "prepublishOnly": "npm run build"
  }
}
```

---

## 20. CLI Entry Point (`bin/mstack.ts`)

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig } from "../src/config.js";
import { scaffold } from "../src/scaffold.js";
import { run } from "../src/runner.js";
import { resume } from "../src/resume.js";
import { printStatus } from "../src/status.js";
import { createSkill } from "../src/skill-builder.js";

const program = new Command();

program
  .name("mstack")
  .description("Config-driven agentic dev workflow CLI")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold .mstack/ directory with default config and skills")
  .option(
    "--force",
    "Overwrite existing scaffold (preserves knowledge/ and workflows/)",
  )
  .action(async (opts) => {
    await scaffold({ force: opts.force });
  });

program
  .command("run <task>")
  .description("Start a new workflow")
  .option(
    "--mode <mode>",
    "Override orchestration mode (prompt|code|interactive)",
  )
  .option("--config <path>", "Path to config file")
  .action(async (task, opts) => {
    const config = loadConfig(opts.config);
    if (opts.mode) config.orchestration = opts.mode;

    const slug = generateSlug(task);
    const workflowDir = createWorkflowDir(config, slug);
    writeWorkflowRoot(workflowDir, config, task);

    await run(config, task, workflowDir);
  });

program
  .command("resume <workflow>")
  .description("Resume an interrupted workflow")
  .option("--mode <mode>", "Override orchestration mode")
  .action(async (workflow, opts) => {
    const config = loadConfig();
    if (opts.mode) config.orchestration = opts.mode;
    await resume(config, workflow);
  });

program
  .command("status [workflow]")
  .description("Show workflow status")
  .action(async (workflow) => {
    const config = loadConfig();
    await printStatus(config, workflow);
  });

program
  .command("create-skill <name>")
  .description("Scaffold a new custom skill file")
  .action(async (name) => {
    const config = loadConfig();
    await createSkill(config, name);
  });

program.parse();
```

Add `commander` to dependencies:

```json
{
  "dependencies": {
    "@anthropic-ai/claude-code": "latest",
    "commander": "^12.0"
  }
}
```

---

## 21. Tool Access Per Phase (Prompt-Level Enforcement)

In v1, tool restrictions are enforced via skill Constraints sections, not runtime-level:

| Phase          | Allowed Tools                       | Rationale                                       |
| -------------- | ----------------------------------- | ----------------------------------------------- |
| init           | Read, Glob, Grep, Bash              | Read-only scan + run commands to check versions |
| analysis       | Read, Glob, Grep, Bash, WebFetch    | Read-only + search + external docs              |
| plan           | Read, Glob, Grep                    | Read-only, no execution                         |
| implementation | Read, Write, Edit, Bash, Glob, Grep | Full access — writes code, runs tests           |
| review         | Read, Glob, Grep, Bash              | Read code + run tests, no edits                 |
| test           | Read, Bash, Grep                    | Run tests, read results                         |
| document       | Read, Write, Edit, Glob             | Read code + write docs                          |
| ship           | Read, Bash                          | Git commands only                               |

In `"code"` mode, the `allowedTools` parameter is passed to the SDK's `claude()` call for runtime enforcement. In `"prompt"` mode, enforcement is via skill constraints only.

---

## 22. End-to-End Workflow Example

To validate the spec is complete, here's what happens when a user runs:

```bash
mstack run "Add a forgot-password endpoint that sends a reset email"
```

1. **CLI** loads `.mstack/mstack.config.js`
2. **CLI** generates slug: `2026-03-26-add-a-forgot-password-endpoint`
3. **CLI** creates `.mstack/workflows/2026-03-26-add-a-forgot-password-endpoint/`
4. **CLI** writes `workflow.md` with config snapshot
5. **CLI** dispatches to the configured runner (e.g., `runCodeMode`)

**Phase: analysis**

- CLI assembles prompt: universal + `skills/analysis.md` + `init.md` + `knowledge/*.md` + user task
- CLI spawns headless Claude session via SDK
- Agent reads codebase, identifies affected areas, lists requirements, flags open questions
- CLI writes `analysis.md` to workflow dir
- Post-hook `"human"`: CLI prompts user in terminal → user provides feedback
- CLI records feedback in `workflow.md`

**Phase: plan**

- CLI assembles prompt: universal + `skills/plan.md` + `analysis.md` (with user feedback)
- Agent produces file-level plan with test strategy
- CLI writes `plan.md`

**Phase: implementation**

- CLI assembles prompt: universal + `skills/implementation.md` + `plan.md`
- Agent writes tests first (TDD), implements code, runs tests
- CLI writes `implementation.md`

**Phase: review**

- CLI assembles prompt: universal + `skills/review.md` + `plan.md` + `implementation.md`
- Fresh agent (adversarial) reads actual code, compares against plan
- CLI writes `review.md`
- Post-hook `"human"`: user sees review findings

**Phase: test**

- CLI assembles prompt: universal + `skills/test.md` + `implementation.md`
- Agent runs test suite, validates quality
- CLI writes `test.md`

**Phase: ship**

- Pre-hook `"human"`: user approves shipping
- CLI assembles prompt: universal + `skills/ship.md` + `implementation.md`
- Agent creates branch, commits, pushes, opens PR
- CLI writes `ship.md`
- CLI prints final summary

---

## 23. Testing Strategy (for mstack itself)

### Unit Tests

- `config.test.ts` — config loading, validation, defaults
- `prompt-assembler.test.ts` — prompt assembly, override merging, input resolution
- `scaffold.test.ts` — file creation, idempotency, --force behavior
- `workflow-manager.test.ts` — slug generation, workflow dir creation, status updates
- `runner.test.ts` — mode dispatch, phase ordering, skip disabled phases

### Integration Tests

- Full workflow run with mock Claude SDK responses
- Resume from interrupted workflow
- Human checkpoint flow

### Test Command

```bash
npm test           # vitest
npm run test:cov   # with coverage
```

---

## 24. Implementation Order

Build the MVP in this order:

1. **Project setup** — package.json, tsconfig, directory structure
2. **Types** — `src/types.ts` with all interfaces
3. **Config** — `src/config.ts` (loader, validator)
4. **Default files** — all files in `defaults/` (config, skills, prompts, command)
5. **Scaffold** — `src/scaffold.ts` (`mstack init`)
6. **Prompt assembler** — `src/utils/prompt-assembler.ts`
7. **Output writer** — `src/utils/output-writer.ts`
8. **Workflow manager** — `src/utils/workflow-manager.ts`
9. **Human checkpoint** — `src/utils/human-checkpoint.ts`
10. **Code mode runner** — `src/modes/code.ts` (most deterministic, build first)
11. **Prompt mode runner** — `src/modes/prompt.ts` (simplest, depends on orchestrator skill)
12. **Interactive mode runner** — `src/modes/interactive.ts` (variant of code mode)
13. **Runner dispatch** — `src/runner.ts`
14. **Resume** — `src/resume.ts`
15. **Status** — `src/status.ts`
16. **Skill builder** — `src/skill-builder.ts`
17. **CLI** — `bin/mstack.ts`
18. **Tests** — all test files
19. **Init phase execution** — hook into scaffold to run init scan

---

## 25. Key Design Decisions Summary

| Decision          | Choice                              | Why                                                    |
| ----------------- | ----------------------------------- | ------------------------------------------------------ |
| Runtime           | Claude Code SDK                     | Claude is the runtime, not our code                    |
| Config format     | JS (not JSON/YAML)                  | Supports comments, computed values, requires no parser |
| Orchestration     | 3 modes (prompt/code/interactive)   | Different use cases need different levels of control   |
| Phase execution   | Sequential, one sub-agent per phase | Simple, debuggable, sufficient for v1                  |
| Context           | Fresh per phase, no bleed           | Prevents context degradation, ensures clean reviews    |
| Review            | Adversarial, fresh context          | Most effective pattern across all analyzed frameworks  |
| TDD               | Default on, configurable off        | Industry consensus from framework analysis             |
| Knowledge         | Simple Markdown files               | Lightweight, human-editable, no infrastructure         |
| Error handling    | Retry 2x, then stop                 | Conservative, human-in-the-loop for failures           |
| State             | Filesystem (output files = truth)   | No database, no session tokens, fully resumable        |
| Skills            | Functional roles, not personas      | Easier to parameterize, more predictable output        |
| Scope enforcement | Prompt-level (v1), hooks (v2)       | Start simple, add runtime enforcement later            |
| Distribution      | npm                                 | Standard for JS/TS tools, low friction                 |

---

## 26. Names and Branding

- **Package name:** `mstack` (working name — confirm availability on npm before publishing)
- **Config file:** `mstack.config.js`
- **Output directory:** `.mstack/`
- **CLI command:** `mstack`
- **Slash command:** `/mstack`
- **Workflow directories:** `.mstack/workflows/{date-slug}/`

---

_This specification is complete and self-contained. A Claude Code instance with access to this document and the npm/Node.js ecosystem should be able to build the full MVP without additional context._
