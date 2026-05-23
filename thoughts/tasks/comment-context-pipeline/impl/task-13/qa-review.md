# Task 13 QA Review - `register.ts` comment-context wiring coverage

## Strengths

- Production wiring is narrow and correctly located at the composition boundary. `src/main/ipc/register.ts:16-18` imports the shared `fetchAndFilterComments`, `CommentsClient`, `RawLinearComment`, and `triageComments` service contracts instead of introducing a second raw comment shape or adapter module.
- The raw Linear comment shape is not duplicated in `register.ts`. `LinearClient.fetchIssueComments` returns `Promise<RawLinearComment[]>` in `src/main/ipc/register.ts:38-45`, reusing the exported type from `src/main/services/comment-fetcher.ts`.
- Auth, config, and existing register behavior look preserved. `registerAll` still creates the config store/cache, loads config, creates the Linear client from the skill module, and registers config/auth/linear/spec/triage handlers in the existing shape; the new comment-context deps are added only to the spec and triage generation registrations.
- Spec and triage comment deps are bound consistently. Both handlers receive `fetchAndFilterComments: (issueUuid) => fetchAndFilterComments(client as CommentsClient, issueUuid)` and a `triageComments` wrapper that injects the shared `streamClaude` dependency in `src/main/ipc/register.ts:95-106` and `src/main/ipc/register.ts:129-145`.
- The `streamTriageBrief` dependency still receives `streamClaude` through its existing generator boundary in `src/main/ipc/register.ts:136-145`, so Task 13 does not fork the triage brief generation path.
- The new `registerAll` test exercises the real composition function rather than only recreating the lambda in isolation. It loads a temporary Linear skill module, captures the deps passed to the registered spec/triage handlers, and verifies both comment-fetch bindings call the bound client's `fetchIssueComments` with the supplied UUID.
- Mocking the child registration functions is maintainable for this specific composition test. It avoids invoking every IPC handler implementation and keeps the assertion focused on the dependency objects that `registerAll` builds. The test is a little broad because it must mock every imported registration module, but that is acceptable at this boundary.
- Commit `5ed915f` is scoped to `tests/main/register.test.ts` plus the Task 13 progress artifact; the production wiring was already present from Tasks 11 and 12 and was not churned here.

## Issues

### Critical

None.

### Important

None.

### Minor

- `tests/main/register.test.ts:153-166` asserts the captured `triageComments` deps with `comments: []`, which hits the triager's empty-input fast path in `src/main/services/comment-triager.ts:72-75`. That proves the functions are callable, but it does not prove the register wiring injects the real `streamClaude` dependency for non-empty comments. A future tightening could call each captured `triageComments` with one normalized comment and assert the hoisted `streamClaude` mock is invoked twice, which would protect the exact binding this task cares about.

## Drift detected

None. I did not find repeated drift from prior QA themes: no raw comment shape duplication, no identifier/UUID bridge revival, no duplicate prompt construction, no weakened shared contract, and no production adapter layer around the triager's `streamClaude` signature.

## Assessment

Approved. Production wiring is clean, spec and triage deps are composed consistently, and the register-level test gives useful coverage of the UUID comment-fetch binding. The only follow-up worth considering is a small non-empty-comment assertion so the triager/`streamClaude` binding is protected as strongly as the fetch binding.

Verification run:
- `npm test -- tests/main/register.test.ts` - passed, 1 file / 1 test.
- `npm run typecheck` - passed.
