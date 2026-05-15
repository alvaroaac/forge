✅ Approved

The task is spec-compliant. `IssueStatus` now includes `'triage'` in `src/shared/types.ts`, and `tests/shared/types.test.ts` includes the required type assertion assigning `const status: IssueStatus = 'triage'`.

Verification was completed successfully:
- `npm run typecheck`
- `npm test -- tests/shared/types.test.ts`

The work is narrowly scoped, and the commit record includes the requested code change (`025535e`).
