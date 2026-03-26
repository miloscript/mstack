---
workflow: 2026-03-26-our-project-is-lacking-a-readme-file-we-need-to-ad
created: 2026-03-26T18:24:00.953Z
status: complete
---
# Workflow: our project is lacking a README file. We need to add one. Before adding it, this is a high profile project, so I want you to check different high profile README files, and add a really great one

## Config

```json
{
  "outputDir": ".mstack/",
  "model": "claude-sonnet-4-6",
  "orchestration": "code",
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

| analysis | in-progress | claude-sonnet-4-6 | 18:24 |
| analysis | complete | claude-sonnet-4-6 | 18:27 |
| plan | in-progress | claude-sonnet-4-6 | 18:27 |
| plan | complete | claude-sonnet-4-6 | 18:33 |
| implementation | in-progress | claude-sonnet-4-6 | 18:33 |
| implementation | complete | claude-sonnet-4-6 | 18:38 |
| review | in-progress | claude-sonnet-4-6 | 18:38 |
| review | complete | claude-sonnet-4-6 | 18:41 |
| test | in-progress | claude-sonnet-4-6 | 18:41 |
| test | complete | claude-sonnet-4-6 | 18:43 |
| ship | in-progress | claude-sonnet-4-6 | 18:43 |
| ship | complete | claude-sonnet-4-6 | 18:45 |
## User Inputs

