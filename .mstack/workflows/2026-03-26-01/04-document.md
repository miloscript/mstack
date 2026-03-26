---
phase: document
workflow: 2026-03-26-01
timestamp: 2026-03-26T21:20:00.000Z
model: default
status: complete
---

# Developer Documentation — 2026-03-26-01

## Feature Summary

This release delivers nine interconnected improvements to the mstack CLI tool — a config-driven
agentic workflow system built on the Anthropic Claude SDK. The changes address reliability
(permission errors now hard-stop execution), usability (CTRL+C actually exits, the terminal
now renders like a modern CLI tool), data integrity (initial user input is persisted as a
file in every workflow directory so context cannot drift across phases), developer tooling
(semantic release, commitlint, CI/CD pipelines, npm publishing), and an entirely new
`mstack mistake` command that lets developers record lessons learned against a specific
workflow for future reference.

Every change was built with backward compatibility in mind: existing workflow files, skill
definitions, and `mstack.config.js` setups continue to work unchanged. New behaviour is
additive — file numbering falls back gracefully, input resolution accepts both legacy and
numbered filenames, and the "shipping" workflow state is inserted non-destructively into
the existing status lifecycle.

---

## Usage

### `mstack run` — standard workflow execution

No changes to the invocation surface. All improvements below are automatic.

```bash
# Run a workflow as before
mstack run --task "Add OAuth login"

# If a permission error occurs, the CLI now prints guidance and exits immediately:
# ✗ Permission Error in [phase] phase
# The agent was denied permission for a tool call.
# Fix: add the required tool to .claude/settings.local.json, then re-run.
```

### `mstack mistake` — record a lesson learned

```bash
# Prompts the agent to ask you about the mistake and append it to mistakes.md
mstack mistake

# Provide a specific workflow as context (recommended)
mstack mistake --workflow 2026-03-22-01
```

The agent will ask you what went wrong, analyse the workflow output for context, and append
a structured entry to `.mstack/knowledge/mistakes.md`:

```markdown
## 2026-03-26: Agent skipped permission fix step
- **What happened:** The analysis phase recommended adding a permission but the
  implementation phase didn't add it to settings.local.json.
- **Root cause:** The implementation skill didn't explicitly reference the permissions utility.
- **Prevention:** Always check permissions.ts when the analysis mentions tool access.
```

### CTRL+C to exit

CTRL+C now exits the process cleanly at any time — including during interactive approval
checkpoints. Previously it only printed a log line.

### Phase output files are numbered

Workflow output files are now prefixed with a zero-padded index:

```
.mstack/workflows/2026-03-26-01/
  initial-user-input.md     ← the original task, verbatim
  workflow.md               ← metadata and status
  01-analysis.md
  02-planning.md
  03-implementation.md
  04-document.md
```

### NPM package (programmatic use)

```bash
npm install mstack
```

```typescript
import { loadConfig, runWorkflow } from "mstack";

const config = await loadConfig();
await runWorkflow(config, { task: "Add caching layer" });
```

Type definitions ship with the package (`dist/src/index.d.ts`).

### Commit conventions (required for semantic release)

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add oauth login support
fix: prevent duplicate phase execution
docs: update README with new CLI flags
chore: bump vitest to 2.x
```

The husky `commit-msg` hook enforces this via commitlint. To activate after cloning:

```bash
npm install
npx husky
chmod +x .husky/commit-msg
```

---

## Architecture

### Permission Error Handling

**Files:** `src/utils/permission-error.ts`, `src/modes/code.ts`, `src/modes/interactive.ts`,
`src/utils/ui.ts`

When the Claude agent output matches any known permission-denial pattern
(`"permission denied"`, `"does not have permission"`, `"command requires approval"`, etc.),
`isPermissionError(text)` returns `true`. The calling code in `code.ts`/`interactive.ts`
immediately:

1. Calls `updateWorkflowFinalStatus(workflowDir, "permission-error")` — writes a
   timestamped terminal state to `workflow.md`.
2. Calls `printPermissionError(phaseName, details)` — renders a human-readable block
   explaining which tool was denied and how to add it to `.claude/settings.local.json`.
3. Calls `process.exit(1)`.

No subsequent phases run. The workflow directory is left intact so the developer can
inspect the partial output, fix the permission, and re-run.

**Data flow:**
```
Agent output text
  → isPermissionError(text) [permission-error.ts]
  → throw new PermissionError(details)
  → catch in runAgent() [code.ts / interactive.ts]
  → updateWorkflowFinalStatus("permission-error") [workflow-manager.ts]
  → printPermissionError() [ui.ts]
  → process.exit(1)
```

### CTRL+C / SIGINT

**Files:** `bin/mstack.ts` (line ~21), `src/utils/human-checkpoint.ts` (line ~14)

Two layers of signal handling:

- **Process level** (`bin/mstack.ts`): A `process.on("SIGINT")` handler at startup
  catches CTRL+C during any phase, prints a clean exit message, and calls
  `process.exit(0)`. This is the default path.
- **Readline level** (`human-checkpoint.ts`): When a `readline.Interface` is open for
  an interactive approval checkpoint, `rl.on("SIGINT")` closes the interface first to
  avoid stdio corruption, then exits.

### Initial User Input File

**Files:** `src/utils/workflow-manager.ts` (`writeInitialUserInput`),
`bin/mstack.ts` (call site), `src/utils/prompt-assembler.ts` (inclusion)

When `mstack run` creates a new workflow directory, it immediately writes the user's raw
task string to `initial-user-input.md` in that directory. The prompt assembler then reads
this file and prepends it to every phase prompt as an `### Input Documents` section, so
every agent (regardless of phase) always has access to the original intent without relying
on output from previous phases.

```typescript
// workflow-manager.ts
export function writeInitialUserInput(workflowDir: string, userTask: string): void {
  fs.writeFileSync(path.join(workflowDir, "initial-user-input.md"), userTask);
}

// prompt-assembler.ts — included automatically in assemblePrompt()
const inputPath = path.join(workflowDir, "initial-user-input.md");
if (fs.existsSync(inputPath)) {
  sections.push(`### initial-user-input.md\n\n${fs.readFileSync(inputPath, "utf8")}`);
}
```

### File Numbering

**Files:** `src/utils/output-writer.ts` (`phaseFileName`), `src/modes/code.ts`,
`src/utils/prompt-assembler.ts` (`resolveInputs`)

`phaseFileName(name, index)` returns `"01-analysis.md"` when `index = 1`, or
`"analysis.md"` when no index is given (backward-compatible fallback).

`resolveInputs` in `prompt-assembler.ts` handles the naming transition. When resolving
an `input:` reference for a phase:

1. It tries the exact filename (e.g. `analysis.md`).
2. If not found, it globs for `\d+-analysis.md` in the workflow directory.
3. If still not found, it logs a warning and continues.

This means workflows created before this release (without numbered outputs) continue to
work without any config changes.

### CLI UI System

**File:** `src/utils/ui.ts`

A self-contained ANSI terminal utilities module. No external dependencies (no `ora`,
no `chalk`). Key public API:

| Export | Description |
|---|---|
| `createSpinner(label)` | Returns `{ start(), stop(), fail(), clear() }`. Renders a braille spinner at 80 ms intervals. |
| `formatPhaseHeader(name, mode)` | Returns a `▶` header string for phase start. |
| `printPhaseComplete(name, durationMs)` | Prints `✓ {name} complete (1m5s)`. |
| `printPhaseFailed(name, reason)` | Prints `✗ Workflow stopped: …`. |
| `printPhaseSkipped(name)` | Prints `⏭ Skipping {name} (already complete)`. |
| `printPermissionError(phase, details)` | Structured error block with fix instructions. |
| `printWorkflowSummary(workflowDir)` | Lists all `.md` output files in the workflow dir. |
| `printRetry(name, attempt, max)` | Prints `↻ Retry 1/3 for {name}…`. |
| `formatDuration(ms)` | `"1m5s"` / `"5s"` helper used by phase completion prints. |

ANSI codes are applied inline; no runtime dependency required. The module works in any
Node.js 20+ environment.

### `mstack mistake` Command

**Files:** `src/mistake.ts`, `bin/mstack.ts`, `defaults/skills/mistake.md`,
`.mstack/skills/mistake.md`

The command spawns an interactive SDK agent using `query()` from
`@anthropic-ai/claude-agent-sdk`. The agent is given:

- The `mistake.md` skill as its system prompt
- Current `mistakes.md` content (so it doesn't duplicate)
- Workflow output snippets if `--workflow` was specified (truncated to 1000 chars)
- A list of recent workflow slugs if no specific workflow was provided

The agent uses `AskUserQuestion` to prompt the developer, then writes a structured entry
to `.mstack/knowledge/mistakes.md`. The skill definition at `defaults/skills/mistake.md`
is the canonical template — `.mstack/skills/mistake.md` is the dogfood copy used when
running mstack on its own codebase.

### Ship Workflow Status Fix

**Files:** `src/modes/code.ts`, `src/utils/workflow-manager.ts`

Previously, the ship workflow would commit changes before the final phase wrote its output,
meaning `workflow.md` was committed in an `in-progress` state. The fix adds a `"shipping"`
intermediate state:

```typescript
// code.ts — just before the last phase runs
if (phaseName === lastPhaseName) {
  updateWorkflowFinalStatus(workflowDir, "shipping");
}
```

Full lifecycle of `workflow.md`'s `status` field:

| Value | Set when |
|---|---|
| `in-progress` | Workflow directory created |
| `shipping` | Final phase is about to execute |
| `complete` | All phases succeeded (timestamped) |
| `failed` | Any phase failed (timestamped) |
| `permission-error` | Agent was denied a tool call (timestamped) |

The ship skill/workflow should read `status: shipping` as the signal that all intermediate
outputs are committed and `workflow.md` needs one final update before the git commands run.

### Dev Workflow (CI/CD)

**Files:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`,
`.commitlintrc.json`, `.husky/commit-msg`, `release.config.js`

**CI** (`.github/workflows/ci.yml`):
- Triggers on push to `main`/`develop` and pull requests to `main`
- Matrix: Node 20.x and 22.x
- Steps: `npm ci` → `npm run build` → `npm run test:run`
- PRs also run `commitlint` against all commits in the range

**Release** (`.github/workflows/release.yml`):
- Triggers on push to `main` only
- Runs full build + test suite, then `npx semantic-release`
- Requires two GitHub secrets: `GITHUB_TOKEN` (auto-provided) and `NPM_TOKEN`
  (must be created manually from npmjs.com and added to repo settings)

**Commit lint** (`.commitlintrc.json`):
- Extends `@commitlint/config-conventional`
- Permitted types: `feat fix docs style refactor perf test build ci chore revert`
- Subject: lowercase, max 100 chars; body lines: max 120 chars

**Semantic release** (`release.config.js`):
- Branch: `main` only
- Publishes to npm, creates GitHub release, updates `CHANGELOG.md`, commits version bump
- Version bump rules follow conventional commits:
  - `feat` → minor, `fix`/`perf` → patch, `BREAKING CHANGE` footer → major

### NPM Publishing

**Files:** `package.json`, `.npmignore`

Key fields added to `package.json`:

```json
{
  "main": "./dist/src/index.js",
  "exports": {
    ".": {
      "import": "./dist/src/index.js",
      "types":  "./dist/src/index.d.ts"
    }
  },
  "types": "./dist/src/index.d.ts",
  "files": ["dist/", "defaults/"],
  "engines": { "node": ">=20.0.0" },
  "repository": { "type": "git", "url": "https://github.com/..." },
  "scripts": {
    "prepublishOnly": "npm run build && npm run test:run"
  }
}
```

`.npmignore` excludes source files, test files, dev config (`.github/`, `.husky/`,
`.mstack/`, `.commitlintrc.json`), and build artifacts from the published tarball.
Only `dist/` and `defaults/` are shipped. The `prepublishOnly` script ensures the
package is always built and tested before publication.

---

## Files

| File | Purpose |
|---|---|
| `src/utils/permission-error.ts` | `PermissionError` class and `isPermissionError(text)` detection function |
| `src/utils/ui.ts` | ANSI terminal UI: spinner, phase headers, completion/failure/skip messages, permission error guidance |
| `src/utils/workflow-manager.ts` | `writeInitialUserInput()` and `updateWorkflowFinalStatus()` — workflow directory and metadata management |
| `src/utils/output-writer.ts` | `phaseFileName(name, index)` — zero-padded output filenames, phase frontmatter writing |
| `src/utils/prompt-assembler.ts` | `assemblePrompt()` — includes `initial-user-input.md`; `resolveInputs()` — numbered+legacy file resolution |
| `src/utils/human-checkpoint.ts` | readline-based approval checkpoints with SIGINT handler |
| `src/modes/code.ts` | Phase orchestration: calls `isPermissionError`, triggers "shipping" state, passes `phaseIndex` for numbering |
| `src/modes/interactive.ts` | Interactive mode counterpart — same permission error and numbering integration |
| `src/mistake.ts` | `recordMistake()` — `mstack mistake` command implementation |
| `bin/mstack.ts` | CLI entry point: `process.on("SIGINT")`, `mistake` command registration, `writeInitialUserInput` call |
| `defaults/skills/mistake.md` | Canonical `mistake` skill template (shipped with npm package) |
| `.mstack/skills/mistake.md` | Dogfood copy of the mistake skill used when running mstack on itself |
| `.github/workflows/ci.yml` | CI pipeline: build + test on Node 20/22, commitlint for PRs |
| `.github/workflows/release.yml` | Release pipeline: semantic-release on merge to main |
| `.commitlintrc.json` | Commitlint rules (conventional commits, type enum, length limits) |
| `.husky/commit-msg` | Git hook: runs `npx commitlint --edit "$1"` on every commit |
| `release.config.js` | Semantic release configuration: plugins, branch, changelog, npm publish |
| `.npmignore` | Excludes src/tests/dev-config from npm tarball |
| `package.json` | Updated `exports`, `types`, `main`, `files`, `engines`, `repository`, `keywords`, `prepublishOnly` |

---

## Documentation Updates

- `README.md`: Needs a new **"Recording Mistakes"** section documenting `mstack mistake
  [--workflow <slug>]`, a **"Conventional Commits"** note for contributors explaining the
  commitlint enforcement, and an **"npm install"** / programmatic-use section now that the
  package is publishable. No update was made in this phase because the README was not in
  scope — flagged for a follow-up.
- `defaults/skills/mistake.md`: Created as new file. No prior documentation to update.
- `CHANGELOG.md`: Will be auto-generated by semantic-release on first release — do not
  create or edit manually.

---

## Discovered Issues

1. **`.husky/commit-msg` needs `chmod +x`** — The hook file was created but `chmod +x`
   could not be run during the implementation phase (shell permission was denied). Any
   developer cloning the repo must run `chmod +x .husky/commit-msg` manually, or run
   `npx husky` which sets permissions automatically.

2. **`NPM_TOKEN` GitHub secret is not configured** — The release workflow will fail on
   the npm publish step until an `NPM_TOKEN` is added to the repository's secret store
   (`Settings → Secrets → Actions`). The token must have `publish` scope on the `mstack`
   package namespace.

3. **New devDependencies not installed yet** — `@commitlint/cli`, `@commitlint/config-conventional`,
   `husky`, `semantic-release`, and its plugins were added to `package.json` but
   `npm install` has not been confirmed to have run. Run `npm install && npx husky`
   before making the first conventional commit.

4. **README not updated** — The programmatic API, `mstack mistake` command, and
   conventional-commits requirement are not yet documented in the README. This should be
   addressed in a dedicated documentation pass.

5. **`mstack mistake` requires an interactive terminal** — The underlying `query()` call
   uses `AskUserQuestion`, which blocks on stdin. Running `mstack mistake` in a
   non-interactive CI environment will hang. There is currently no `--non-interactive`
   flag or timeout guard.
