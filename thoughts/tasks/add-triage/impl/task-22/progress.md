# Task 22

## Task
Wire triage IPC registrations in `src/main/ipc/register.ts`.

## Files Changed
- `src/main/ipc/register.ts`
- `thoughts/tasks/add-triage/impl/task-22/progress.md`

## Implementation
- Updated `src/main/ipc/register.ts` to import and use triage wiring dependencies:
  - `fetchTriage` from `src/main/services/linear-service`
  - `streamClaude` from `src/main/services/spec-generator`
  - `streamTriageBrief` from `src/main/services/triage-generator`
  - `writeTriageBrief` from `src/main/services/triage-writer`
  - `registerTriageGenerateHandler`, `registerTriageWriteHandler` from `src/main/ipc/triage`
- Kept `LinearClient` typed with `fetchTeamTriage(): Promise<RawLinearIssue[]>` and kept triage dependencies in `registerLinearHandlers` usage (including `getViewerId`).
- Registered triage generation and write handlers:
  - `registerTriageGenerateHandler` with `{ store, fetchTriageList: () => fetchTriage(client as LinearClient), streamTriageBrief: ({ issue, computronRepoPath, model, onChunk }) => streamTriageBrief({ issue, computronRepoPath, model, onChunk, streamClaude }) }`
  - `registerTriageWriteHandler` with `{ store, writeTriageBrief }`

## Tests Run
- `npm run typecheck`
- `npm test`

## Results
- `npm run typecheck`: passed
- `npm test`: passed (53 test files, 258 tests)

## Commit
- This task commit (latest)
