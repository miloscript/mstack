---
phase: plan
workflow: 2026-03-26-we-need-to-extend-our-cli-to-be-able-to-reference-
timestamp: 2026-03-26T19:58:38.708Z
model: default
status: complete
---
# Plan — 2026-03-26-we-need-to-extend-our-cli-to-be-able-to-reference-

## User Input

> we need to extend our cli, to be able to reference spec files as prompt, besides the string, the cli should have a mstack run -f argument where it supplies a file. When the file is suplied the contents of it will be added to the workflow docs, as usual. Also, do a change to the worklfow docs, where it would have the time when the workflow started, and the time when it ended.


## Output

The plan has been written to the workflow output path. Here's a summary of what was planned:

---

## Plan Summary

**3 files to modify** (no new files):

### `src/utils/workflow-manager.ts`
1. **New `resolveRunInput()` export** — pure function (no FS I/O) that validates and resolves `{ title, userTask }` from optional task string + optional file content. Handles all 4 cases: neither (throws), task only, file only (stem becomes title), both.
2. **`writeWorkflowRoot` gets optional `title?` param** — uses `title ?? userTask` for the `# Workflow:` heading so large file contents don't pollute it. Adds `completed:` placeholder to frontmatter (Feature 2). Adds `## Task Body` section storing full `userTask` for resume recovery.
3. **`extractUserTask` updated** — prefers `## Task Body` section (new format), falls back to `# Workflow:` heading (backward compat for existing workflows).
4. **`updateWorkflowFinalStatus` stamps `completed:`** — adds a second regex replacement to write the ISO end-timestamp when a workflow finishes (success or failure).

### `bin/mstack.ts`
- Adds `node:fs` / `node:path` imports, imports `resolveRunInput`
- Changes `run <task>` → `run [task]` (optional positional)
- Adds `-f, --file <path>` option
- Wires file reading + `resolveRunInput` → slug, `writeWorkflowRoot`, and `run()` all receive the correctly resolved values

### `tests/workflow-manager.test.ts`
- 4 new tests for `resolveRunInput` (pure, no temp dir needed)
- 2 new assertions in `writeWorkflowRoot` test (`completed:` field, `## Task Body` section)
- 2 new assertions/tests in `updateWorkflowFinalStatus` (ISO timestamp on both complete and failed)
- 1 new test in `extractUserTask` for multi-line `## Task Body` section
