Now I have a complete picture of the codebase. Here is the full project profile:

---

# Project Profile — mstack

## Tech Stack

| Layer           | Technology                      | Version   | Notes                                          |
| --------------- | ------------------------------- | --------- | ---------------------------------------------- |
| Language        | TypeScript                      | ^5.4      | Strict mode, ES2022 target, Node16 modules     |
| Runtime         | Node.js                         | ^22 (@types) | ESM (`"type": "module"`), Node16 resolution |
| Framework       | None                            | —         | Pure Node.js CLI; no web framework             |
| AI/Agent SDK    | @anthropic-ai/claude-agent-sdk  | ^0.2.84   | Provides `query()` async generator interface  |
| CLI Framework   | commander                       | ^12.0     | Subcommand-based CLI                           |
| Testing         | Vitest                          | ^2.0      | Unit tests; SDK aliased via mock               |
| Package Manager | npm                             | (lock v3) | package-lock.json present                     |
| Build           | tsc (TypeScript compiler)       | ^5.4      | Outputs to `dist/`, no bundler                |

## Project Structure

```
mstack/
├── bin/
│   └── mstack.ts              # CLI entry point (commander subcommands)
├── src/
│   ├── index.ts               # Public re-export barrel
│   ├── types.ts               # MstackConfig, PhaseConfig interfaces
│   ├── config.ts              # loadConfig(), validateAndApplyDefaults(), getEnabledPhases()
│   ├── runner.ts              # run() — dispatches to orchestration mode
│   ├── resume.ts              # resume() — skip completed phases and rerun
│   ├── scaffold.ts            # scaffold() — init .mstack/ from defaults/
│   ├── status.ts              # printStatus() — workflow listing / detail
│   ├── skill-builder.ts       # createSkill() — scaffold new skill .md file
│   ├── claude-code.d.ts       # Hand-written ambient types for SDK
│   ├── modes/
│   │   ├── code.ts            # Code mode: CLI drives phase loop via SDK
│   │   ├── prompt.ts          # Prompt mode: Claude drives loop via orchestrator skill
│   │   └── interactive.ts     # Interactive mode: human checkpoints between phases
│   └── utils/
│       ├── prompt-assembler.ts  # assemblePrompt(), loadSkill(), resolveInputs(), loadKnowledge()
│       ├── output-writer.ts     # writePhaseOutput(), writeErrorOutput()
│       ├── workflow-manager.ts  # slug/dir creation, status tracking, frontmatter parsing
│       └── human-checkpoint.ts  # readline-based human approval gate
├── defaults/                  # Shipped in npm package; copied on `mstack init`
│   ├── mstack.config.js       # Default config template
│   ├── prompts/
│   │   └── universal.md       # Universal system prompt prepended to all phases
│   ├── skills/                # 9 built-in skill files (analysis, plan, implementation,
│   │   └── *.md               # review, test, document, ship, orchestrator, init)
│   └── commands/
│       └── mstack.md          # Claude Code /mstack slash command
├── tests/
│   ├── __mocks__/
│   │   └── claude-code.ts     # Vitest mock for @anthropic-ai/claude-agent-sdk
│   ├── fixtures/
│   │   └── sample-config.js   # Fixture config for tests
│   ├── config.test.ts
│   ├── runner.test.ts
│   ├── scaffold.test.ts
│   ├── prompt-assembler.test.ts
│   └── workflow-manager.test.ts
├── .mstack/                   # mstack's own config (dog-fooding)
│   ├── mstack.config.js
│   ├── prompts/, skills/      # Live copies of defaults
│   └── knowledge/
│       ├── mistakes.md
│       └── patterns.md
├── .claude/
│   ├── commands/mstack.md     # Installed slash command
│   └── settings.local.json
├── dist/                      # Compiled output (bin/ + src/)
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
└── spec.md                    # 73 KB project specification document
```

**Entry points:**

- **CLI binary:** `bin/mstack.ts` → compiled to `dist/bin/mstack.js`, registered as `mstack` in `bin` field
- **Library API:** `src/index.ts` (barrel re-export of all public symbols)
- **Config resolution:** `.mstack/mstack.config.js` → `mstack.config.js` in CWD → explicit `--config` path

## Patterns and Conventions

### Naming

- **Files:** `kebab-case.ts` (e.g., `prompt-assembler.ts`, `workflow-manager.ts`, `skill-builder.ts`)
- **Functions:** `camelCase`, exported as named exports (e.g., `loadConfig`, `runCodeMode`, `assemblePrompt`)
- **Types/Interfaces:** `PascalCase` with `I`-free naming (e.g., `MstackConfig`, `PhaseConfig`, `AssemblePromptParams`)
- **Constants:** `SCREAMING_SNAKE_CASE` for module-level constants (e.g., `VALID_MODES`, `CONFIG_DEFAULTS`, `PHASE_DEFAULTS`)
- **Test files:** `<subject>.test.ts` co-located in `tests/` (flat, not mirroring `src/`)

### Architecture

- **Layered / functional decomposition:** `bin` (CLI shell) → `runner` (dispatch) → `modes/` (orchestration strategies) → `utils/` (pure helpers)
- **No classes:** All modules export plain functions; state is passed explicitly (no singletons, no DI container)
- **Three orchestration modes:**
  - `code` — CLI drives the phase loop; each phase spawns a headless SDK agent
  - `prompt` — a single SDK agent is given the orchestrator skill and drives itself
  - `interactive` — code mode but with human checkpoint gates before/after phases
- **Skill system:** Phases are defined by `.md` skill files loaded at runtime; content is assembled into prompts via `assemblePrompt()`
- **Workflow persistence:** Each run creates a dated slug directory under `.mstack/workflows/`; phase completion is detected by the presence of `<phase>.md` output files (enables resume)
- **Per-phase output format:** YAML frontmatter + `## User Input` + `## Output` sections written by `output-writer.ts`
- **Retry loop:** Each phase retries up to `config.maxRetries` times before marking the workflow `failed`

### Code Style

- Node.js stdlib imported via `node:` protocol prefix (`node:fs`, `node:path`, `node:readline`)
- `async/await` throughout; SDK interaction uses `for await...of` over the async generator
- Dynamic `import()` used for SDK to avoid hard failures when SDK unavailable (e.g., in `scaffold.ts`, `modes/*.ts`)
- Error handling: explicit `err instanceof Error ? err.message : String(err)` pattern everywhere
- TypeScript `strict: true`; liberal use of `as` casts only when interacting with the loosely-typed SDK message stream
- No external utility libraries (lodash, etc.) — vanilla Node.js stdlib only
- `tsconfig.json` excludes `tests/` from compilation (Vitest runs tests directly via tsx/esbuild)

## Testing Setup

- **Framework:** Vitest ^2.0
- **Run all:** `npm test` (runs `vitest`)
- **Run with coverage:** `npm run test:cov` (runs `vitest --coverage`)
- **Test location:** `tests/` directory (flat, not mirroring `src/`)
- **Naming:** `<module>.test.ts` (e.g., `config.test.ts`, `runner.test.ts`)
- **Coverage:** Configured via `test:cov` script; coverage provider not explicitly set in vitest.config.ts (uses Vitest default — v8)
- **SDK Mock:** `vitest.config.ts` aliases `@anthropic-ai/claude-agent-sdk` to `tests/__mocks__/claude-code.ts`, which exports a `vi.fn()` mock of `query()` returning a single success result message
- **Test patterns:**
  - `beforeEach`/`afterEach` with `fs.mkdtempSync` to create isolated temp directories
  - `process.chdir()` to simulate different CWDs
  - `vi.spyOn(console, 'log')` for console output assertions
  - Fixtures in `tests/fixtures/` for reusable config files
- **What is tested:** `loadConfig`, `getEnabledPhases`, `scaffold`, `run` dispatch, `prompt-assembler`, `workflow-manager`

## Build and Deploy

- **Build:** `npm run build` → `tsc` compiles `bin/**/*.ts` + `src/**/*.ts` to `dist/`; `declaration: true` emits `.d.ts` files; `sourceMap: true`
- **Dev/Watch:** `npm run dev` → `tsc --watch`
- **Pre-publish:** `prepublishOnly` runs `npm run build` automatically
- **Published artifacts:** `dist/` + `defaults/` (declared in `files` field of `package.json`)
- **CI:** Not detected — no `.github/workflows/`, no `.gitlab-ci.yml`, no `Makefile`
- **Deploy:** npm publish (implied by `prepublishOnly` hook and `bin` field); no containerization detected
- **Env:** No `.env` file detected; no required environment variables identified in source (SDK auth handled externally by Claude Code runtime)

## Existing Documentation

- **`spec.md`** (73 KB) — Large specification document at project root; appears to be the primary design reference
- **`defaults/skills/*.md`** — 9 built-in skill files (effectively agent prompt documentation): `analysis.md`, `plan.md`, `implementation.md`, `review.md`, `test.md`, `document.md`, `ship.md`, `orchestrator.md`, `init.md`
- **`defaults/prompts/universal.md`** — Universal system prompt injected into every phase
- **`defaults/commands/mstack.md`** — Claude Code slash command definition
- **`.mstack/knowledge/mistakes.md`** — Skeleton for accumulated mistake patterns (currently near-empty)
- **`.mstack/knowledge/patterns.md`** — Skeleton for accumulated code patterns (currently near-empty)
- No `README.md` detected at project root
- No `docs/` directory detected
- No ADRs detected

## Discovered Issues

None found during this read-only scan that are outside the scope of this init phase. Observations only:

- `src/claude-code.d.ts` is a hand-authored ambient module declaration for the SDK. The real SDK package (`@anthropic-ai/claude-agent-sdk`) is a runtime dependency — it is unclear whether the SDK ships its own `.d.ts` types. The hand-authored declaration may drift if the SDK interface changes.
- `interactive.ts` duplicates the phase-loop logic and the `printWorkflowSummary` function from `code.ts`. Both files are nearly identical in structure; a refactor opportunity exists but is not a defect.
- No CI pipeline is configured; there is no automated test gate before publish.