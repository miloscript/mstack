---
workflow: 2026-03-26-2nd-attempt---our-project-is-lacking-a-readme-file
created: 2026-03-26T19:12:40.769Z
status: complete
---
# Workflow: 2nd attempt - our project is lacking a README file. We need to add one. Before adding it, this is a high profile project, so I want you to check different high profile README files, and add a really great one.

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
      "post": [
        "human"
      ],
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
      "pre": [
        "human"
      ],
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

| analysis | in-progress | claude-sonnet-4-6 | 19:12 |
| analysis | complete | claude-sonnet-4-6 | 19:19 |
| plan | in-progress | claude-sonnet-4-6 | 19:19 |
| plan | complete | claude-sonnet-4-6 | 19:22 |
| implementation | in-progress | claude-sonnet-4-6 | 19:22 |
| implementation | complete | claude-sonnet-4-6 | 19:26 |
| review | in-progress | claude-sonnet-4-6 | 19:26 |
| review | complete | claude-sonnet-4-6 | 19:28 |
| test | in-progress | claude-sonnet-4-6 | 19:29 |
| test | complete | claude-sonnet-4-6 | 19:31 |
| ship | in-progress | claude-sonnet-4-6 | 19:31 |
| ship | complete | claude-sonnet-4-6 | 19:34 |
## User Inputs

