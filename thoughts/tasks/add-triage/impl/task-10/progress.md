# Task 10 Progress

## Status: DONE

## What I changed
- Added `src/main/services/triage-prompt.ts` with `buildTriagePrompt(input: { issue: Issue }): { system: string; user: string }`.
- The system prompt now:
  - Introduces the triage brief objective for unrefined Linear triage issues.
  - Explicitly calls out the `--add-dir` context and `Glob`, `Grep`, and `Read` tool usage with a soft ~6 call recommendation.
  - Requires the four sections in order: What the user likely wants, Likely affected components, Open questions for reporter, Suggested next step.
  - Returns only markdown with no wrapper text.
- The user prompt now embeds:
  - issue id and title,
  - priority,
  - labels,
  - description,
  - and the cwd reminder that the current working directory is the computron repo root.
- Added `tests/main/triage-prompt.test.ts` exercising `buildTriagePrompt` for issue `FUL-77` with:
  - `title`: `job runner stuck`
  - `description`: `It stops at 30%`
  - `status`: `triage`
  - `priority`: `high`
  - `labels`: `['support']`
  - `isBug`: `true`
  - `assigneeId`: `null`

## Tests
- `npm test -- tests/main/triage-prompt.test.ts` (before implementation): failed (module missing / test suite failed to load module).
- `npm test -- tests/main/triage-prompt.test.ts` (after implementation): pass (1 test).

## Self-review findings
- No drift found against current task spec.
- No new tech debt introduced.

