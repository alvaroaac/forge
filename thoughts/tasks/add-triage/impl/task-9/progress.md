# Task 9 Progress

## Status: DONE

## What I changed
- Refactored `src/main/services/spec-generator.ts` to extract shared Claude execution logic into `streamClaude(input)`.
- Added optional `extraArgs?: readonly string[]` to `streamClaude` via `StreamClaudeInput`.
- Updated `buildClaudeArgs` to insert `extraArgs` between `--append-system-prompt` and `--output-format`.
- Updated `streamSpec(input)` to delegate to `streamClaude({ ...input, extraArgs: [] })`, preserving existing behavior.
- Extended `tests/main/spec-generator.test.ts` to export-import `streamClaude` and assert args:
  `['-p','--model','claude-sonnet-4-6','--append-system-prompt','sys','--add-dir','/tmp/repo','--allowedTools','Read,Glob,Grep','--output-format','text']`.

## Tests
- `npm test -- tests/main/spec-generator.test.ts` (before changes): passed baseline file-level coverage without `streamClaude` tests.
- `npm test -- tests/main/spec-generator.test.ts` (after changes): pass (3 tests).

## Notes
- No new tech debt introduced for this task.
