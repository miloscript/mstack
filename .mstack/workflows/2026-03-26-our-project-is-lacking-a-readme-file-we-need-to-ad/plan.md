---
phase: plan
workflow: 2026-03-26-our-project-is-lacking-a-readme-file-we-need-to-ad
timestamp: 2026-03-26T18:33:27.656Z
model: default
status: complete
---
# Plan — 2026-03-26-our-project-is-lacking-a-readme-file-we-need-to-ad

## User Input

> our project is lacking a README file. We need to add one. Before adding it, this is a high profile project, so I want you to check different high profile README files, and add a really great one


## Output

The plan document is ready. Please approve the file write to `.mstack/workflows/2026-03-26-our-project-is-lacking-a-readme-file-we-need-to-ad/plan.md` to proceed.

In the meantime, here is the complete implementation plan:

---

## File Changes

| # | File Path | Action | Description | Traces to Req |
|---|-----------|--------|-------------|---------------|
| 1 | `README.md` | **new** | Root README — full standalone reference | R1–R13 |
| 2 | `package.json` | **modify** | Add `license` and `engines` fields | Discovered Issues |

---

## README Section Structure

Based on research of Vite, Turborepo, Bun, Supabase, and esbuild — and accounting for the fact that mstack has **no external docs site** (making a deeper README necessary than gateway-style tools like Vite), the structure will be:

```
# mstack
> [tagline from package.json]
[badges: npm version | license | GitHub stars]
[2–3 sentence description]

## Install
## Quick Start
## How It Works
## Orchestration Modes
## CLI Reference
## Configuration
## Built-in Phases
## Skill System
## Contributing
## License
```

Key decisions:
- **No logo section** — no brand asset exists; plain `# mstack` heading
- **CI badge omitted** — no `.github/workflows/` exists; fabricated badges are disqualifying
- **esbuild convention** — "How It Works" comes before the CLI reference (conviction before instruction)
- **Supabase convention** — Orchestration Modes as a table (Channel | Purpose | When to use)
- **Bun convention** — Quick Start is 3 copy-pasteable steps with expected output

---

## Implementation Order

1. **Resolve open questions** ← blocking dependency
   - User must confirm: (a) license choice (MIT recommended), (b) npm publish status
2. **Modify `package.json`** — add `license` and `engines` fields
3. **Create `README.md`** — all content sourced from verified source files

---

## Test Strategy

No new `*.test.ts` file — this is a documentation change. Test obligation fulfilled via:

1. Every CLI command/flag in README verified against `bin/mstack.ts`
2. Every config field verified against `src/types.ts`
3. Every phase name/default verified against `defaults/mstack.config.js`
4. All code blocks syntactically valid
5. All relative links resolve to real files
6. `package.json` valid JSON after modification
7. `npm test` run to confirm no regressions

---

## Open Questions Requiring User Input Before Implementation

| Question | Recommended answer | Impact if skipped |
|---|---|---|
| **License?** | MIT | Blocks `package.json` + license section |
| **npm published?** | Unknown | Affects badge accuracy |
| **Logo asset?** | None currently | Plain H1 heading used |
