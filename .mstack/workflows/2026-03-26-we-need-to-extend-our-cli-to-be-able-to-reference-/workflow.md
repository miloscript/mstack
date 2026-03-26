---
workflow: 2026-03-26-we-need-to-extend-our-cli-to-be-able-to-reference-
created: 2026-03-26T19:50:56.549Z
status: complete
---
# Workflow: we need to extend our cli, to be able to reference spec files as prompt, besides the string, the cli should have a mstack run -f argument where it supplies a file. When the file is suplied the contents of it will be added to the workflow docs, as usual. Also, do a change to the worklfow docs, where it would have the time when the workflow started, and the time when it ended.

## Config

```json
{
  "outputDir": ".mstack/",
  "model": "claude-sonnet-4-6",
  "orchestration": "code",
  "permissionMode": "acceptEdits",
  "maxRetries": 2,
  "tdd": {
    "enabled": true
  },
  "permissions": [
    "WebSearch",
    "WebFetch",
    "Bash(node:*)",
    "Bash(npm:*)",
    "Bash(npx:*)",
    "Bash(ls:*)",
    "Bash(find:*)",
    "Bash(git:*)",
    "Bash(gh:*)"
  ],
  "name": "my-project",
  "phases": {
    "analysis": {
      "enabled": true,
      "pre": [],
      "post": [],
      "skill": "analysis",
      "input": null
    },
    "plan": {
      "enabled": true,
      "pre": [],
      "post": [],
      "skill": "plan",
      "input": "analysis.md"
    },
    "implementation": {
      "enabled": true,
      "pre": [],
      "post": [],
      "skill": "implementation",
      "input": "plan.md"
    },
    "review": {
      "enabled": true,
      "pre": [],
      "post": [],
      "skill": "review",
      "input": {
        "plan": "plan.md",
        "implementation": "implementation.md"
      }
    },
    "test": {
      "enabled": true,
      "pre": [],
      "post": [],
      "skill": "test",
      "input": "implementation.md"
    },
    "document": {
      "enabled": false,
      "pre": [],
      "post": [],
      "skill": "document",
      "input": "implementation.md"
    },
    "ship": {
      "enabled": true,
      "pre": [],
      "post": [],
      "skill": "ship",
      "input": "implementation.md"
    }
  }
}
```

## Phase Status

| Phase | Status | Model | Timestamp |
|-------|--------|-------|-----------|

| analysis | in-progress | claude-sonnet-4-6 | 19:50 |
| analysis | complete | claude-sonnet-4-6 | 19:52 |
| plan | in-progress | claude-sonnet-4-6 | 19:52 |
| plan | complete | claude-sonnet-4-6 | 19:58 |
| implementation | in-progress | claude-sonnet-4-6 | 19:58 |
| implementation | complete | claude-sonnet-4-6 | 20:05 |
| review | in-progress | claude-sonnet-4-6 | 20:05 |
| review | complete | claude-sonnet-4-6 | 20:08 |
| test | in-progress | claude-sonnet-4-6 | 20:08 |
| test | complete | claude-sonnet-4-6 | 20:13 |
| ship | in-progress | claude-sonnet-4-6 | 20:13 |
| ship | complete | claude-sonnet-4-6 | 20:15 |
## User Inputs

