---
name: linear
description: Use when creating, updating, linking, or commenting on Linear issues — including tasks like "create a Linear issue", "add a label", "move to backlog", "link as related/blocks/duplicate", "post a comment on CSI-12". Triggers on Linear CRUD operations from the agent.
user-invocable: false
---

# Linear

Reusable Linear API client for agent-driven CRUD on issues, labels, states, relations, and comments.

## Auth

Reads an OAuth access token from `~/.humanlayer/riptide/linear.json` (shape: `{ access_token, ... }`), or falls back to the `LINEAR_API_KEY` env var. If neither is present, the client exits with an error message telling the user to run `linear login` or set the env var. If a call returns `AUTHENTICATION_ERROR`, the token has expired — ask the user to re-run `linear login`.

## Import

```js
import { createLinearClient } from '<repo-root>/.agents/skills/linear/reference/linear.mjs';

const linear = createLinearClient({ teamKey: 'CSI', titlePrefix: '' });
```

`teamKey` is the short team key (e.g. `CSI`, `FUL`, `ENG`). `titlePrefix` is only used by `findIssues` to look up issues created by the orchestrator under a common title prefix; pass `''` for one-off use.

## Operations

### Reads

- **`getTeamId()`** → `string` — resolves the bound team's internal id.
- **`getStateId(teamId, stateName)`** → `string` — exact state-name lookup (throws if missing). Prefer `findState` for nullable lookup.
- **`findState(name)`** → `{ id, name, type } | null` — team-scoped, nullable.
- **`findLabel(name)`** → `{ id, name } | null` — team + workspace labels, nullable.
- **`listTeamLabels()`** → `Array<{ id, name, color, description, isGroup, parent }>` — every label scoped to the bound team (paginated). Excludes workspace labels.
- **`findIssues()`** → `Map<normalizedTitle, { id, identifier, url, title }>` — every issue in the team whose title contains `titlePrefix`.
- **`getCurrentUser()`** → `{ id, name, email }` — the authenticated viewer (per the OAuth token).
- **`fetchAssignedIssues(assigneeId)`** → `Array<{ id, identifier, title, description, state: { name, type }, priority, labels: { nodes: [{ name }] }, url, updatedAt }>` — open issues on the bound team assigned to `assigneeId`. Excludes `completed`/`canceled` states server-side.
- **`getIssue(identifier)`** → `{ id, identifier, title, url } | null` — fetch by identifier like `CSI-11`.
- **`getProjectAndMilestones(projectName)`** → `{ projectId, milestoneMap }` — project lookup plus milestone name-to-id map.

### Writes

- **`createIssue({ title, description?, parentId?, stateId?, projectId?, projectMilestoneId?, labelIds? })`** → `{ id, identifier, url, title }`.
- **`updateIssue(issueId, patch)`** — partial update. `patch` fields: `title`, `description`, `stateId`, `labelIds`, `assigneeId`. Only supplied fields are sent.
- **`updateIssueState(issueId, stateId)`** — convenience wrapper over `updateIssue`.
- **`createRelation(issueId, relatedIssueId, type)`** — `type` ∈ `'related' | 'blocks' | 'duplicate'`. Both ids are internal UUIDs, not identifiers — use `getIssue('CSI-11').id` first.
- **`createComment(issueId, body)`** — plain markdown body. No attachments.
- **`createLabel({ name, color?, description?, parentId?, isGroup? })`** — creates a label on the bound team. **Pass `isGroup: true` explicitly when creating a group label** — otherwise Linear silently creates a non-group label and child-label creation will fail with `"parent label is not a group"`.
- **`updateLabel(labelId, patch)`** — partial update. `patch` fields: `name`, `description`, `color`, `parentId`, `isGroup`, `retiredAt`. Use to promote an existing label to a group, re-parent, rename, or retire.

Label writes are not idempotent — Linear allows duplicate names. For repeat-safe runs, `listTeamLabels()` first, match by name, and `updateLabel` to repair rather than recreate.

All mutations throw on `success: false`.

## Typical Agent Recipe

```js
import { createLinearClient } from '<repo>/.agents/skills/linear/reference/linear.mjs';

const client = createLinearClient({ teamKey: 'CSI', titlePrefix: '' });

const [state, labelA, labelB, parent] = await Promise.all([
  client.findState('Backlog'),
  client.findLabel('vertical / fulfillment'),
  client.findLabel('internal'),
  client.getIssue('CSI-11'),
]);

const issue = await client.createIssue({
  title: 'Inline edit of Schedule Alias on Schedule row',
  description: '...',
  stateId: state.id,
  labelIds: [labelA.id, labelB.id],
});

await client.createRelation(issue.id, parent.id, 'related');
```

## Anti-Patterns

- **Do not** hand-roll `issueCreate` / `issueRelationCreate` / `commentCreate` mutations when the client already covers them — keeps the auth + error handling consistent.
- **Do not** read the OAuth token directly; let the client's auth helper handle it.
- **Do not** pass a human-readable identifier like `CSI-11` to `createRelation` — it expects the internal UUID from `getIssue(...).id`.
- **Do not** depend on `findIssues` when you only need one issue — use `getIssue(identifier)`.
- **Do not** omit `isGroup` when creating a group label — Linear won't infer it from having children. You'll end up with a plain label, and the next `createLabel` that targets it as a parent will fail with `"parent label is not a group"`.

## Extending the Client

When a Linear operation is missing, add it to `reference/linear.mjs` as a new function inside `createLinearClient`, export it in the `return { ... }` block, and document it here. Keep the API flat — one function per operation.
