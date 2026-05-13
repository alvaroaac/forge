# Task 20 Progress

Status: DONE

What you implemented:
- Added `src/main/services/spec-prompt.ts` with `buildSpecPrompt(input)` and supporting `renderThoughts` helper.
- Added `tests/main/spec-prompt.test.ts` with the requested TDD failing test.
- `buildSpecPrompt` now returns:
  - `system`: deterministic, constant senior-engineer system prompt.
  - `user`: AGENTS content, rendered thoughts, issue fields (`id`, `title`, `description`, `priority`, `labels`), and provided template.

What you tested and test results, including initial failing test:
- `npx vitest run tests/main/spec-prompt.test.ts` (before implementation, by temporarily removing `src/main/services/spec-prompt.ts`):
  - **FAIL** (`Cannot load ../../src/main/services/spec-prompt`).
- `npx vitest run tests/main/spec-prompt.test.ts` (with implementation present):
  - **PASS** (1 test).
- `npm run test`:
  - **PASS** (13 files, 39 tests).
- `npm run typecheck`:
  - **PASS**.
- `npm run lint`:
  - **PASS** with existing repository warning: `tests/main/paths.test.ts` unused `vi` import (unchanged by this task).
- `npm run format:check`:
  - **PASS**.

Files changed:
- `src/main/services/spec-prompt.ts` (new)
- `tests/main/spec-prompt.test.ts` (new)
- `thoughts/tasks/phase1-mvp/impl/task-20/progress.md` (new)

Self-review findings:
- Implementation is deterministic and has no external I/O or API usage, as required.
- Message formatting is stable and minimal, with clear section boundaries and complete context injection.
- Complexity is low and consistent with project guidance.
- Test validates that system prompt includes required engineer context and user content includes all specified fields.

Tech-debt logged:
- None identified.

Commits made:
- `feat(main): build Claude prompt from issue+repo context` (current HEAD commit)

Concerns:
- None for functional scope.
- Lint command still reports one pre-existing warning outside this task (`tests/main/paths.test.ts`).
- Implementer model: `gpt-5.3-codex-spark`.
