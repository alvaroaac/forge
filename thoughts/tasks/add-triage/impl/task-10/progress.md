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


## Fix Update (Task-10 QA)

- Corrected `src/main/services/triage-prompt.ts` system contract to enforce spec-pinned headings and constraints in exact format:
  - `**What the user likely wants**` with 1-3 sentences, plain language
  - `**Likely affected components**` as bullet list with file paths/modules and one-line reasons
  - `**Open questions for reporter**` as bullet list
  - `**Suggested next step**` constrained to the allowed set with one-sentence rationale
- Preserved soft recommendation for approximately 6 tool calls and explicit `Read`, `Glob`, `Grep`, `--add-dir` guidance.
- Tightened `tests/main/triage-prompt.test.ts` to assert heading order, exact heading tokens, full contract fragments, and prompt/option presence so regressions are caught structurally.
- Re-ran: `npm test -- tests/main/triage-prompt.test.ts && npm run typecheck` (pass).
- Commit created for this QA fix.

- Commit SHA for fix: `1c50ef2`

## Additional QA Follow-up

- Finalized tool-call guidance phrasing to be explicitly soft: now says
  `As a recommendation, aim for roughly 6 tool calls; this is a soft hint, not a hard limit.`
- Strengthened test assertions to require soft-hint semantics (`recommendation`, `soft`, `hard limit`, and `aim for roughly 6 tool calls`).
- Re-ran: `npm test -- tests/main/triage-prompt.test.ts && npm run typecheck` (pass).
- Commit SHA for this narrow QA follow-up: `follows this message`.
