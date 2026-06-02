# Plan roast — 2026-05-20

Source plan: `docs/superpowers/plans/2026-05-20-comment-context-pipeline.md` (v1, pre-revision).
Reviewer: brutally-critical senior-engineer subagent (general-purpose), dispatched after a zero-comment `plan-review` browser pass.

Severity-ordered punch list reproduced verbatim from the subagent.

---

## BLOCKER

**B1. The "triager failure must not block generation" test for triage is circular and proves nothing.**
Plan lines 1784–1815 (Task 13, second test): `triageComments: async () => { throw new Error('boom'); }` and then `expect(observed).toBe('')` — but `observed` is captured inside the *fake* `streamTriageBrief` that the test itself provides. The test verifies that the handler passes `''` to a stub the test wrote. The real failure mode (an uncaught rejection escaping `await deps.triageComments(...)` and tearing down the handler before the `streamTriageBrief` call) is not exercised because the plan's handler body has the try/catch literally there. Same circularity in Task 12 (lines 1545–1571). Add an assertion that `console.warn` was invoked, and a separate assertion that the error event channel was NOT emitted — both are observable behaviour, not handler-internal.

**B2. Identifier→UUID resolution adds a full extra Linear roundtrip per generation and the plan doesn't even acknowledge it as a cost.**
Plan lines 1980–1989 (Task 14): `fetchAndFilterCommentsByIdentifier` calls `client.fetchIssueDetail(identifier)` purely to extract `detail.id` (UUID), then a second query for comments. `src/main/services/linear-service.ts:39` confirms `Issue.id = raw.identifier` and `raw.id` (UUID) is discarded at `mapIssue`. Fix at the source: either (a) extend `IssuesCache`/`Issue` with a `uuid` field so the cached issue already has it, or (b) inline the comment fetch into the existing `fetchIssueDetail` GraphQL query. Two roundtrips per spec/triage to recover info that was thrown away three lines earlier is gratuitous.

**B3. Task 12's test fixture conflicts with the actual `Issue` shape — `id: 'FUL-77'` is fine, but the test depends on `cache.read()` returning an issue whose `id === 'FUL-77'` while also assuming the handler can derive a UUID from it.** `findIssue` at `src/main/ipc/spec.ts:74` matches on identifier; the new `fetchAndFilterComments` dep is invoked with `payload.issueId` (the identifier). The test stubs `fetchAndFilterComments: async () => [...]` so it passes — but the test is silent about the identifier→UUID bridge that B2 introduces. In `register.ts` wiring the bridge runs a second `fetchIssueDetail`; that path has zero test coverage. Add a wiring test.

**B4. `ipc-spec-generate.test.ts` already exists (451 lines).** Plan line 50 says "create new file". `ls tests/main/` confirms the file is present. Task 12 will either clobber existing coverage or implementer will get confused. Plan must say "extend".

## MAJOR

**M1. Rule 4 test "consecutive-author collapse" measures nothing because the mock returns a hand-crafted string with the expected counts baked in.**
Lines 831–848: the mock returns `**alice:** ... **bob:** ... **alice:** ...` and then the test asserts there are exactly 2 alice blocks and 1 bob block. This pins the test fixture against itself. Spec lines 286–294 explicitly say "the assertion targets the rendered output, not the prompt" — but the rendered output IS the mock. Acknowledge in the plan that these are smoke-tests of contract shape, not behaviour, and stop calling them "Rule 4 coverage".

**M2. Rule 6 prompt-coverage assertion uses an unescaped regex literal that won't match the constant.**
Line 742: `expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toMatch(/## Relevant Comments\n_\(none\)_/)`. The constant contains the literal characters `\n` (backslash-n) as a four-char escaped sequence (lines 510–511 wrap the rule text inside backticks with escaped `\\n`). The regex `\\n` matches `\n` (backslash-n) — that's right for the literal text, but the prompt template directs the LLM to output `_(none)_` with an actual newline. Either way, this test pins the *prompt text*, not the rendered output, and the prompt text contains a backslash-n inside backticks — fine, but Rule 7's regex (line 749) `no code\\n   fences wrapping the whole output` is similarly brittle and the indentation `   ` (3 spaces) must match the constant verbatim. One whitespace edit in the prompt and the test snaps. Use `toContain('## Relevant Comments\n_(none)_')` and ditch the regex.

**M3. Per-rule "end-to-end" mocked-output fixtures (Task 7) are identical in structure to Task 6 and equally circular.**
Lines 915–927 (Rule 2): mock returns `"+1"` reaction noise line, assertion checks for `Alice (noise)`. The test confirms the mock returned what the test wrote. Six near-identical no-ops. Either replace with one parameterized table-driven test, or delete and accept that LLM behaviour is validated manually (spec §3 already says exactly this at line 294).

**M4. Rule 5 reason-vocabulary leak detector is unsound.**
Lines 957–963: regex `/\(([a-z'-]+)\):/gi` will match every parenthesized lowercase word in the output, including, say, "(see auth/middleware.ts:42)" if a curated comment ever contains it. Use a stricter pattern anchored to the Skipped Comments section, or check vocabulary inside `out.split('## Skipped Comments')[1]`.

**M5. Task 17 "where to wire props" is hand-wavy.**
Lines 2233–2236 / 2282: "discovered in Step 1" via grep. Plan author didn't open the file. The parent that owns `useSpecStream` and renders `SpecDrawer` is concrete and findable now — name it. Same for Task 18 (line 2343).

**M6. Spec invariant "triaging phase is still surfaced briefly when commentCount === 0" is not testable as written.**
Spec line 249, plan lines 2253–2256 / 2334–2336. Plan emits the `triaging` phase event even when count is 0 (Task 12 second test, line 1541 asserts this) but immediately fires `generating`. The UI shows the row only while `phase === 'triaging'`; if both events arrive in the same event loop tick the renderer may never paint the triaging frame. There's no `await` or delay enforced. Either add an artificial floor (e.g. `await sleep(150)` in the handler when count is 0) or accept that the 0-comment branch flashes invisibly and update spec wording.

**M7. Task 14 changes `register.ts` but adds no test there.**
Line 1942: "covered by IPC integration tests above". It isn't. The bridge helper `fetchAndFilterCommentsByIdentifier` (lines 1980–1989) is new logic with a real branch (`if (!detail) return []`) and zero coverage. Add a test in `tests/main/register.test.ts` (or wherever wiring lives).

## MINOR

**m1.** `LinearClient` interface in `register.ts` (Task 14, lines 1964–1976) duplicates the full GraphQL row shape inline instead of importing from the comment-fetcher or linear-service. Drift waiting to happen.

**m2.** Plan line 190: "immediately after the `fetchTeamTriage` function definition (around line 597) and before the `return { ... }` block". Actual: fetchTeamTriage ends at line 597, return block starts at line 599. Fine, but the parenthetical "around line 597" is misleading — say "line 598".

**m3.** Plan line 1599 ("RepoContext shapes — read the imports first; if RepoContext has required fields, supply a minimal valid object. The casts to `never` keep the tests compiling") admits the plan author didn't read `repo-reader.ts`. Casting to `never` to silence type errors is a smell — read the file once and write the fixture.

**m4.** Tasks 3 + 4 conflate. Task 3 already writes the full implementation including `streamClaude` invocation (lines 539–550). Task 4 then claims "Add the failing tests" but the spawn/passthrough tests will already PASS because Task 3 implemented it. Plan even admits this at lines 663–666 ("the rethrow case may pass... will FAIL if the constants drift, otherwise PASS"). Merge Task 3 and Task 4, or strip Task 3 down to just the empty-input path.

**m5.** The triager's `streamClaude` parameter type (line 519–525) invents a new bespoke signature that is a subset of the real `StreamClaudeInput`. Self-review §"Type consistency" line 2429 acknowledges this. Just accept `StreamClaudeInput` directly and pass through — fewer adapter layers in `register.ts` (lines 2005–2013).

**m6.** `console.warn` on the triager-failure path (lines 1682, 1904) — project uses no logger abstraction yet, fine, but Task 19 step 4 grep allows-listed only `console.warn`. Be explicit: the grep should specifically *expect* two `console.warn` hits.

## NIT

**n1.** Plan line 14: "Tests live under `tests/main/` and `tests/renderer/` (not `__tests__/`)". Verified — but the spec at line 257 says "in the matching `__tests__/` folder". Plan correctly overrides; consider patching the spec or call it out as drift.

**n2.** Task 10 lines 1285–1292 uses `Exclude<GenerationPhase, 'idle' | 'done'>` for the wire payload. Cute, but readers will hunt for the constraint. Just inline `phase: 'triaging' | 'generating'`.

**n3.** Empty-comments user-prompt branch (line 540). `if (input.comments.length === 0) return '';` — fine, but the renderUserPrompt function still gets defined to handle this case, contains issue title/description it'll never use. YAGNI: keep, since the cost is zero, but Task 4 test "renders user prompt with title…" (lines 613–631) implicitly requires title/description to appear even when there ARE comments; just be aware the empty-input path skips the call entirely and that's tested.

**n4.** Plan line 2385 ("Spec-file relocation decision … Move the spec only if the user explicitly asks") — AGENTS.md says `thoughts/tasks/<slug>/initial-spec.md`. The spec lives at `docs/superpowers/specs/...`. Plan punts. Decide before merging.
