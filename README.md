# mstack

> Config-driven agentic dev workflow CLI built on Claude Code

[![npm version](https://img.shields.io/npm/v/mstack.svg)](https://www.npmjs.com/package/mstack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![Built on Claude Code](https://img.shields.io/badge/built%20on-Claude%20Code-blueviolet)](https://claude.ai)

---

## Table of Contents

- [What is mstack?](#what-is-mstack)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Installation](#installation)
- [CLI reference](#cli-reference)
- [Configuration](#configuration)
- [Phase skills](#phase-skills)
- [Orchestration modes](#orchestration-modes)
- [Workflow lifecycle](#workflow-lifecycle)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## What is mstack?

**mstack** is a CLI that turns a plain English task description into a structured, multi-phase AI development workflow. It drives Claude Code agents through a configurable pipeline — analysis → plan → implementation → review → test → ship — and writes every phase's output to a versioned document so nothing is lost and every decision is traceable.

Think of it as a *programmable team of AI agents* that follow your rules, respect your codebase conventions, and hand you structured artifacts at every step.

**Key properties:**

- **Config-driven** — workflows are defined in a plain JS config file, not hardcoded
- **Phase-based** — each phase is an isolated agent invocation with its own skill, inputs, and outputs
- **Anti-sycophant by design** — built-in rules prevent agents from claiming completion unless every item is done
- **TDD-first** — test-before-code is the default, enforced at the prompt level
- **Resumable** — interrupted workflows can be resumed from the last completed phase
- **Auditable** — every phase writes a Markdown document to `.mstack/workflows/`

---

## How it works

```
mstack run "add dark mode toggle"
```

```
Workflow: 2026-03-26-add-dark-mode-toggle
Mode: code
Output: .mstack/workflows/2026-03-26-add-dark-mode-toggle

▶ Starting analysis phase...
  🔧 Read src/components/ThemeProvider.tsx
  🔧 Grep pattern: "theme|dark|light"
  ✓ analysis complete

▶ Starting plan phase...
  ✓ plan complete

▶ Starting implementation phase...
  🔧 Write src/components/DarkModeToggle.tsx
  🔧 Write tests/DarkModeToggle.test.tsx
  🔧 Bash $ npm test
  ✓ implementation complete

▶ Starting review phase...
  ✓ review complete

============================================================
  Workflow complete!
============================================================

  Output: .mstack/workflows/2026-03-26-add-dark-mode-toggle
  Phase outputs: 4 documents
```

Each phase is driven by a **skill** — a Markdown prompt file that defines the agent's identity, task, constraints, and output format. Skills are composable, overridable, and live in `.mstack/skills/`.

---

## Quick start

```bash
# Install globally
npm install -g mstack

# Scaffold a new project
cd your-project
mstack init

# Edit the config (set your project name, phases, etc.)
$EDITOR .mstack/mstack.config.js

# Run a workflow
mstack run "refactor the auth module to use JWT"
```

After `mstack init`, your project gets:

```
.mstack/
  mstack.config.js      ← workflow config
  skills/               ← phase skill prompts (edit freely)
    analysis.md
    plan.md
    implementation.md
    review.md
    test.md
    ship.md
    ...
  knowledge/
    mistakes.md         ← accumulated error log (auto-updated by review)
    patterns.md         ← discovered code patterns
  workflows/            ← output documents (auto-generated, one dir per run)
.claude/
  commands/
    mstack.md           ← /mstack slash command for Claude Code
```

---

## Installation

**Requirements:** Node.js ≥ 20.0.0, Claude Code

```bash
# Global install (recommended for CLI use)
npm install -g mstack

# Local install (monorepos, per-project pinning)
npm install --save-dev mstack
npx mstack init
```

mstack depends on `@anthropic-ai/claude-agent-sdk` and runs agents using the same SDK that powers Claude Code itself. The Claude Code desktop app or a valid API key must be available in your environment.

---

## CLI reference

### `mstack init`

Scaffold the `.mstack/` directory and install the `/mstack` slash command for Claude Code.

```bash
mstack init           # First-time setup
mstack init --force   # Re-scaffold (preserves knowledge/ and workflows/)
```

`--force` preserves your accumulated knowledge (`mistakes.md`, `patterns.md`) and all existing workflow outputs. Everything else is overwritten from defaults.

After scaffolding, an **init scan** runs automatically: a Claude agent reads your project and writes a project profile to `.mstack/init.md`. This profile is fed to every subsequent phase as context.

---

### `mstack run [task]`

Start a new workflow for a task described in plain English, from a spec file, or both.

```bash
mstack run "add pagination to the users list endpoint"
mstack run -f spec.md
mstack run "add pagination" -f spec.md
mstack run "fix the race condition in the job queue" --mode prompt
mstack run "migrate from Prisma 4 to Prisma 5" --config ./custom.config.js
```

| Option | Description |
|--------|-------------|
| `-f, --file <path>` | Path to a spec file whose contents are used as the task prompt |
| `--mode <mode>` | Override orchestration mode: `code` \| `prompt` \| `interactive` |
| `--config <path>` | Path to an alternative config file |

When `-f` is supplied alone, the file's contents become the task prompt and the filename (without extension) is used as the workflow title. When both a positional task and `-f` are provided, the task string becomes the title and the file contents are appended to it.

Each run creates a timestamped directory under `.mstack/workflows/` (e.g. `2026-03-26-add-pagination-to-the-users-list-endp`) and writes a `workflow.md` tracking phase status in real time. The workflow document records both the start time (`created`) and end time (`completed`).

---

### `mstack resume <workflow>`

Resume an interrupted workflow from the last completed phase.

```bash
mstack resume 2026-03-26-add-pagination-to-the-users-list-endp
```

mstack reads the workflow's `workflow.md` to determine which phases already completed, then re-runs only the remaining ones with the original task and config.

---

### `mstack status [workflow]`

List all workflows or inspect a specific one.

```bash
mstack status                      # List all workflows
mstack status 2026-03-26-my-task   # Inspect one workflow
```

Output shows per-phase status (in-progress, complete, failed), model used, and timestamps — useful for auditing a long-running workflow or diagnosing a failure.

---

### `mstack create-skill <name>`

Scaffold a new custom skill file.

```bash
mstack create-skill security-audit
```

Creates `.mstack/skills/security-audit.md` with a full template. Reference it in your config with `skill: "security-audit"` or `skill: "./.mstack/skills/security-audit.md"`.

---

## Configuration

Workflows are defined in `.mstack/mstack.config.js` (or `mstack.config.js` at the project root). The file is a plain ES module.

```js
// .mstack/mstack.config.js
export default {
  name: "my-project",          // Project name used in workflow metadata
  outputDir: ".mstack/",       // Where workflows and skills are stored
  model: "claude-sonnet-4-6",  // Default model for all phases
  orchestration: "code",       // How phases are driven (see below)
  permissionMode: "acceptEdits", // Claude Code permission level
  maxRetries: 2,               // Retries per phase before stopping
  tdd: { enabled: true },      // Enforce test-first order in implementation

  phases: {
    analysis: {
      enabled: true,
      skill: "analysis",       // Resolves to .mstack/skills/analysis.md
      input: null,             // No prior phase output as input
      pre: [],
      post: ["human"],         // Pause for human review after this phase
    },

    plan: {
      enabled: true,
      skill: "plan",
      input: "analysis.md",    // Feed analysis output to this phase
    },

    implementation: {
      enabled: true,
      skill: "implementation",
      input: "plan.md",
    },

    review: {
      enabled: true,
      skill: "review",
      input: {                 // Multiple named inputs
        plan: "plan.md",
        implementation: "implementation.md",
      },
      post: ["human"],
    },

    test: {
      enabled: true,
      skill: "test",
      input: "implementation.md",
    },

    ship: {
      enabled: true,
      skill: "ship",
      input: "implementation.md",
      pre: ["human"],          // Pause for human approval before shipping
    },
  },
};
```

### Config reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | — | **Required.** Project name |
| `outputDir` | `string` | `".mstack/"` | Directory for skills, knowledge, and workflow outputs |
| `model` | `string` | `"claude-sonnet-4-6"` | Default model for all phases |
| `orchestration` | `"code"` \| `"prompt"` \| `"interactive"` | `"code"` | How the phase loop is driven |
| `permissionMode` | `"default"` \| `"acceptEdits"` \| `"bypassPermissions"` | `"acceptEdits"` | Claude Code tool approval level |
| `maxRetries` | `number` | `2` | Retries per phase before the workflow stops |
| `tdd.enabled` | `boolean` | `true` | Enforce test-before-code order |
| `phases` | `Record<string, PhaseConfig>` | — | **Required.** Phase definitions (execution order = key order) |

### Phase config reference

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | `boolean` | Whether this phase runs (default: `true`) |
| `skill` | `string` | Skill file name or relative path (`"./custom/my-skill.md"`) |
| `input` | `null \| string \| Record<string, string>` | Prior phase output(s) to feed as context |
| `model` | `string` | Model override for this phase |
| `orchestration` | `"code"` \| `"prompt"` \| `"interactive"` | Orchestration override for this phase |
| `pre` | `string[]` | Pre-phase hooks: `"human"`, `"review"`, or a shell command |
| `post` | `string[]` | Post-phase hooks: same options as `pre` |
| `tools` | `string[]` | Restrict which Claude Code tools this phase can use |
| `permissionMode` | `string` | Permission mode override for this phase |
| `overrides.constraints` | `string[]` | Extra constraints appended to the skill's Constraints section |
| `overrides.context` | `string` | Extra context prepended to the skill's Task section |

---

## Phase skills

Skills are Markdown prompt files that define what an agent does in a phase. mstack ships with eight built-in skills:

| Skill | File | Purpose |
|-------|------|---------|
| `init` | `skills/init.md` | Scan the project and produce a project profile |
| `analysis` | `skills/analysis.md` | Understand the codebase and scope the task |
| `plan` | `skills/plan.md` | Produce a concrete implementation plan |
| `implementation` | `skills/implementation.md` | Write code following the plan (TDD by default) |
| `review` | `skills/review.md` | Review the implementation against the plan |
| `test` | `skills/test.md` | Write or expand the test suite |
| `document` | `skills/document.md` | Generate or update documentation |
| `orchestrator` | `skills/orchestrator.md` | Drive the phase loop (prompt mode only) |
| `ship` | `skills/ship.md` | Prepare and execute the ship checklist |

### Skill format

Every skill follows a consistent structure:

```markdown
---
name: my-skill
description: One-line description
---

# My Skill

## Identity
What this agent is and does.

## Task
Step-by-step instructions.

## Constraints
- DO ...
- DO NOT ...

## Output Format
Exact structure of what to produce.

## Red Flags
- "Rationalization the agent might generate" — STOP. Why it's wrong.
```

The `## Red Flags` section is a key differentiator — it explicitly enumerates the shortcuts and self-deceptions an LLM might take, and instructs it to stop and document rather than proceed.

### Creating a custom skill

```bash
mstack create-skill my-security-audit
# → creates .mstack/skills/my-security-audit.md
```

Then reference it in your config:

```js
phases: {
  "security-audit": {
    enabled: true,
    skill: "my-security-audit",
    input: "analysis.md",
  },
}
```

---

## Orchestration modes

mstack supports three modes for driving the phase loop, configured via `orchestration` in your config or `--mode` at runtime.

### `code` (default)

mstack's Node.js process drives the loop. Each phase spawns an isolated headless agent, collects its output, writes the phase document, then moves to the next phase. This is the most predictable and auditable mode.

```
mstack (Node) → agent(analysis) → agent(plan) → agent(implementation) → ...
```

### `prompt`

A single long-running Claude agent drives the entire workflow. The orchestrator skill (`skills/orchestrator.md`) instructs the agent to run each phase in sequence. Useful for exploratory or open-ended tasks where human guidance mid-run is valuable.

```
mstack (Node) → orchestrator agent → (internally runs all phases)
```

### `interactive`

Each phase is spawned as a Claude Code interactive session. The human can observe and intervene. Best for high-stakes phases like `ship`.

Configure per-phase:

```js
ship: {
  orchestration: "interactive",
  skill: "ship",
  input: "implementation.md",
}
```

---

## Workflow lifecycle

Every `mstack run` creates a self-contained directory:

```
.mstack/workflows/2026-03-26-my-task/
  workflow.md          ← Phase status table, config snapshot, user inputs
  analysis.md          ← Analysis phase output
  plan.md              ← Plan phase output
  implementation.md    ← Implementation phase output
  review.md            ← Review phase output
  test.md              ← Test phase output
  ship.md              ← Ship phase output
```

**Phase status values:**

| Status | Meaning |
|--------|---------|
| `in-progress` | Phase is running |
| `retry-N` | Phase is on retry N |
| `complete` | Phase finished successfully |
| `failed` | Phase exhausted all retries |

**Hooks** run before (`pre`) or after (`post`) a phase:

| Hook | Effect |
|------|--------|
| `"human"` | Pause and prompt the user for approval or feedback |
| `"review"` | Spawn a review sub-agent for the preceding phase |
| `"<command>"` | Execute an arbitrary shell command |

**Knowledge accumulation:** The `review` phase writes discovered issues to `.mstack/knowledge/mistakes.md`. Every subsequent phase reads this file, so the system learns from past errors across workflows.

---

## Project structure

```
mstack/
├── bin/
│   └── mstack.ts              ← CLI entry point (Commander.js)
├── src/
│   ├── types.ts               ← MstackConfig, PhaseConfig interfaces
│   ├── config.ts              ← Config loader and validator
│   ├── runner.ts              ← Orchestration mode dispatcher
│   ├── scaffold.ts            ← mstack init logic
│   ├── resume.ts              ← mstack resume logic
│   ├── status.ts              ← mstack status renderer
│   ├── skill-builder.ts       ← mstack create-skill scaffolder
│   ├── modes/
│   │   ├── code.ts            ← Code-mode phase loop + agent runner
│   │   ├── prompt.ts          ← Prompt-mode orchestrator
│   │   └── interactive.ts     ← Interactive-mode phase runner
│   └── utils/
│       ├── workflow-manager.ts   ← Slug generation, workflow.md writes
│       ├── prompt-assembler.ts   ← Builds the full agent prompt
│       ├── output-writer.ts      ← Writes phase output documents
│       └── human-checkpoint.ts   ← Human hook implementation
├── defaults/
│   ├── mstack.config.js       ← Default config template
│   ├── skills/                ← Built-in skill prompt files
│   ├── prompts/               ← System prompt fragments
│   └── commands/
│       └── mstack.md          ← /mstack slash command for Claude Code
└── tests/
    ├── config.test.ts
    ├── scaffold.test.ts
    ├── runner.test.ts
    ├── prompt-assembler.test.ts
    └── workflow-manager.test.ts
```

---

## Contributing

1. Fork the repository and create a feature branch
2. Install dependencies: `npm install`
3. Run tests in watch mode: `npm test`
4. Build: `npm run build`
5. Make your changes following the existing code style (ES modules, TypeScript strict)
6. Ensure all tests pass before submitting a pull request

**Adding a new built-in skill:**
1. Create `defaults/skills/<name>.md` following the skill format above
2. Copy it to `.mstack/skills/` via `mstack init --force` or manually
3. Reference it in `defaults/mstack.config.js` if it should be on by default

**Reporting issues:** Please include the workflow slug, the failing phase, and the contents of the phase output document.

---

## License

MIT © 2026 mstack contributors — see [LICENSE](./LICENSE) for full text.
