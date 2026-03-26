---
phase: analysis
workflow: 2026-03-26-our-project-is-lacking-a-readme-file-we-need-to-ad
timestamp: 2026-03-26T18:27:23.853Z
model: default
status: complete
---
# Analysis — 2026-03-26-our-project-is-lacking-a-readme-file-we-need-to-ad

## User Input

> our project is lacking a README file. We need to add one. Before adding it, this is a high profile project, so I want you to check different high profile README files, and add a really great one


## Output

The write requires your permission. Please approve the file write to `.mstack/workflows/2026-03-26-our-project-is-lacking-a-readme-file-we-need-to-ad/analysis.md` and I'll proceed. In the meantime, here is the full analysis output:

---

## Analysis — Add High-Quality README to mstack

### Precise Restatement of the Request

Create a `README.md` at the project root. The file does not yet exist. It must meet the quality bar of high-profile open source developer tools (Next.js, Vite, Supabase, Bun, Turborepo, esbuild, etc.), based on patterns researched from those projects before writing.

---

## Functional Requirements

1. **Create `README.md` at project root.** The file does not exist. Must be created at `/README.md` (project root, `package.json` level). No other location.

2. **Lead with a clear positioning statement.** A single memorable tagline answering "what is this and why does it exist" — analogous to "The React Framework for the Web." Source material: `spec.md` § "What mstack Is" and the `package.json` description field.

3. **Include trust-signal badges.** npm version, license, and a test/build status badge, placed immediately below the title. (Open question: npm published? CI pipeline?)

4. **Include a copy-pasteable quick-start section.** Covers `npm install -g mstack` → `mstack init` → `mstack run "<task>"`. Single code block, zero friction.

5. **Document all 5 CLI commands.** `init`, `run`, `resume`, `status`, `create-skill` — with flags and one-line descriptions from `bin/mstack.ts`.

6. **Explain the 3 orchestration modes.** `code`, `prompt`, `interactive` (from `src/types.ts` and `src/runner.ts`) — what each does and when to use it.

7. **Document the 8 built-in phases.** The default phase pipeline (`analysis`, `plan`, `implementation`, `review`, `test`, `document`, `ship`, `init`) with default enabled/disabled status from `defaults/mstack.config.js`.

8. **Include a config reference section.** Full `mstack.config.js` schema — `name`, `model`, `orchestration`, `outputDir`, `phases`, `maxRetries`, `tdd` — sourced from `src/types.ts`. Include a minimal working example.

9. **Explain the skill system.** How phases are driven by `.md` skill files, and how `mstack create-skill` works.

10. **Include a "How it Works" architecture overview.** Task → slug → phase loop → per-phase agent → output `.md` files → resumable. The conceptual model that makes the tool click for new users.

11. **Include contributing and development setup.** `npm run build`, `npm test`, `npm run dev`, test location (`tests/`, Vitest).

12. **Include license information.** *Blocked by open question below* — `package.json` has no `license` field.

13. **Use high-profile README visual and tonal conventions.** Centered title, badge row, `##` section hierarchy, code blocks for all commands and config, no marketing padding, no wall of text.

---

## Affected Areas

| File/Module | Why affected | Current behavior |
| ----------- | ------------ | ---------------- |
| `README.md` (root) | Primary deliverable | **Does not exist** |
| `package.json` | Version, name, description, license source | No `license` field; no `engines` field |
| `bin/mstack.ts` | All CLI command names, flags, and descriptions | 5 commands defined with commander |
| `src/types.ts` | Config schema for the config reference section | `MstackConfig` + `PhaseConfig` fully JSDoc'd |
| `defaults/mstack.config.js` | Config example and phase default values | 7 phases defined |
| `defaults/skills/*.md` | Phase names and descriptions | 9 skill files |
| `src/runner.ts` | Confirms 3 orchestration mode strings | Switch-dispatch to 3 mode runners |
| `spec.md` | Positioning language, design philosophy, "what it is not" | 73 KB; internal spec, not user-facing |

---

## Discovered Patterns

- **No README exists** — confirmed via Glob. `spec.md` is the only prose documentation and is an internal implementation spec.
- **`package.json` description** — `"Config-driven agentic dev workflow CLI built on Claude Code"` is usable as a starting point for the tagline.
- **Dog-fooding** — mstack uses itself (`.mstack/` at root). This is a credibility signal worth highlighting.
- **Version 0.1.0** — early stage; README must not oversell v2 features.
- **No license in `package.json`** — cannot write an accurate license section without resolving this.
- **No CI pipeline** — no live build-status badge is possible today.
- **High-profile README patterns researched** — single tagline, badge row, quick-start first, phase/feature list, architecture overview, contributing section, README as complete standalone reference (unlike Next.js/Vite which delegate to a docs site — mstack has no docs site).

---

## Constraints and Dependencies

- **No license declared** — must be resolved before the README can include a license section.
- **No CI badge available** — no `.github/workflows/`. Badge must be omitted or placeholder'd.
- **No `engines` field** — minimum Node.js version is undocumented. Inference: ^18 or ^20 based on `@types/node: ^22`.
- **Version 0.1.0** — "Out of Scope (v2)" features from `spec.md` (parallel execution, worktrees, multi-model) must not appear as current capabilities.
- **No external docs site** — the README must stand alone as the primary reference, making it richer than a "gateway" README like Next.js or Vite.
- **`spec.md` is internal only** — must not be referenced or linked in the user-facing README.

---

## Open Questions

- **License** — What license should be declared? `package.json` has no `license` field. **Blocks the license section.** Must be resolved before implementation.
- **GitHub repository URL** — Is there a public GitHub URL? Required for badge URLs and contributing links.
- **Node.js minimum version** — What is the minimum supported Node.js version? Needed for prerequisites section.
- **Logo/visual identity** — Does the project have a logo? High-profile READMEs use a centered SVG logo. Without one, the README opens with a plain `# mstack` heading.
- **npm publish status** — Has `mstack` been published to npm? Required to determine whether npm version badge is live or placeholder.

---

## Discovered Issues

- `package.json` missing `license` field — blocks accurate README license section; plan phase should add this.
- `package.json` missing `engines` field — Node.js version requirement is undeclared; plan phase should add or note it.
- No CI pipeline — no live build badge is possible; this is a broader gap beyond the README task scope.
