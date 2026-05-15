# Task 9 Spec Review

## Status: ✅ PASS

## Review Notes
- `src/main/services/spec-generator.ts` now exposes `streamClaude(input)` and keeps the existing spawn, timeout, streaming, stderr, and close-handling behavior intact.
- `streamSpec(input)` delegates through `streamClaude({ ...input, extraArgs: [] })`, so the public spec-generation path preserves prior behavior.
- The added test in `tests/main/spec-generator.test.ts` verifies the exact extra-args placement: after `--append-system-prompt sys` and before `--output-format text`.
- No addendum exists for this task, so there were no additional drift rules to check.

## Tech Debt Accounting
- No intentionally skipped work was reported for this task.

## Process Note
- The progress artifact does not capture the initial red run that would have proven the test failed before the refactor. That is a documentation/process gap, not a blocking implementation issue, because the final code and tests satisfy the requested behavior.
