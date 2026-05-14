✅ Spec compliant

Verified against the current workspace, not the prior report.

- [src/shared/types.ts](/Users/alvarocarvalho/desenv/personal/forge/src/shared/types.ts:1) exports the requested and only requested Task 2 unions/interfaces: `IssueStatus`, `Priority`, `Issue`, `CommentThread`, `Spec`, `AppConfig`, `AuthStatus`, and `SpecStreamChunk`. The required field shapes match the plan exactly, including `Issue.id: string`, `Issue.status: IssueStatus`, `Issue.priority: Priority`, `AppConfig.linearTokenPath: string`, `AppConfig.linearTeamKey: string`, `AppConfig.repoPath: string`, `AppConfig.claudeModel: string`, and `AuthStatus` as `{ linear: boolean; claudeCode: boolean; codex: boolean }`.
- [src/shared/result.ts](/Users/alvarocarvalho/desenv/personal/forge/src/shared/result.ts:1) exports the requested `Result<T, E = Error>`, `ok`, and `err`. The repaired `ok<T, E = never>(value: T): Result<T, E>` signature is an acceptable improvement to the requested helper, not a spec violation.
- [tests/shared/types.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/shared/types.test.ts:1) imports `describe`, `it`, `expectTypeOf` and the requested types from `../../src/shared/types`, and it now includes meaningful assertions for `Spec` plus type assertions for `Result` helpers. Those additions are acceptable support coverage for Task 2 and do not conflict with the requested test shape.
- [tsconfig.test.json](/Users/alvarocarvalho/desenv/personal/forge/tsconfig.test.json:1) and the `typecheck` script update in [package.json](/Users/alvarocarvalho/desenv/personal/forge/package.json:10) are acceptable support changes. They tighten enforcement of the requested type tests rather than expanding product behavior or violating the addendum's tooling-scope rules.

Verified commands:

- `npx vitest run tests/shared/types.test.ts`: PASS (5 tests)
- `npm run test`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS, and now includes `tsconfig.test.json`
- `npm run format:check`: PASS

Commit history relevant to the repair is present:

- `46d5fe7` `feat(shared): Issue/Spec/AppConfig/AuthStatus types + Result`
- `135655b` `fix(shared): improve Result typing and enforce test typecheck`

TDD note: the originally expected pre-implementation red state is still not directly reproducible from the current workspace, but the repaired test/typecheck wiring now enforces the Task 2 type assertions in the standard verification path. That is sufficient for final spec compliance.

Tech-debt accounting: no intentionally skipped Task 2 scope that required a new entry in [thoughts/tech-debt.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tech-debt.md) is evident.
