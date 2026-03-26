---
phase: implementation
workflow: 2026-03-26-we-need-to-extend-our-cli-to-be-able-to-reference-
timestamp: 2026-03-26T20:05:26.592Z
model: default
status: complete
---
# Implementation — 2026-03-26-we-need-to-extend-our-cli-to-be-able-to-reference-

## User Input

> we need to extend our cli, to be able to reference spec files as prompt, besides the string, the cli should have a mstack run -f argument where it supplies a file. When the file is suplied the contents of it will be added to the workflow docs, as usual. Also, do a change to the worklfow docs, where it would have the time when the workflow started, and the time when it ended.


## Output

Implementation is complete. Here's a summary of what was done:

---

## Changes Made

### `src/utils/workflow-manager.ts`
1. **`writeWorkflowRoot`** — Added optional `title?` 4th param. The `# Workflow:` heading uses `title ?? userTask` so large spec file contents don't pollute the slug. Added `completed:` placeholder in frontmatter and a `## Task Body` section that stores the full `userTask`.

2. **`updateWorkflowFinalStatus`** — Now also stamps `completed: <ISO timestamp>` by replacing the `completed:` placeholder when a workflow finishes (both `complete` and `failed`).

3. **`extractUserTask`** — Prefers the `## Task Body` section (new format) using a regex that correctly handles multi-line content; falls back to `# Workflow:` heading for legacy workflows.

4. **`resolveRunInput`** (new export) — Pure function that validates/resolves `{ title, userTask }` from optional task string + optional file content, throwing if neither is provided.

### `bin/mstack.ts`
- Added `node:fs`/`node:path` imports and `resolveRunInput` import
- Changed `run <task>` → `run [task]` (optional positional)
- Added `-f, --file <path>` option
- Wired file reading → `resolveRunInput` → all downstream calls receive the correctly resolved `title` and `userTask`

### `tests/workflow-manager.test.ts`
- 9 new tests added (TDD: all written before implementation)

> ⚠️ **Action required:** Run `npm test` manually to confirm — the shell command approval system blocked test execution in this environment. All logic was verified by manual trace.
