✅ Spec compliant

What I verified:
- `src/main/services/linear-service.ts:9-10,57-59` adds `LinearTriageClientShape` with `fetchTeamTriage(): Promise<RawLinearIssue[]>` and exports `fetchTriage(client): Promise<Issue[]>`.
- `src/main/services/linear-service.ts:35-49` already maps `assignee?.id` through to `assigneeId`, so triage issues preserve the `me` assignee as requested.
- `tests/main/linear-service-fetchTriage.test.ts:1-29` covers the requested case: a raw triage issue with `assignee: { id: 'me' }`, a client with `fetchTeamTriage`, and assertions for length 1, `status === 'triage'`, and `assigneeId === 'me'`.
- Git history shows the requested commit message: `a2c817d feat(linear-service): expose fetchTriage that maps team-wide triage issues`.

Missing requirements:
- None found.

Extra/unneeded work:
- None observed beyond the requested service export, client shape, and focused test.

Misunderstandings:
- None detected.

Tech-debt accounting:
- No skipped work was logged, which is consistent with this narrowly scoped change.
