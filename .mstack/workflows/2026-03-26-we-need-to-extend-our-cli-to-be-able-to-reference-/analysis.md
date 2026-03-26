---
phase: analysis
workflow: 2026-03-26-we-need-to-extend-our-cli-to-be-able-to-reference-
timestamp: 2026-03-26T19:52:54.783Z
model: default
status: complete
---
# Analysis — 2026-03-26-we-need-to-extend-our-cli-to-be-able-to-reference-

## User Input

> we need to extend our cli, to be able to reference spec files as prompt, besides the string, the cli should have a mstack run -f argument where it supplies a file. When the file is suplied the contents of it will be added to the workflow docs, as usual. Also, do a change to the worklfow docs, where it would have the time when the workflow started, and the time when it ended.


## Output

The analysis is complete. Here's a summary of what was found:

## Summary

**Two distinct features were identified:**

### Feature 1 — `mstack run -f <file>` option
The `bin/mstack.ts` `run <task>` command needs a new `--file`/`-f` option. The positional `<task>` argument must become optional (`[task]`), with a runtime guard ensuring at least one of the two is supplied. When only `-f` is given, the filename stem drives the slug; when both are given, the positional string is the short title/slug and the file content is the full task body. The file content flows into `userTask` — the same string that powers prompt assembly, phase docs, and workflow.md.

### Feature 2 — Workflow start/end timestamps in `workflow.md`
- **Start time** — already recorded as `created:` in the YAML frontmatter of `workflow.md`. No change needed.
- **End time** — not currently recorded. Two changes required in `src/utils/workflow-manager.ts`:
  1. `writeWorkflowRoot` — add a `completed:` placeholder field to the initial frontmatter template
  2. `updateWorkflowFinalStatus` — stamp the `completed:` field with an ISO timestamp when the workflow finishes (whether success or failure)

**Key constraints:** commander's `<arg>` vs `[arg]` syntax, the `userTask` string can never be empty/undefined, all changes need Vitest test coverage, and no new npm dependencies should be introduced.
