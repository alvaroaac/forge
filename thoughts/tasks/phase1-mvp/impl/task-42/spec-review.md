# Task 42 Spec Review (Re-review After QA Fix)

## Verdict
✅ Spec compliant

## Missing requirements
None.

## Extra scope
- The Task 42 plan only sketches tests for `useAuthStatus`, but `tests/renderer/use-auth-status.test.ts` also covers `useConfig`. This remains tightly scoped to the same mount-only/defaults contract and does not introduce new runtime behavior. (`tests/renderer/use-auth-status.test.ts:114-181`, plan: `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:4577-4656`)
- Rejection-path coverage was added for both hooks to address the prior QA finding about unhandled promise rejection risk. This is behavior-preserving: rejections keep the existing defaults. (`tests/renderer/use-auth-status.test.ts:72-111,149-180`; prior motivation: `thoughts/tasks/phase1-mvp/impl/task-42/qa-review.md:14-21`)

## Misunderstandings
None found.

## Addendum-rule check
Compliant with `2026-05-12-phase1-mvp.addendum.md` Tooling Scope: the Task 42 work (per `progress.md`) stays confined to the intended renderer hooks/tests plus the progress artifact, and does not touch `.agents/`, `resources/design/`, or `scripts/orchestrator-core/`. (`thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.addendum.md:5-8`, `thoughts/tasks/phase1-mvp/impl/task-42/progress.md:5-9`)

## Tech-debt-accounting check
- Progress explicitly records “Tech-debt logged: None.” (`thoughts/tasks/phase1-mvp/impl/task-42/progress.md:27-28`)
- Progress includes concrete test/tooling evidence and outcomes (vitest, eslint, typecheck), including rejection-path coverage. (`thoughts/tasks/phase1-mvp/impl/task-42/progress.md:11-15`)
- Progress includes commit hashes for the feature and QA fix work. (`thoughts/tasks/phase1-mvp/impl/task-42/progress.md:17-20`)

## Evidence
- `useAuthStatus` default remains all-false. (`src/renderer/hooks/use-auth-status.ts:5-9`, matches plan default at `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:4616-4626`)
- `useConfig` default remains `null`. (`src/renderer/hooks/use-config.ts:6`, matches plan default at `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:4635-4644`)
- `useAuthStatus` is mount-only (`useEffect(..., [])`) and calls `window.forge.auth.check()` only inside that effect. (`src/renderer/hooks/use-auth-status.ts:14-32`)
- `useConfig` is mount-only (`useEffect(..., [])`) and calls `window.forge.config.get()` only inside that effect. (`src/renderer/hooks/use-config.ts:8-26`)
- `useAuthStatus` updates state only if not cancelled (`if (!cancelled) setAuthStatus(...)`). (`src/renderer/hooks/use-auth-status.ts:15,21-23`)
- `useConfig` updates state only if not cancelled (`if (!cancelled) setConfig(...)`). (`src/renderer/hooks/use-config.ts:9,15-17`)
- `useAuthStatus` rejection handling is behavior-preserving: preload rejections are swallowed and defaults remain (no new public state or side effects). (`src/renderer/hooks/use-auth-status.ts:18-26`)
- `useConfig` rejection handling is behavior-preserving: preload rejections are swallowed and defaults remain (no new public state or side effects). (`src/renderer/hooks/use-config.ts:12-20`)
- Tests cover required `useAuthStatus` behavior: default all-false, updates after resolution, and `check` is called exactly once. (`tests/renderer/use-auth-status.test.ts:36-70`)
- Tests cover `useAuthStatus` rejection path: defaults remain, no `unhandledrejection` handler fires, and `check` is called exactly once. (`tests/renderer/use-auth-status.test.ts:72-111`)
- Additional `useConfig` tests are scoped similarly (default `null`, updates on resolve, single mount call, and rejection path keeps defaults without unhandled rejections). (`tests/renderer/use-auth-status.test.ts:114-181`)
