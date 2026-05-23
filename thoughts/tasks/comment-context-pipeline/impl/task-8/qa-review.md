# Task 8 QA Review - Wire `curatedComments` into `triage-generator`

## Strengths

- Scope is narrow. Commit `cd141ac` only changes `src/main/services/triage-generator.ts`, `tests/main/triage-generator.test.ts`, and the Task 8 progress artifact.
- The passthrough shape is type-safe and local to the injected dependency contract. `StreamTriageBriefInput` includes `curatedComments?: string`, and the `streamClaude` callback input includes the same optional field at `src/main/services/triage-generator.ts:8` and `src/main/services/triage-generator.ts:19`.
- Prompt construction remains single-sourced through `buildTriagePrompt({ issue: input.issue })`; Task 8 does not duplicate or fork any triage prompt logic.
- The forwarding path is direct and unsurprising: `streamTriageBrief` passes `input.curatedComments` to `streamClaude` beside the already existing model/system/user/cwd/args fields.
- Absent values remain undefined at the boundary. The test at `tests/main/triage-generator.test.ts:68` proves callers that omit `curatedComments` produce an undefined value for the injected `streamClaude` input.
- The existing CLI setup behavior is untouched, including `cwd`, `--add-dir`, allowed tools, `onChunk`, and `onStatus`.

## Issues

### Critical

None.

### Important

None.

### Minor

None.

## Drift detected

None. I did not find duplicated prompt logic or the kind of circular/mock-only behavior called out in earlier QA reviews. The absent Task 6 QA file limits direct drift comparison for that task, but Task 8 does not repeat a visible Task 1-5 drift pattern.

## Assessment

Approved. The value is forwarded through a typed passthrough shape, prompt generation stays centralized, and the absent case is covered as undefined.

Verification run:
- `npm test -- tests/main/triage-generator.test.ts` - passed, 1 file / 3 tests.
- `npm run typecheck` - passed.
