# Comment-context pipeline — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject curated Linear-comment context into both the spec generator and the triage-brief generator via a cheap Haiku 4.5 triager call, surfaced in the renderer as a two-phase progress indicator.

**Architecture:** Two-stage pipeline per request — (1) fetch comments from Linear and pre-filter bot/automation rows, then call Claude Haiku 4.5 to produce a curated markdown block; (2) feed that block above the issue body into the existing researcher prompt. A new `phase` event flows on the existing `spec:*` / `triage:*` IPC channels, the renderer hooks track phase state, and the UI shows a status row while triaging then generating. Triager failure must never block the main generation.

**Tech Stack:** Electron (main + renderer), React 18 + TypeScript, Vitest, Linear GraphQL via `.agents/skills/linear/reference/linear.mjs`, Claude CLI spawned through the existing `streamClaude` runner in `src/main/services/spec-generator.ts`.

**Source spec:** `docs/superpowers/specs/2026-05-19-comment-context-for-triage-and-spec-design.md` — read this before starting. This plan implements every section.

**v1 → v2 review trail:** `thoughts/tasks/comment-context-pipeline/review-2026-05-20-plan-roast.md` + `review-2026-05-20-plan-review-pass.md`. This v2 addresses every blocker/major/minor surfaced there.

**Conventions:**
- Tests live under `tests/main/` and `tests/renderer/` (not `__tests__/`). The spec mentions `__tests__/` in §8 — that is drift; this plan overrides.
- Run `npm test -- <file>` to scope a single Vitest file.
- Run `npm run typecheck` for full type validation.
- Commit after each task. Frequent small commits.

**Spec-location decision:** spec lives at `docs/superpowers/specs/...` (skill default) rather than `thoughts/tasks/<slug>/initial-spec.md` (project convention per `AGENTS.md`). Decision: leave it. Both locations exist in the repo today; the cost of relocation outweighs the consistency win until a second comment-context iteration begins.

---

## File map

**Modify:**
- `.agents/skills/linear/reference/linear.mjs` — add `fetchIssueComments`, export it.
- `.agents/skills/linear/SKILL.md` — document the new read op.
- `src/shared/types.ts` — add `uuid: string` to `Issue`; add `GenerationPhase`, `SpecPhaseEvent`, `TriagePhaseEvent`.
- `src/main/services/linear-service.ts` — preserve UUID in `mapIssue`.
- `src/main/services/spec-generator.ts` — add `curatedComments?: string` to `StreamSpecInput`; prepend logic.
- `src/main/services/triage-generator.ts` — add `curatedComments?: string` to `StreamTriageBriefInput`; forward.
- `src/main/ipc/spec.ts` — orchestrate fetch → triage → generate, emit `spec:phase` events.
- `src/main/ipc/triage.ts` — same shape, emit `triage:phase`.
- `src/main/ipc/register.ts` — wire `fetchIssueComments`, `triageComments` into both handlers; extend `LinearClient`.
- `src/main/preload.ts` — add `spec.onPhase` and `triage.onPhase` subscribers.
- `src/shared/ipc-channels.ts` — add `SpecPhase`, `TriagePhase` constants.
- `src/shared/forge-api.ts` — extend `spec` and `triage` API surfaces with `onPhase`.
- `src/renderer/hooks/use-spec-stream.ts` — track `phase` and `commentCount` state.
- `src/renderer/hooks/use-triage-stream.ts` — same.
- `src/renderer/components/spec-tab.tsx` — render the phase status row.
- `src/renderer/components/spec-drawer.tsx` — forward phase props.
- `src/renderer/components/triage-drawer.tsx` — render the phase status row.
- `src/renderer/app.tsx` — destructure `phase` / `commentCount` from each hook and forward to drawers.

**Create:**
- `src/main/services/comment-fetcher.ts` — normalise raw GraphQL comments + apply bot pre-filter.
- `src/main/services/comment-triager.ts` — call Haiku 4.5 via injected `streamClaude`, return curated markdown.
- `tests/main/linear-skill-fetchIssueComments.test.ts`
- `tests/main/comment-fetcher.test.ts`
- `tests/main/comment-triager.test.ts`

**Extend (existing tests):**
- `tests/main/linear-service.test.ts` — assert `uuid` field is preserved.
- `tests/main/spec-generator.test.ts` — `curatedComments` prepend behaviour.
- `tests/main/triage-generator.test.ts` — `curatedComments` passthrough.
- `tests/main/ipc-spec-generate.test.ts` — **already exists (451 lines)**. Append the phase-pipeline `describe` block; do not overwrite existing coverage.
- `tests/main/ipc-triage.test.ts` — phase events, triager-failure isolation.
- `tests/main/preload.test.ts` — `onPhase` subscribers.
- `tests/renderer/use-spec-stream.test.ts` — phase state transitions.
- `tests/renderer/use-triage-stream.test.ts` — same.

---

## Task 1: Linear client — `fetchIssueComments`

**Files:**
- Modify: `.agents/skills/linear/reference/linear.mjs` (add function, add to `return { ... }`)
- Modify: `.agents/skills/linear/SKILL.md` (document in Reads section)
- Test: `tests/main/linear-skill-fetchIssueComments.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/main/linear-skill-fetchIssueComments.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface LinearSkillModule {
  createLinearClient(opts: { teamKey: string; titlePrefix: string }): {
    fetchIssueComments: (issueId: string) => Promise<
      Array<{
        id: string;
        body: string;
        createdAt: string;
        user: { id: string; name: string } | null;
        botActor: { id: string } | null;
      }>
    >;
  };
}

async function getLinearSkillModule(): Promise<LinearSkillModule> {
  const modulePath = '../../.agents/skills/linear/reference/linear.mjs';
  const mod = await import(modulePath as string);
  return mod as unknown as LinearSkillModule;
}

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  process.env.LINEAR_API_KEY = 'test-key';
});

describe('linear client — fetchIssueComments', () => {
  it('returns the full normalised comment list for an issue id', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          issue: {
            comments: {
              nodes: [
                {
                  id: 'c-1',
                  body: 'hi',
                  createdAt: '2026-05-01T00:00:00.000Z',
                  user: { id: 'u-1', name: 'Alice' },
                  botActor: null,
                },
                {
                  id: 'c-2',
                  body: 'bot comment',
                  createdAt: '2026-05-02T00:00:00.000Z',
                  user: null,
                  botActor: { id: 'bot-1' },
                },
              ],
            },
          },
        },
      }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    const comments = await client.fetchIssueComments('uuid-issue-1');

    expect(comments).toEqual([
      {
        id: 'c-1',
        body: 'hi',
        createdAt: '2026-05-01T00:00:00.000Z',
        user: { id: 'u-1', name: 'Alice' },
        botActor: null,
      },
      {
        id: 'c-2',
        body: 'bot comment',
        createdAt: '2026-05-02T00:00:00.000Z',
        user: null,
        botActor: { id: 'bot-1' },
      },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables).toEqual({ issueId: 'uuid-issue-1' });
    expect(body.query).toMatch(/issue\(id: \$issueId\)/);
    expect(body.query).toMatch(/comments\(first: 250\)/);
    expect(body.query).toMatch(/botActor \{\s*id\s*\}/);
    const botActorBlock = body.query.match(/botActor \{[^}]*\}/)?.[0] ?? '';
    expect(botActorBlock).not.toMatch(/name/);
    expect(botActorBlock).not.toMatch(/type/);
  });

  it('returns [] when Linear has no issue', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { issue: null } }),
    });
    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    await expect(client.fetchIssueComments('missing')).resolves.toEqual([]);
  });

  it('returns [] when comments.nodes is absent', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { issue: { comments: null } } }),
    });
    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    await expect(client.fetchIssueComments('x')).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/main/linear-skill-fetchIssueComments.test.ts`
Expected: FAIL — `client.fetchIssueComments is not a function`.

- [ ] **Step 3: Implement `fetchIssueComments`**

In `.agents/skills/linear/reference/linear.mjs`, immediately after `fetchTeamTriage` and before the `return { ... }` block (currently around line 598), add:

```js
/**
 * Fetch all comments on an issue.
 *
 * @param {string} issueId  Linear issue id (UUID, not identifier)
 */
async function fetchIssueComments(issueId) {
  const data = await linearRequest(`
    query($issueId: String!) {
      issue(id: $issueId) {
        comments(first: 250) {
          nodes {
            id
            body
            createdAt
            user { id name }
            botActor { id }
          }
        }
      }
    }
  `, { issueId });
  return data.issue?.comments?.nodes ?? [];
}
```

Add `fetchIssueComments` to the `return { ... }` block at the end of `createLinearClient`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/main/linear-skill-fetchIssueComments.test.ts`
Expected: PASS — all three cases.

- [ ] **Step 5: Document the new op in SKILL.md**

In `.agents/skills/linear/SKILL.md`, in the **Reads** list (after the `fetchIssueDetail` bullet), add:

```markdown
- **`fetchIssueComments(issueId)`** → `Array<{ id, body, createdAt, user: { id, name } | null, botActor: { id } | null }>` — every comment on the issue. `issueId` is the Linear UUID (the `uuid` field on the cached `Issue`, populated by `mapIssue` from `raw.id`). `botActor` is non-null only for bot/integration/automation comments; we select only `{ id }` since downstream callers just need an existence check.
```

- [ ] **Step 6: Commit**

```bash
git add .agents/skills/linear/reference/linear.mjs .agents/skills/linear/SKILL.md tests/main/linear-skill-fetchIssueComments.test.ts
git commit -m "feat(linear): add fetchIssueComments read op"
```

---

## Task 2: Preserve Linear UUID on cached `Issue`

The cached `Issue` currently sets `id: raw.identifier` (e.g. `FUL-77`) and throws away `raw.id` (the UUID). `fetchIssueComments` needs the UUID. Rather than re-fetching `fetchIssueDetail` on every spec/triage generation (round-trip waste), add a `uuid` field to `Issue` and populate it in `mapIssue`.

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/services/linear-service.ts`
- Modify: `tests/main/linear-service.test.ts` (and any test that constructs an `Issue` literal — typecheck will flag them)

- [ ] **Step 1: Write the failing test**

Append to `tests/main/linear-service.test.ts`:

```ts
describe('mapIssue — UUID preservation', () => {
  it('preserves raw.id as Issue.uuid while keeping Issue.id = identifier', () => {
    const raw: RawLinearIssue = {
      id: '11111111-2222-3333-4444-555555555555',
      identifier: 'FUL-77',
      title: 'X',
      description: null,
      state: { name: 'Todo', type: 'unstarted' },
      priority: 3,
      labels: { nodes: [] },
      url: 'https://linear.app/x/issue/FUL-77',
      updatedAt: '2026-05-01T00:00:00.000Z',
      assignee: null,
    };
    const mapped = mapIssue(raw);
    expect(mapped.id).toBe('FUL-77');
    expect(mapped.uuid).toBe('11111111-2222-3333-4444-555555555555');
  });
});
```

(Import `mapIssue` and `RawLinearIssue` at the top of the file if not already imported.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/main/linear-service.test.ts`
Expected: FAIL — `Issue.uuid` doesn't exist.

- [ ] **Step 3: Add `uuid` to the `Issue` type**

In `src/shared/types.ts`, add `uuid` to the `Issue` interface:

```ts
export interface Issue {
  id: string;
  uuid: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  labels: string[];
  url: string;
  updatedAt: string;
  isBug: boolean;
  assigneeId: string | null;
}
```

- [ ] **Step 4: Populate `uuid` in `mapIssue`**

In `src/main/services/linear-service.ts`:

```ts
export function mapIssue(raw: RawLinearIssue): Issue {
  const labels = raw.labels.nodes.map((n) => n.name);
  return {
    id: raw.identifier,
    uuid: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    status: mapStatus(raw.state),
    priority: mapPriority(raw.priority),
    labels,
    url: raw.url,
    updatedAt: raw.updatedAt,
    isBug: isBug({ labels, issueType: null }),
    assigneeId: raw.assignee?.id ?? null,
  };
}
```

- [ ] **Step 5: Run typecheck — fix all callers**

Run: `npm run typecheck`

Expected: typecheck flags every test file that constructs an `Issue` literal without `uuid`. Add `uuid: '<some-uuid>'` (any non-empty placeholder string) to each fixture. Common offenders: `tests/main/ipc-spec-generate.test.ts`, `tests/main/ipc-triage.test.ts`, `tests/main/spec-generator.test.ts`, `tests/main/triage-generator.test.ts`, plus any renderer test that types an `Issue` literal. Use `uuid: 'uuid-test-fixture'` consistently.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS across the suite.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/main/services/linear-service.ts tests/
git commit -m "feat(issue): preserve Linear UUID alongside identifier"
```

---

## Task 3: `comment-fetcher` service

**Files:**
- Create: `src/main/services/comment-fetcher.ts`
- Test: `tests/main/comment-fetcher.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/main/comment-fetcher.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { fetchAndFilterComments, type LinearComment } from '../../src/main/services/comment-fetcher';

function makeClient(rows: Array<{
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  botActor: { id: string } | null;
}>) {
  return { fetchIssueComments: vi.fn().mockResolvedValue(rows) };
}

describe('fetchAndFilterComments', () => {
  it('drops bot rows (botActor !== null) and normalises survivors', async () => {
    const client = makeClient([
      {
        id: 'c-1',
        body: 'human says hi',
        createdAt: '2026-05-01T00:00:00.000Z',
        user: { id: 'u-1', name: 'Alice' },
        botActor: null,
      },
      {
        id: 'c-2',
        body: 'integration noise',
        createdAt: '2026-05-02T00:00:00.000Z',
        user: null,
        botActor: { id: 'bot-1' },
      },
    ]);
    const result = await fetchAndFilterComments(client, 'uuid-1');

    expect(result).toEqual<LinearComment[]>([
      {
        id: 'c-1',
        body: 'human says hi',
        createdAt: '2026-05-01T00:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ]);
    expect(client.fetchIssueComments).toHaveBeenCalledWith('uuid-1');
  });

  it('returns [] when client returns []', async () => {
    const client = makeClient([]);
    await expect(fetchAndFilterComments(client, 'x')).resolves.toEqual([]);
  });

  it("falls back authorName to 'Unknown' when user is null and the row survives the bot filter", async () => {
    const client = makeClient([
      {
        id: 'c-3',
        body: 'orphan',
        createdAt: '2026-05-03T00:00:00.000Z',
        user: null,
        botActor: null,
      },
    ]);
    const result = await fetchAndFilterComments(client, 'x');
    expect(result).toEqual<LinearComment[]>([
      {
        id: 'c-3',
        body: 'orphan',
        createdAt: '2026-05-03T00:00:00.000Z',
        authorName: 'Unknown',
        isBot: false,
      },
    ]);
  });

  it('preserves body verbatim and order', async () => {
    const client = makeClient([
      { id: 'a', body: 'first', createdAt: '2026-05-01T00:00:00.000Z', user: { id: 'u', name: 'A' }, botActor: null },
      { id: 'b', body: 'second', createdAt: '2026-05-02T00:00:00.000Z', user: { id: 'u', name: 'B' }, botActor: null },
    ]);
    const result = await fetchAndFilterComments(client, 'x');
    expect(result.map((r) => r.body)).toEqual(['first', 'second']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/main/comment-fetcher.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `comment-fetcher`**

Create `src/main/services/comment-fetcher.ts`:

```ts
export interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  isBot: boolean;
}

export interface RawLinearComment {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  botActor: { id: string } | null;
}

export interface CommentsClient {
  fetchIssueComments(issueId: string): Promise<RawLinearComment[]>;
}

function normalise(raw: RawLinearComment): LinearComment {
  return {
    id: raw.id,
    body: raw.body,
    createdAt: raw.createdAt,
    authorName: raw.user?.name ?? 'Unknown',
    isBot: raw.botActor !== null,
  };
}

export async function fetchAndFilterComments(
  client: CommentsClient,
  issueId: string,
): Promise<LinearComment[]> {
  const raw = await client.fetchIssueComments(issueId);
  return raw.map(normalise).filter((c) => !c.isBot);
}
```

`RawLinearComment` is exported so `register.ts` can re-use the shape rather than duplicating it in its `LinearClient` interface.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/main/comment-fetcher.test.ts`
Expected: PASS — all four cases.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/comment-fetcher.ts tests/main/comment-fetcher.test.ts
git commit -m "feat(comment-fetcher): normalise + bot-filter Linear comments"
```

---

## Task 4: `comment-triager` — module + Claude invocation contract

(Merged from v1's Tasks 3+4: v1 split them but Task 3 already implemented the spawn path, making Task 4's "failing tests" tautological.)

**Files:**
- Create: `src/main/services/comment-triager.ts`
- Test: `tests/main/comment-triager.test.ts` (new)

- [ ] **Step 1: Write the failing test file**

Create `tests/main/comment-triager.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  triageComments,
  type TriageCommentsInput,
  COMMENT_TRIAGER_MODEL,
  COMMENT_TRIAGER_SYSTEM_PROMPT,
} from '../../src/main/services/comment-triager';

describe('triageComments — empty input', () => {
  it('returns empty string without calling streamClaude when comments is []', async () => {
    const streamClaude = vi.fn();
    const out = await triageComments({
      issueTitle: 't',
      issueDescription: 'd',
      comments: [],
      streamClaude,
    });
    expect(out).toBe('');
    expect(streamClaude).not.toHaveBeenCalled();
  });
});

describe('triageComments — Claude invocation', () => {
  const oneComment = [
    { id: 'c-1', body: 'hello', createdAt: '2026-05-01T00:00:00.000Z', authorName: 'Alice', isBot: false },
  ];

  it('passes the pinned Haiku 4.5 model id', async () => {
    const streamClaude = vi.fn().mockResolvedValue('');
    await triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude });
    expect(streamClaude.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
    expect(COMMENT_TRIAGER_MODEL).toBe('claude-haiku-4-5-20251001');
  });

  it('passes the constant system prompt unchanged', async () => {
    const streamClaude = vi.fn().mockResolvedValue('');
    await triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude });
    expect(streamClaude.mock.calls[0][0].system).toBe(COMMENT_TRIAGER_SYSTEM_PROMPT);
  });

  it('renders the user prompt with title, description, and numbered comments', async () => {
    const streamClaude = vi.fn().mockResolvedValue('');
    await triageComments({
      issueTitle: 'Order endpoint returns 500',
      issueDescription: 'Steps to repro: ...',
      comments: [
        { id: 'c-1', body: 'first body', createdAt: '2026-05-01T00:00:00.000Z', authorName: 'Alice', isBot: false },
        { id: 'c-2', body: 'second body', createdAt: '2026-05-02T00:00:00.000Z', authorName: 'Bob', isBot: false },
      ],
      streamClaude,
    });
    const userPrompt = streamClaude.mock.calls[0][0].user as string;
    expect(userPrompt).toContain('**Title:** Order endpoint returns 500');
    expect(userPrompt).toContain('Steps to repro: ...');
    expect(userPrompt).toContain('### 1. Alice — 2026-05-01T00:00:00.000Z');
    expect(userPrompt).toContain('first body');
    expect(userPrompt).toContain('### 2. Bob — 2026-05-02T00:00:00.000Z');
    expect(userPrompt).toContain('second body');
  });

  it('rethrows when streamClaude throws (caller is responsible for catching)', async () => {
    const streamClaude = vi.fn().mockRejectedValue(new Error('claude exited 1'));
    await expect(
      triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude }),
    ).rejects.toThrow('claude exited 1');
  });

  it('returns whatever streamClaude returns', async () => {
    const canned = '## Relevant Comments\n\n### Alice — 2026-05-01\nhello\n\n---\n\n## Skipped Comments\n- (none)';
    const streamClaude = vi.fn().mockResolvedValue(canned);
    const out = await triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude });
    expect(out).toBe(canned);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/main/comment-triager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `comment-triager`**

Create `src/main/services/comment-triager.ts`:

```ts
import type { LinearComment } from './comment-fetcher';
import type { StreamClaudeInput } from './spec-generator';

export const COMMENT_TRIAGER_MODEL = 'claude-haiku-4-5-20251001';

export const COMMENT_TRIAGER_SYSTEM_PROMPT = `You are filtering and restructuring Linear ticket comments for an engineer
who is about to triage or spec the ticket. Your only job is to produce a
curated comment context block that surfaces what matters and shortens what
does not.

You receive: the issue title, issue description, and a list of comments
(each with author, timestamp, and markdown body). Bot/automation comments
have already been stripped before you see them.

Output exactly two sections, in this order, using this markdown format:

## Relevant Comments

### {Author} — {YYYY-MM-DD}
> {Optional one-line context annotation. Omit the blockquote line entirely
> if no annotation adds value.}
{Verbatim comment body, unchanged.}

---

(Repeat per relevant comment. Separate with a \`---\` line.)

## Skipped Comments
- {Author} ({reason}): {one-line summary of what was skipped}.

Rules:

1. A comment is RELEVANT if it adds technical detail, reproduction info,
   constraints, decisions, links to related work, or reporter clarifications
   that change how the engineer would approach the ticket.
2. A comment is SKIPPED if it is administrative chatter, "+1" reactions,
   scheduling, off-topic, or noise.
3. If a thread (multiple comments) concludes with an explicit "won't do
   this" / "rejected" / "we decided against this", skip the whole thread
   with one combined summary line in Skipped Comments.
4. If a comment contains a pasted Slack thread or similar long
   conversation (rule of thumb: 50+ messages or 2000+ words), do NOT paste
   it verbatim. Instead:
   - Summarize the on-topic portion.
   - Strip per-message timestamps.
   - Collapse consecutive messages from the same author into a single
     block under one author header.
   - Preserve substantive technical content verbatim within that block.
   The result replaces the verbatim body for that comment.
5. Use \`reason\` values from this set only: \`bot\` (shouldn't happen,
   pre-filtered), \`won't-do\`, \`noise\`, \`filler\`, \`off-topic\`.
6. If no comments are relevant, output \`## Relevant Comments\\n_(none)_\`
   followed by the Skipped Comments section.
7. Return only the two sections. No preamble, no postscript, no code
   fences wrapping the whole output.`;

export interface TriageCommentsInput {
  issueTitle: string;
  issueDescription: string;
  comments: LinearComment[];
  streamClaude: (input: StreamClaudeInput) => Promise<string>;
}

function renderUserPrompt(input: TriageCommentsInput): string {
  const header = `# Issue\n\n**Title:** ${input.issueTitle}\n\n**Description:**\n\n${input.issueDescription}\n\n# Comments\n`;
  const body = input.comments
    .map((c, idx) => `\n### ${idx + 1}. ${c.authorName} — ${c.createdAt}\n\n${c.body}\n`)
    .join('');
  return `${header}${body}`;
}

export async function triageComments(input: TriageCommentsInput): Promise<string> {
  if (input.comments.length === 0) {
    return '';
  }
  return input.streamClaude({
    model: COMMENT_TRIAGER_MODEL,
    system: COMMENT_TRIAGER_SYSTEM_PROMPT,
    user: renderUserPrompt(input),
    onChunk: () => undefined,
  });
}
```

Note the `streamClaude` parameter is typed as `StreamClaudeInput` (the existing type exported from `spec-generator.ts`). No bespoke subset signature — the wiring in Task 13 passes `streamClaude` through unchanged.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test -- tests/main/comment-triager.test.ts`
Expected: PASS — six cases.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/comment-triager.ts tests/main/comment-triager.test.ts
git commit -m "feat(comment-triager): Haiku 4.5 invocation with pinned system prompt"
```

---

## Task 5: `comment-triager` — per-rule prompt coverage

Per-rule tests against the system prompt constant. These guard against silent prompt edits that drop a rule. Use `toContain` (not regex) for any check that must match a literal — regex breakage on whitespace/escape changes was a v1 fragility.

**Files:**
- Modify: `tests/main/comment-triager.test.ts`

- [ ] **Step 1: Append the rule-coverage block**

```ts
describe('COMMENT_TRIAGER_SYSTEM_PROMPT — per-rule coverage', () => {
  it('Rule 1: defines what makes a comment RELEVANT', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('RELEVANT');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('technical detail');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('reproduction info');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('decisions');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('clarifications');
  });

  it('Rule 2: defines what makes a comment SKIPPED', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('SKIPPED');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('+1');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('scheduling');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('off-topic');
  });

  it("Rule 3: skips a whole thread that concludes with won't-do / rejected / decided against", () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain("won't do this");
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('rejected');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('decided against this');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('skip the whole thread');
  });

  it('Rule 4: handles long Slack threads with the four sub-behaviours', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('50+ messages');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('2000+ words');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Summarize the on-topic portion');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Strip per-message timestamps');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Collapse consecutive messages from the same author');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Preserve substantive technical content verbatim');
  });

  it('Rule 5: enumerates exactly the allowed reason vocabulary', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('`bot`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain("`won't-do`");
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('`noise`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('`filler`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('`off-topic`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).not.toContain('`spam`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).not.toContain('`duplicate`');
  });

  it('Rule 6: defines the empty-relevant output shape', () => {
    // The constant contains the escaped four-char sequence "\n" (backslash-n)
    // because it's the literal text instructing the LLM what to emit.
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('## Relevant Comments\\n_(none)_');
  });

  it('Rule 7: forbids preamble / postscript / wrapping code fences', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Return only the two sections');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('No preamble');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('no postscript');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('no code');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('fences wrapping the whole output');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/main/comment-triager.test.ts`
Expected: PASS — seven new rule-coverage cases.

If any FAIL: the constant in `comment-triager.ts` has drifted from the spec text. Re-align the constant; do NOT relax the test.

- [ ] **Step 3: Commit**

```bash
git add tests/main/comment-triager.test.ts
git commit -m "test(comment-triager): per-rule prompt coverage"
```

---

## Task 6: `comment-triager` — output contract-shape smoke tests

(Collapsed from v1's Tasks 6+7. Those 11 tests asserted that the mocked `streamClaude` return value contained text the test itself put there — circular. They proved nothing about LLM behaviour. Per spec §3 "the assertion targets the rendered output, not the LLM", LLM behaviour is validated manually; these tests instead pin the **contract shape** that downstream parsers will rely on.)

**Files:**
- Modify: `tests/main/comment-triager.test.ts`

- [ ] **Step 1: Append the contract-shape tests**

```ts
describe('triageComments — output contract shape (mocked LLM, parameterised)', () => {
  const oneComment = [
    { id: 'c-1', body: 'x', createdAt: '2026-05-01T00:00:00.000Z', authorName: 'Alice', isBot: false },
  ];

  it('returns whatever the LLM returned, untouched', async () => {
    const arbitraryShapes = [
      '## Relevant Comments\n_(none)_\n\n## Skipped Comments\n- Alice (noise): "+1".\n',
      '## Relevant Comments\n\n### Alice — 2026-05-01\nbody\n\n---\n\n## Skipped Comments\n- (none)\n',
      '## Relevant Comments\n_(none)_\n\n## Skipped Comments\n- Team (won\'t-do): rejected in thread.\n',
    ];
    for (const canned of arbitraryShapes) {
      const streamClaude = vi.fn().mockResolvedValue(canned);
      const out = await triageComments({
        issueTitle: 't',
        issueDescription: 'd',
        comments: oneComment,
        streamClaude,
      });
      expect(out).toBe(canned);
    }
  });

  it('reason-vocabulary leak detector: only allowed tags appear in the Skipped block', async () => {
    // The detector is the kind of thing that would run on a real LLM response.
    // Here we use a synthetic but realistic curated output.
    const canned =
      '## Relevant Comments\n_(none)_\n\n## Skipped Comments\n' +
      '- Alice (noise): "+1".\n' +
      "- Bob (filler): \"ack\".\n" +
      '- Carol (off-topic): unrelated to bug.\n' +
      "- Dan (won't-do): proposal rejected in thread.\n";
    const skippedBlock = canned.split('## Skipped Comments')[1] ?? '';
    const reasonMatches = skippedBlock.match(/\(([a-z'-]+)\):/gi) ?? [];
    expect(reasonMatches.length).toBeGreaterThan(0);
    const allowed = new Set(['(bot):', "(won't-do):", '(noise):', '(filler):', '(off-topic):']);
    for (const r of reasonMatches) {
      expect(allowed.has(r.toLowerCase())).toBe(true);
    }
  });
});
```

The reason-vocab detector is now scoped to the Skipped block (M4 fix) — it will not false-positive on `(see auth/middleware.ts:42)` appearing inside a Relevant comment body.

These are smoke-tests of contract shape, not behaviour. v1 had eleven similar tests that pretended to validate triager behaviour but only validated the mock fixture. LLM behaviour is validated manually per spec §3.

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/main/comment-triager.test.ts`
Expected: PASS — two new contract-shape cases.

- [ ] **Step 3: Commit**

```bash
git add tests/main/comment-triager.test.ts
git commit -m "test(comment-triager): output contract-shape smoke tests"
```

---

## Task 7: Wire `curatedComments` into `spec-generator`

Add an optional `curatedComments` param to `StreamSpecInput`. When non-empty, prepend a `## Comment context\n\n{curated}\n\n---\n\n` block to the user prompt above the issue body. When empty or absent, the user prompt is unchanged.

**Files:**
- Modify: `src/main/services/spec-generator.ts`
- Modify: `tests/main/spec-generator.test.ts`

- [ ] **Step 1: Add the failing tests**

Append a new describe block to `tests/main/spec-generator.test.ts`. The helpers `createFakeChild`, `createFakeSpawn`, and `jsonLine` are already in scope at the file top.

```ts
describe('streamSpec — curatedComments prepend', () => {
  it('prepends a "## Comment context" block above the user body when curatedComments is non-empty', async () => {
    let stdinText = '';
    const { spawnProcess } = createFakeSpawn((child) => {
      stdinText = child.stdin.read()?.toString() ?? '';
      child.stdout.write(jsonLine({ type: 'result', is_error: false, result: 'ok' }));
      child.emit('close', 0);
    });

    await streamSpec({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'ISSUE BODY HERE',
      curatedComments: '## Relevant Comments\n\n### Alice — 2026-05-01\nhi',
      onChunk: () => undefined,
      spawnProcess,
    });

    expect(stdinText.startsWith('## Comment context\n\n')).toBe(true);
    expect(stdinText).toContain('## Relevant Comments');
    expect(stdinText.endsWith('\n\n---\n\nISSUE BODY HERE')).toBe(true);
  });

  it('passes the user body unchanged when curatedComments is undefined', async () => {
    let stdinText = '';
    const { spawnProcess } = createFakeSpawn((child) => {
      stdinText = child.stdin.read()?.toString() ?? '';
      child.stdout.write(jsonLine({ type: 'result', is_error: false, result: 'ok' }));
      child.emit('close', 0);
    });
    await streamSpec({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'ISSUE BODY HERE',
      onChunk: () => undefined,
      spawnProcess,
    });
    expect(stdinText).toBe('ISSUE BODY HERE');
  });

  it('passes the user body unchanged when curatedComments is the empty string', async () => {
    let stdinText = '';
    const { spawnProcess } = createFakeSpawn((child) => {
      stdinText = child.stdin.read()?.toString() ?? '';
      child.stdout.write(jsonLine({ type: 'result', is_error: false, result: 'ok' }));
      child.emit('close', 0);
    });
    await streamSpec({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'ISSUE BODY HERE',
      curatedComments: '',
      onChunk: () => undefined,
      spawnProcess,
    });
    expect(stdinText).toBe('ISSUE BODY HERE');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/main/spec-generator.test.ts`
Expected: FAIL — `StreamSpecInput` has no `curatedComments` field.

- [ ] **Step 3: Implement the prepend**

In `src/main/services/spec-generator.ts`:

1. Add `curatedComments?: string;` to `StreamSpecInput`.

2. Just above `streamClaude`, add:

```ts
function buildUserPayload(user: string, curatedComments?: string): string {
  if (!curatedComments) {
    return user;
  }
  return `## Comment context\n\n${curatedComments}\n\n---\n\n${user}`;
}
```

3. In `streamClaude`, replace `claude.stdin.end(input.user);` with:

```ts
claude.stdin.end(buildUserPayload(input.user, input.curatedComments));
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test -- tests/main/spec-generator.test.ts`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/spec-generator.ts tests/main/spec-generator.test.ts
git commit -m "feat(spec-generator): inject curatedComments above issue body"
```

---

## Task 8: Wire `curatedComments` into `triage-generator`

**Files:**
- Modify: `src/main/services/triage-generator.ts`
- Modify: `tests/main/triage-generator.test.ts`

- [ ] **Step 1: Add the failing tests**

Read `tests/main/triage-generator.test.ts` to find its existing Issue fixture and fake-`streamClaude` shape. Append:

```ts
describe('streamTriageBrief — curatedComments passthrough', () => {
  it('forwards curatedComments to streamClaude when provided', async () => {
    const calls: Array<{ user: string; curatedComments?: string }> = [];
    await streamTriageBrief({
      issue: triageIssueFixture, // reuse the existing fixture
      computronRepoPath: '/tmp/cmp',
      model: 'claude-sonnet-4-6',
      curatedComments: '## Relevant Comments\n_(none)_',
      onChunk: () => undefined,
      streamClaude: async (input) => {
        calls.push({ user: input.user, curatedComments: input.curatedComments });
        return 'ok';
      },
    });
    expect(calls[0].curatedComments).toBe('## Relevant Comments\n_(none)_');
  });

  it('omits curatedComments when not provided', async () => {
    const calls: Array<{ curatedComments?: string }> = [];
    await streamTriageBrief({
      issue: triageIssueFixture,
      computronRepoPath: '/tmp/cmp',
      model: 'claude-sonnet-4-6',
      onChunk: () => undefined,
      streamClaude: async (input) => {
        calls.push({ curatedComments: input.curatedComments });
        return 'ok';
      },
    });
    expect(calls[0].curatedComments).toBeUndefined();
  });
});
```

Replace `triageIssueFixture` with whatever the file already names its Issue fixture (it has one).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/main/triage-generator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the passthrough**

In `src/main/services/triage-generator.ts`:

```ts
export interface StreamTriageBriefInput {
  issue: Issue;
  computronRepoPath: string;
  model: string;
  curatedComments?: string;
  onChunk: (delta: string) => void;
  streamClaude: (input: {
    model: string;
    system: string;
    user: string;
    cwd?: string;
    extraArgs: readonly string[];
    onChunk: (delta: string) => void;
    curatedComments?: string;
  }) => Promise<string>;
}

export async function streamTriageBrief(input: StreamTriageBriefInput): Promise<string> {
  const { system, user } = buildTriagePrompt({ issue: input.issue });
  return input.streamClaude({
    model: input.model,
    system,
    user,
    cwd: input.computronRepoPath,
    extraArgs: ['--add-dir', input.computronRepoPath, '--allowedTools', 'Read,Glob,Grep'],
    onChunk: input.onChunk,
    curatedComments: input.curatedComments,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/main/triage-generator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/triage-generator.ts tests/main/triage-generator.test.ts
git commit -m "feat(triage-generator): forward curatedComments to streamClaude"
```

---

## Task 9: Shared types + IPC channel constants

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Read the existing ipc-channels test**

Run: `cat tests/shared/ipc-channels.test.ts` (if it exists). If the test enumerates every channel name, plan to add the two new entries.

- [ ] **Step 2: Add the channel constants**

In `src/shared/ipc-channels.ts`, inside `IpcChannel`:

```ts
SpecPhase: 'spec:phase',
TriagePhase: 'triage:phase',
```

Place each next to its respective `Spec*` / `Triage*` neighbours.

- [ ] **Step 3: Add the payload types**

In `src/shared/types.ts`, append:

```ts
export type GenerationPhase = 'idle' | 'triaging' | 'generating' | 'done';

export interface SpecPhaseEvent {
  issueId: string;
  phase: 'triaging' | 'generating';
  commentCount?: number;
}

export interface TriagePhaseEvent {
  issueId: string;
  phase: 'triaging' | 'generating';
  commentCount?: number;
}
```

(`GenerationPhase` is the renderer-state union; the wire-format only carries `triaging` / `generating`. The literal is inlined rather than expressed as `Exclude<GenerationPhase, ...>` so the constraint is obvious at the reading site.)

- [ ] **Step 4: Update the ipc-channels test if needed; run tests + typecheck**

Run: `npm test -- tests/shared/ipc-channels.test.ts`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-channels.ts src/shared/types.ts tests/shared/ipc-channels.test.ts
git commit -m "feat(ipc): add spec:phase and triage:phase channels"
```

---

## Task 10: Preload — `onPhase` subscribers

**Files:**
- Modify: `src/shared/forge-api.ts`
- Modify: `src/main/preload.ts`
- Modify: `tests/main/preload.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/main/preload.test.ts` (match the style of existing `onChunk` / `onDone` cases):

```ts
it('exposes spec.onPhase as a function returning an unsubscribe', () => {
  expect(typeof api.spec.onPhase).toBe('function');
  const off = api.spec.onPhase(() => undefined);
  expect(typeof off).toBe('function');
});

it('exposes triage.onPhase as a function returning an unsubscribe', () => {
  expect(typeof api.triage.onPhase).toBe('function');
  const off = api.triage.onPhase(() => undefined);
  expect(typeof off).toBe('function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/main/preload.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend `ForgeApi`**

In `src/shared/forge-api.ts`, import the new event types from `./types`, then add inside `spec`:

```ts
onPhase: (handler: (event: SpecPhaseEvent) => void) => () => void;
```

…and inside `triage`:

```ts
onPhase: (handler: (event: TriagePhaseEvent) => void) => () => void;
```

- [ ] **Step 4: Implement subscribers in preload**

In `src/main/preload.ts`, inside the `spec:` API block:

```ts
onPhase: (handler) => subscribe<SpecPhaseEvent>(IpcChannel.SpecPhase, handler),
```

Inside the `triage:` block:

```ts
onPhase: (handler) => subscribe<TriagePhaseEvent>(IpcChannel.TriagePhase, handler),
```

Add the new type imports.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- tests/main/preload.test.ts`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/forge-api.ts src/main/preload.ts tests/main/preload.test.ts
git commit -m "feat(preload): expose spec/triage onPhase subscribers"
```

---

## Task 11: IPC spec handler — orchestrate fetch → triage → generate

Restructure `registerSpecGenerateHandler` so that:
1. Comments are fetched via an injected dependency.
2. The handler emits `spec:phase {phase: 'triaging', commentCount}` only when `commentCount > 0` (skipping the event entirely when there are no comments avoids a same-tick triaging-then-generating flash that the renderer can never paint).
3. `triageComments` runs only when `commentCount > 0`; on throw, we log via `console.warn` and proceed with `curated = ''`. Failure does NOT emit `spec:generate-error`.
4. Handler emits `spec:phase {phase: 'generating'}` before invoking `streamSpec`.
5. `streamSpec` is called with `curatedComments: curated`.

**Files:**
- Modify: `src/main/ipc/spec.ts`
- **Extend** (not create): `tests/main/ipc-spec-generate.test.ts` (already exists, 451 lines)

- [ ] **Step 1: Read the existing test file**

Open `tests/main/ipc-spec-generate.test.ts`. Use its existing `fakeIpc` / `fakeEvent` / `SpecDeps` / store / cache helpers — do not redefine them. Note its existing `Issue` fixture has been extended with `uuid` in Task 2.

- [ ] **Step 2: Append the failing tests**

```ts
import type { LinearComment } from '../../src/main/services/comment-fetcher';

const sampleComment: LinearComment = {
  id: 'c-1',
  body: 'hi',
  createdAt: '2026-05-01T00:00:00.000Z',
  authorName: 'Alice',
  isBot: false,
};

describe('spec:generate handler — comment-context pipeline', () => {
  it('emits triaging phase with commentCount, then generating phase, then streams', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    registerSpecGenerateHandler(ipc as never, {
      store: createStore(dir),
      cache: { read: async () => [issue], write: vi.fn() },
      readRepoContext: async (): Promise<RepoContext> => ({ agentsMd: '', thoughts: [] }),
      streamSpec: async ({ onChunk, curatedComments }) => {
        expect(curatedComments).toBe('CURATED');
        onChunk('chunk-1');
        return 'chunk-1';
      },
      templateMd: '',
      fetchAndFilterComments: async () => [sampleComment, { ...sampleComment, id: 'c-2' }],
      triageComments: async () => 'CURATED',
    });

    await ipc.invoke(IpcChannel.SpecGenerate, event, { issueId: 'FUL-77' });

    const phaseEvents = event.sent.filter((s) => s.channel === IpcChannel.SpecPhase);
    expect(phaseEvents).toHaveLength(2);
    expect(phaseEvents[0].payload).toEqual({ issueId: 'FUL-77', phase: 'triaging', commentCount: 2 });
    expect(phaseEvents[1].payload).toEqual({ issueId: 'FUL-77', phase: 'generating' });
  });

  it('skips the triaging phase event entirely when commentCount === 0', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const triage = vi.fn();
    registerSpecGenerateHandler(ipc as never, {
      store: createStore(dir),
      cache: { read: async () => [issue], write: vi.fn() },
      readRepoContext: async (): Promise<RepoContext> => ({ agentsMd: '', thoughts: [] }),
      streamSpec: async ({ curatedComments }) => {
        expect(curatedComments).toBe('');
        return '';
      },
      templateMd: '',
      fetchAndFilterComments: async () => [],
      triageComments: triage,
    });

    await ipc.invoke(IpcChannel.SpecGenerate, event, { issueId: 'FUL-77' });

    expect(triage).not.toHaveBeenCalled();
    const phaseEvents = event.sent.filter((s) => s.channel === IpcChannel.SpecPhase);
    expect(phaseEvents).toHaveLength(1);
    expect(phaseEvents[0].payload).toEqual({ issueId: 'FUL-77', phase: 'generating' });
  });

  it('proceeds to generation with curated="" when triageComments throws — logs warn, no error event', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    let observed: string | undefined;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    registerSpecGenerateHandler(ipc as never, {
      store: createStore(dir),
      cache: { read: async () => [issue], write: vi.fn() },
      readRepoContext: async (): Promise<RepoContext> => ({ agentsMd: '', thoughts: [] }),
      streamSpec: async ({ curatedComments, onChunk }) => {
        observed = curatedComments;
        onChunk('still-streaming');
        return 'still-streaming';
      },
      templateMd: '',
      fetchAndFilterComments: async () => [sampleComment],
      triageComments: async () => {
        throw new Error('triager exploded');
      },
    });

    const result = await ipc.invoke(IpcChannel.SpecGenerate, event, { issueId: 'FUL-77' });

    expect(observed).toBe('');
    // Generation continued — chunks streamed.
    const chunkSends = event.sent.filter((s) => s.channel === IpcChannel.SpecStreamChunk);
    expect(chunkSends.length).toBeGreaterThan(0);
    // No error event leaked from the triager failure.
    const errorSends = event.sent.filter((s) => s.channel === IpcChannel.SpecGenerateError);
    expect(errorSends).toHaveLength(0);
    // Failure was observably logged.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[spec] comment triage failed'),
      expect.any(Error),
    );
    expect(result).toMatchObject({ issueId: 'FUL-77' });

    warnSpy.mockRestore();
  });

  it('emits triaging phase BEFORE any spec:stream-chunk event', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    registerSpecGenerateHandler(ipc as never, {
      store: createStore(dir),
      cache: { read: async () => [issue], write: vi.fn() },
      readRepoContext: async (): Promise<RepoContext> => ({ agentsMd: '', thoughts: [] }),
      streamSpec: async ({ onChunk }) => {
        onChunk('chunk');
        return 'chunk';
      },
      templateMd: '',
      fetchAndFilterComments: async () => [sampleComment],
      triageComments: async () => 'OK',
    });

    await ipc.invoke(IpcChannel.SpecGenerate, event, { issueId: 'FUL-77' });

    const firstPhaseIdx = event.sent.findIndex((s) => s.channel === IpcChannel.SpecPhase);
    const firstChunkIdx = event.sent.findIndex((s) => s.channel === IpcChannel.SpecStreamChunk);
    expect(firstPhaseIdx).toBeGreaterThanOrEqual(0);
    expect(firstChunkIdx).toBeGreaterThan(firstPhaseIdx);
  });

  it('invokes fetchAndFilterComments with the issue UUID (not the identifier)', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const fetchSpy = vi.fn().mockResolvedValue([]);
    registerSpecGenerateHandler(ipc as never, {
      store: createStore(dir),
      cache: { read: async () => [issue], write: vi.fn() },
      readRepoContext: async (): Promise<RepoContext> => ({ agentsMd: '', thoughts: [] }),
      streamSpec: async () => '',
      templateMd: '',
      fetchAndFilterComments: fetchSpy,
      triageComments: async () => '',
    });

    await ipc.invoke(IpcChannel.SpecGenerate, event, { issueId: issue.id });

    expect(fetchSpy).toHaveBeenCalledWith(issue.uuid);
  });
});
```

Make sure the file's top-level `issue` fixture has `uuid: 'uuid-test-fixture'` (added in Task 2).

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/main/ipc-spec-generate.test.ts`
Expected: FAIL — `SpecGenerateDeps` doesn't accept `fetchAndFilterComments` / `triageComments`; phase events aren't sent.

- [ ] **Step 4: Extend `SpecGenerateDeps` and the handler**

In `src/main/ipc/spec.ts`:

```ts
import type { LinearComment } from '../services/comment-fetcher';

type FetchAndFilterCommentsFn = (issueUuid: string) => Promise<LinearComment[]>;
type TriageCommentsFn = (input: {
  issueTitle: string;
  issueDescription: string;
  comments: LinearComment[];
}) => Promise<string>;

export interface SpecGenerateDeps {
  store: ConfigStore;
  cache: IssuesCache;
  readRepoContext: (repoPath: string) => Promise<RepoContext>;
  streamSpec: StreamSpecFn;
  preflightClaudeRepoAccess?: PreflightClaudeRepoAccessFn;
  templateMd: string;
  fetchAndFilterComments: FetchAndFilterCommentsFn;
  triageComments: TriageCommentsFn;
}
```

Extend `StreamSpecFn` with `curatedComments?: string`.

Rewrite the `try` body of `registerSpecGenerateHandler`:

```ts
const cfg = await deps.store.get();
const issues = await deps.cache.read();
const issue = findIssue(issues, payload.issueId);
const targetRepoPath = specRepoPath(cfg);
const model = pickSpecModel(payload, cfg.claudeModel);
const context = await deps.readRepoContext(targetRepoPath);
const prompt = buildSpecPrompt({ issue, context, templateMd: deps.templateMd });

// Phase 1: triage. Use the Linear UUID (preserved by Task 2's mapIssue change).
const comments = await deps.fetchAndFilterComments(issue.uuid);
let curated = '';
if (comments.length > 0) {
  event.sender.send(IpcChannel.SpecPhase, {
    issueId: payload.issueId,
    phase: 'triaging',
    commentCount: comments.length,
  });
  try {
    curated = await deps.triageComments({
      issueTitle: issue.title,
      issueDescription: issue.description,
      comments,
    });
  } catch (err) {
    console.warn('[spec] comment triage failed, proceeding without curated comments:', err);
  }
}

event.sender.send(IpcChannel.SpecPhase, {
  issueId: payload.issueId,
  phase: 'generating',
});

if (cfg.computronRepoPath && deps.preflightClaudeRepoAccess) {
  await deps.preflightClaudeRepoAccess({ repoPath: cfg.computronRepoPath });
}
const content = cleanSpecMarkdown(
  await deps.streamSpec({
    model,
    system: prompt.system,
    user: prompt.user,
    extraArgs: specExtraArgs(targetRepoPath),
    cwd: targetRepoPath || undefined,
    curatedComments: curated,
    onChunk: (delta) => sendSpecChunk(event.sender, payload.issueId, delta, false),
    onStatus: (status) => sendSpecChunk(event.sender, payload.issueId, '', false, status),
  }),
);
```

The rest of the handler (chunk-done, error path for the outer try/catch) is unchanged. Note `SpecPhase` is **not** sent inside the outer catch block — only the existing `SpecGenerateError` event fires there.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- tests/main/ipc-spec-generate.test.ts tests/main/ipc-spec-get.test.ts`
Run: `npm run typecheck`
Expected: PASS. Typecheck will flag missing fields in `SpecGenerateDeps` callers — fixed in Task 13.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/spec.ts tests/main/ipc-spec-generate.test.ts
git commit -m "feat(spec-ipc): orchestrate fetch→triage→generate with phase events"
```

---

## Task 12: IPC triage handler — orchestrate fetch → triage → generate

Same pipeline applied to triage.

**Files:**
- Modify: `src/main/ipc/triage.ts`
- Modify: `tests/main/ipc-triage.test.ts`

- [ ] **Step 1: Append the failing tests**

Append to `tests/main/ipc-triage.test.ts` (uses the file's existing `fakeIpc` / `fakeEvent` / `triageIssue` helpers; the `triageIssue` fixture gets `uuid` from Task 2):

```ts
import type { LinearComment } from '../../src/main/services/comment-fetcher';

const sampleComment: LinearComment = {
  id: 'c-1',
  body: 'hi',
  createdAt: '2026-05-01T00:00:00.000Z',
  authorName: 'Alice',
  isBot: false,
};

const baseTriageCfg = {
  linearTokenPath: '',
  linearTeamKey: 'FUL',
  repoPath: '',
  computronRepoPath: '/tmp/computron',
  claudeModel: 'claude-sonnet-4-6',
};

describe('triage:generate handler — comment-context pipeline', () => {
  it('emits triaging then generating phase events with commentCount', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [sampleComment],
      triageComments: async () => 'CURATED',
      streamTriageBrief: async ({ curatedComments, onChunk }) => {
        expect(curatedComments).toBe('CURATED');
        onChunk('part');
        return 'part';
      },
    });

    await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' });

    const phaseEvents = event.sent.filter((s) => s.channel === IpcChannel.TriagePhase);
    expect(phaseEvents).toHaveLength(2);
    expect(phaseEvents[0].payload).toEqual({ issueId: 'FUL-77', phase: 'triaging', commentCount: 1 });
    expect(phaseEvents[1].payload).toEqual({ issueId: 'FUL-77', phase: 'generating' });
  });

  it('proceeds with empty curated when triage fails — logs warn, no error event', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    let observed: string | undefined;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [sampleComment],
      triageComments: async () => {
        throw new Error('boom');
      },
      streamTriageBrief: async ({ curatedComments, onChunk }) => {
        observed = curatedComments;
        onChunk('still');
        return 'still';
      },
    });

    const result = await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' });

    expect(observed).toBe('');
    const errors = event.sent.filter((s) => s.channel === IpcChannel.TriageGenerateError);
    expect(errors).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[triage] comment triage failed'),
      expect.any(Error),
    );
    expect(result).toMatchObject({ issueId: 'FUL-77' });
    warnSpy.mockRestore();
  });

  it('skips the triaging phase event entirely when commentCount === 0', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const triage = vi.fn();
    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: triage,
      streamTriageBrief: async ({ curatedComments, onChunk }) => {
        expect(curatedComments).toBe('');
        onChunk('done');
        return 'done';
      },
    });
    await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' });
    expect(triage).not.toHaveBeenCalled();
    const phaseEvents = event.sent.filter((s) => s.channel === IpcChannel.TriagePhase);
    expect(phaseEvents).toHaveLength(1);
    expect(phaseEvents[0].payload).toEqual({ issueId: 'FUL-77', phase: 'generating' });
  });

  it('invokes fetchAndFilterComments with the issue UUID', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const fetchSpy = vi.fn().mockResolvedValue([]);
    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: fetchSpy,
      triageComments: async () => '',
      streamTriageBrief: async () => '',
    });
    await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: triageIssue.id });
    expect(fetchSpy).toHaveBeenCalledWith(triageIssue.uuid);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/main/ipc-triage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend `TriageGenerateDeps` and the handler**

In `src/main/ipc/triage.ts`:

```ts
import type { LinearComment } from '../services/comment-fetcher';

type FetchAndFilterCommentsFn = (issueUuid: string) => Promise<LinearComment[]>;
type TriageCommentsFn = (input: {
  issueTitle: string;
  issueDescription: string;
  comments: LinearComment[];
}) => Promise<string>;

type StreamTriageBrief = (input: {
  issue: Issue;
  computronRepoPath: string;
  model: string;
  curatedComments?: string;
  onChunk: (delta: string) => void;
}) => Promise<string>;

export interface TriageGenerateDeps {
  store: ConfigStore;
  fetchTriageList: () => Promise<Issue[]>;
  streamTriageBrief: StreamTriageBrief;
  fetchAndFilterComments: FetchAndFilterCommentsFn;
  triageComments: TriageCommentsFn;
}
```

Insert the phase pipeline in the handler body just before the existing `streamTriageBrief` call. Pattern mirrors Task 11:

```ts
const comments = await deps.fetchAndFilterComments(issue.uuid);
let curated = '';
if (comments.length > 0) {
  event.sender.send(IpcChannel.TriagePhase, {
    issueId: payload.issueId,
    phase: 'triaging',
    commentCount: comments.length,
  });
  try {
    curated = await deps.triageComments({
      issueTitle: issue.title,
      issueDescription: issue.description,
      comments,
    });
  } catch (err) {
    console.warn('[triage] comment triage failed, proceeding without curated comments:', err);
  }
}

event.sender.send(IpcChannel.TriagePhase, {
  issueId: payload.issueId,
  phase: 'generating',
});

const content = await deps.streamTriageBrief({
  issue,
  computronRepoPath: cfg.computronRepoPath,
  model,
  curatedComments: curated,
  onChunk: (delta) => sendTriageChunk(event.sender, payload.issueId, delta, false),
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/main/ipc-triage.test.ts`
Expected: PASS — existing cases + new pipeline cases.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/triage.ts tests/main/ipc-triage.test.ts
git commit -m "feat(triage-ipc): orchestrate fetch→triage→generate with phase events"
```

---

## Task 13: Wire dependencies in `register.ts`

With Task 2 in place, `issue.uuid` is on the cached `Issue` and the IPC handler can pass it directly to `fetchAndFilterComments`. No identifier→UUID bridge helper is needed. The wiring layer simply imports the comment-fetcher / triager modules and binds them.

**Files:**
- Modify: `src/main/ipc/register.ts`
- Test: `tests/main/register.test.ts` (extend if exists; otherwise create — see Step 1)

- [ ] **Step 1: Check what wiring coverage already exists**

Run: `ls tests/main/register.test.ts 2>/dev/null || ls tests/main/app-root.test.ts 2>/dev/null`
Run: `grep -ln "registerAll\b" tests/main/`

The wiring path needs at least one test that confirms the new deps are bound. If `tests/main/register.test.ts` exists, extend it; otherwise add the assertion to `tests/main/app-root.test.ts` (which exercises `registerAll`). The assertion should verify that the registered `SpecGenerateDeps.fetchAndFilterComments` correctly calls through to `client.fetchIssueComments` with the issue UUID.

- [ ] **Step 2: Write the failing wiring test**

Add to whichever file from Step 1:

```ts
it("wires fetchAndFilterComments through to the client's fetchIssueComments using issue UUID", async () => {
  const fetchComments = vi.fn().mockResolvedValue([]);
  const stubClient: Partial<LinearClient> = {
    fetchIssueComments: fetchComments,
    // ...other stubs already in this file...
  };
  // Build the wiring lambda the way registerAll does:
  const fetchAndFilterCommentsBound = (uuid: string) =>
    fetchAndFilterComments(stubClient as LinearClient, uuid);

  await fetchAndFilterCommentsBound('uuid-abc');
  expect(fetchComments).toHaveBeenCalledWith('uuid-abc');
});
```

(`fetchAndFilterComments` is the function exported from `src/main/services/comment-fetcher.ts`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- <test file from Step 1>`
Expected: FAIL — `fetchIssueComments` not on `LinearClient`.

- [ ] **Step 4: Wire the dependencies**

In `src/main/ipc/register.ts`:

1. Add imports:

```ts
import { fetchAndFilterComments, type RawLinearComment } from '../services/comment-fetcher';
import { triageComments } from '../services/comment-triager';
```

(`streamClaude` is already imported.)

2. Extend the `LinearClient` interface:

```ts
interface LinearClient {
  getCurrentUser(): Promise<{ id: string; name: string; email: string }>;
  checkAuth(tokenPath?: string): Promise<boolean>;
  fetchAssignedIssues(assigneeId: string): Promise<RawLinearIssue[]>;
  fetchIssueDetail(identifier: string): Promise<RawLinearIssue | null>;
  fetchTeamTriage(): Promise<RawLinearIssue[]>;
  fetchIssueComments(issueId: string): Promise<RawLinearComment[]>;
}
```

(Importing `RawLinearComment` from comment-fetcher avoids duplicating the shape.)

3. Wire the new deps into both handler registrations:

```ts
registerSpecGenerateHandler(ipc, {
  store,
  cache,
  readRepoContext,
  streamSpec,
  preflightClaudeRepoAccess: ({ repoPath }) => checkRepoAccess(repoPath),
  templateMd,
  fetchAndFilterComments: (uuid) => fetchAndFilterComments(client, uuid),
  triageComments: (input) => triageComments({ ...input, streamClaude }),
});

registerTriageGenerateHandler(ipc, {
  store,
  fetchTriageList: () => fetchTriage(client as LinearClient),
  streamTriageBrief: ({ issue, computronRepoPath, model, curatedComments, onChunk }) =>
    streamTriageBrief({
      issue,
      computronRepoPath,
      model,
      curatedComments,
      onChunk,
      streamClaude,
    }),
  fetchAndFilterComments: (uuid) => fetchAndFilterComments(client, uuid),
  triageComments: (input) => triageComments({ ...input, streamClaude }),
});
```

Note: `triageComments` is invoked with `{ ...input, streamClaude }` — no adapter, because the triager's `streamClaude` parameter is typed as the full `StreamClaudeInput` (Task 4).

- [ ] **Step 5: Typecheck + full test run**

Run: `npm run typecheck`
Run: `npm test`
Expected: PASS. If any other file stubs `LinearClient` without `fetchIssueComments`, extend the stub.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/register.ts tests/main/
git commit -m "feat(ipc-register): bind comment fetcher + triager into spec/triage handlers"
```

---

## Task 14: Renderer hook — `use-spec-stream` tracks phase state

State transitions:
- Initial: `'idle'`.
- On `phase` event `triaging`: `'triaging'`, store `commentCount`.
- On `phase` event `generating`: `'generating'`.
- On `done` event: `'done'`.
- On `error`: leave phase as-is (the existing error UI is what surfaces).
- Issue switch: reset to `'idle'`.

**Files:**
- Modify: `src/renderer/hooks/use-spec-stream.ts`
- Modify: `tests/renderer/use-spec-stream.test.ts`

- [ ] **Step 1: Read the existing test file**

Open `tests/renderer/use-spec-stream.test.ts` to understand how it stubs `window.forge.spec` (likely via `vi.stubGlobal` or a per-test factory). Mirror that pattern for `onPhase`.

- [ ] **Step 2: Append the failing tests**

```ts
describe('useSpecStream — phase state', () => {
  it('starts at "idle" before any phase event', () => {
    const { result } = renderHook(() => useSpecStream('FUL-77'));
    expect(result.current.phase).toBe('idle');
    expect(result.current.commentCount).toBeUndefined();
  });

  it('transitions to "triaging" with commentCount on a matching triaging phase event', () => {
    const { result } = renderHook(() => useSpecStream('FUL-77'));
    act(() => {
      // emit via the stubbed onPhase callback registry — file already has a helper for this pattern
      emitSpecPhase({ issueId: 'FUL-77', phase: 'triaging', commentCount: 3 });
    });
    expect(result.current.phase).toBe('triaging');
    expect(result.current.commentCount).toBe(3);
  });

  it('transitions to "generating" after a generating phase event', () => {
    const { result } = renderHook(() => useSpecStream('FUL-77'));
    act(() => {
      emitSpecPhase({ issueId: 'FUL-77', phase: 'triaging', commentCount: 1 });
      emitSpecPhase({ issueId: 'FUL-77', phase: 'generating' });
    });
    expect(result.current.phase).toBe('generating');
  });

  it('transitions to "done" on the done event', () => {
    const { result } = renderHook(() => useSpecStream('FUL-77'));
    act(() => {
      emitSpecPhase({ issueId: 'FUL-77', phase: 'generating' });
      emitSpecDone({ issueId: 'FUL-77' });
    });
    expect(result.current.phase).toBe('done');
  });

  it('ignores phase events for a different issue id', () => {
    const { result } = renderHook(() => useSpecStream('FUL-77'));
    act(() => {
      emitSpecPhase({ issueId: 'FUL-99', phase: 'triaging', commentCount: 5 });
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.commentCount).toBeUndefined();
  });
});
```

Replace `emitSpecPhase` / `emitSpecDone` / `renderHook` with whatever the existing file already imports/defines.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/renderer/use-spec-stream.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement phase tracking**

In `src/renderer/hooks/use-spec-stream.ts`:

1. Import:

```ts
import type { GenerationPhase, SpecPhaseEvent } from '../../shared/types';
```

2. Add state:

```ts
const [phase, setPhase] = useState<GenerationPhase>('idle');
const [commentCount, setCommentCount] = useState<number | undefined>(undefined);
```

3. Reset in `resetStreamState`:

```ts
setPhase('idle');
setCommentCount(undefined);
```

4. Add `handlePhase`:

```ts
const handlePhase = useCallback(
  (targetIssueId: string, setupVersion: number, payload: SpecPhaseEvent): void => {
    if (payload.issueId !== targetIssueId) return;
    if (!isCurrentRun(targetIssueId, setupVersion)) return;
    setPhase(payload.phase);
    if (typeof payload.commentCount === 'number') {
      setCommentCount(payload.commentCount);
    }
  },
  [isCurrentRun],
);
```

5. In the effect, subscribe and clean up:

```ts
const unsubscribePhase = window.forge.spec.onPhase((payload) => {
  handlePhase(issueId, setupVersion, payload);
});
// ...
return () => {
  unsubscribeChunk();
  unsubscribeDone();
  unsubscribeError();
  unsubscribePhase();
};
```

Add `handlePhase` to the effect dep array.

6. In `handleDone` (where `setIsStreaming(false)` lives), also `setPhase('done')`.

7. Return `phase` and `commentCount` from the hook.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/renderer/use-spec-stream.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/use-spec-stream.ts tests/renderer/use-spec-stream.test.ts
git commit -m "feat(use-spec-stream): track triage/generate phase + commentCount"
```

---

## Task 15: Renderer hook — `use-triage-stream` tracks phase state

Identical shape to Task 14 applied to the triage hook.

**Files:**
- Modify: `src/renderer/hooks/use-triage-stream.ts`
- Modify: `tests/renderer/use-triage-stream.test.ts`

- [ ] **Step 1: Append the failing tests**

Mirror Task 14's block in `tests/renderer/use-triage-stream.test.ts`, substituting `triage` for `spec`, `TriagePhaseEvent`, `window.forge.triage.onPhase`, `emitTriagePhase` / `emitTriageDone`.

- [ ] **Step 2: Implement, run, commit**

Apply the same six changes to `src/renderer/hooks/use-triage-stream.ts`.

Run: `npm test -- tests/renderer/use-triage-stream.test.ts`
Expected: PASS.

```bash
git add src/renderer/hooks/use-triage-stream.ts tests/renderer/use-triage-stream.test.ts
git commit -m "feat(use-triage-stream): track triage/generate phase + commentCount"
```

---

## Task 16: Renderer UI — spec phase indicator

Display:
- `phase === 'triaging'` → `"Triaging {commentCount} comment(s)…"`. (No special case for `commentCount === 0` — Task 11 skips the triaging event entirely when there are no comments, so the renderer simply never enters this branch.)
- `phase === 'generating'` and no content yet → `"Generating spec…"`.
- Once chunks arrive (`content` non-empty) → indicator hidden.

**Files:**
- Modify: `src/renderer/components/spec-tab.tsx`
- Modify: `src/renderer/components/spec-drawer.tsx`
- Modify: `src/renderer/app.tsx` (the parent — `src/renderer/app.tsx:52` consumes `useSpecStream`, `src/renderer/app.tsx:236` renders `SpecDrawer`)

- [ ] **Step 1: Extend `SpecTabProps`**

```ts
phase?: GenerationPhase;
commentCount?: number;
```

Import `GenerationPhase` from `../../shared/types`.

- [ ] **Step 2: Render the phase row in the activity branch**

In `src/renderer/components/spec-tab.tsx`, in the `{!content && isStreaming ?` block (currently around line 166), insert above the `currentStatus` display:

```tsx
{phase === 'triaging' ? (
  <div className="spec-activity-phase mono dim">
    Triaging {commentCount ?? '…'} comment(s)…
  </div>
) : null}
{phase === 'generating' ? (
  <div className="spec-activity-phase mono dim">Generating spec…</div>
) : null}
```

- [ ] **Step 3: Forward through `SpecDrawer`**

In `src/renderer/components/spec-drawer.tsx`, extend `SpecDrawerProps`:

```ts
phase?: GenerationPhase;
commentCount?: number;
```

Forward to `<SpecTab phase={phase} commentCount={commentCount} ... />`.

- [ ] **Step 4: Wire from `app.tsx`**

In `src/renderer/app.tsx`, around line 52 the destructure from `useSpecStream`:

```ts
const {
  // ...existing fields...
  phase: specPhase,
  commentCount: specCommentCount,
} = useSpecStream(drawerIssueId);
```

Around line 236, forward to `<SpecDrawer phase={specPhase} commentCount={specCommentCount} ... />`.

- [ ] **Step 5: Typecheck + manual sanity check**

Run: `npm run typecheck`
Expected: PASS.

Try the dev app (`npm run dev`) on an issue with comments and one without; observe the phase row appears briefly during triage and then transitions to generating. If the dev app cannot start in this environment, log it as tech-debt:

```
- [2026-05-20][Task 16] Spec phase indicator visual verification deferred to local desktop run. Reason: other. Re-evaluate: next local dev session.
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/spec-tab.tsx src/renderer/components/spec-drawer.tsx src/renderer/app.tsx
git commit -m "feat(spec-ui): show triaging/generating phase indicator"
```

---

## Task 17: Renderer UI — triage phase indicator

Same as Task 16 for the triage drawer.

**Files:**
- Modify: `src/renderer/components/triage-drawer.tsx`
- Modify: `src/renderer/app.tsx` — the `TriageDrawerContainer` at `src/renderer/app.tsx:269` is the parent. It already destructures from `useTriageStream` at line 270.

- [ ] **Step 1: Extend `TriageDrawerProps`**

```ts
phase?: GenerationPhase;
commentCount?: number;
```

- [ ] **Step 2: Render the row**

Above the streamed body in `triage-drawer.tsx`:

```tsx
{isStreaming && phase === 'triaging' ? (
  <div className="mono dim">
    Triaging {commentCount ?? '…'} comment(s)…
  </div>
) : null}
{isStreaming && phase === 'generating' && !hasContent ? (
  <div className="mono dim">Generating brief…</div>
) : null}
```

- [ ] **Step 3: Wire from `TriageDrawerContainer`**

In `src/renderer/app.tsx:270`, destructure `phase` and `commentCount` from `useTriageStream(issue.id)` and forward to `<TriageDrawer phase={phase} commentCount={commentCount} ... />`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/triage-drawer.tsx src/renderer/app.tsx
git commit -m "feat(triage-ui): show triaging/generating phase indicator"
```

---

## Task 18: Final integration sweep

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS. Address findings inline; do not disable rules globally.

- [ ] **Step 4: Verify the two allowed `console.warn` paths**

The plan introduces exactly two `console.warn` call sites — the triager-failure path in `src/main/ipc/spec.ts` and the same in `src/main/ipc/triage.ts`. Confirm:

```bash
grep -n "console.warn" src/main/ipc/spec.ts src/main/ipc/triage.ts
```

Expected: exactly two hits, both with the `[spec] comment triage failed` / `[triage] comment triage failed` prefix.

```bash
grep -rn "console\.log" src/main/services/comment-* src/main/services/spec-generator.ts src/main/services/triage-generator.ts src/main/ipc/spec.ts src/main/ipc/triage.ts
```

Expected: empty output.

- [ ] **Step 5: Final commit if anything outstanding**

```bash
git add -A
git commit -m "chore: lint/typecheck cleanup after comment-context pipeline"
```

- [ ] **Step 6: Hand-off summary**

Update `thoughts/PROGRESS.md` "Current state": pipeline implemented, all tests pass, phase indicator visible in both drawers. Note any deferred items (visual verification, etc.) in `thoughts/tech-debt.md`.

---

## Self-review checklist

**Spec coverage:**
- ✅ §1 Linear client `fetchIssueComments` → Task 1
- ✅ §2 `comment-fetcher` (LinearComment shape, bot pre-filter, defensive `authorName`) → Task 3
- ✅ §3 `comment-triager` (Haiku 4.5 model pin, verbatim system prompt, empty-input fast path, user prompt body, error rethrow) → Task 4
- ✅ §3 per-rule prompt coverage (Rules 1–7) → Task 5
- ✅ §3 output contract-shape smoke tests + reason-vocab leak detector → Task 6
- ✅ §4 `streamSpec` / `streamTriageBrief` curatedComments prepend → Tasks 7, 8
- ✅ §5 IPC orchestration (phase events, failure handling, no new channels) → Tasks 9, 11, 12
- ✅ §6 Renderer phase indicator → Tasks 10, 14, 15, 16, 17
- ✅ §7 No new config (Haiku model id is a constant `COMMENT_TRIAGER_MODEL`) → Task 4
- ✅ §8 Tests across every new/modified module
- ✅ Failure-mode invariant: triage failure must not block generation → Tasks 11, 12 — `console.warn` spy asserts log, error-channel filter asserts no leak (observable behaviour, not handler-internal capture)
- ✅ `commentCount` payload matches post-bot-filter survivor count → Tasks 11, 12 phase-event assertions
- ✅ Linear UUID resolution is single-fetch — Task 2 puts the UUID on the cached `Issue`; no extra `fetchIssueDetail` round-trip per spec/triage

**v2 review-fix coverage:**
- ✅ B1 (circular failure-mode test) — fixed by `console.warn` spy + zero-error-event filter in Tasks 11, 12
- ✅ B2 (UUID double-roundtrip) — fixed by Task 2 putting `uuid` on the cached `Issue`
- ✅ B3 (untested register.ts bridge) — bridge eliminated by B2 fix; wiring test added in Task 13
- ✅ B4 (ipc-spec-generate.test.ts already exists) — file map and Task 11 both say "extend"
- ✅ M1, M3 (circular per-rule fixture tests) — collapsed to one parameterised contract-shape test in Task 6
- ✅ M2 (brittle prompt regex) — Task 5 uses `toContain` for literal-text assertions
- ✅ M4 (reason-vocab regex over-matches) — Task 6 scopes detector to `split('## Skipped Comments')[1]`
- ✅ M5 (hand-wavy parent location) — Tasks 16, 17 name `src/renderer/app.tsx` with line numbers
- ✅ M6 (zero-comment triaging frame never paints) — Tasks 11, 12 skip the triaging event entirely when commentCount is 0; tests assert exactly one phase event in that case
- ✅ M7 (untested register.ts wiring) — Task 13 Step 2 adds the wiring test
- ✅ m1 (LinearClient interface duplicates shape) — Task 13 imports `RawLinearComment` from comment-fetcher
- ✅ m2 (line number drift) — file map and Task 1 use current line numbers
- ✅ m3 (RepoContext `as never` casts) — Task 11 uses `{ agentsMd: '', thoughts: [] }`
- ✅ m4 (Tasks 3+4 conflated) — merged into Task 4
- ✅ m5 (triager bespoke streamClaude signature) — Task 4 types `streamClaude: (input: StreamClaudeInput) => Promise<string>`; no adapter in register.ts
- ✅ m6 (console.warn audit) — Task 18 Step 4 asserts exactly two hits
- ✅ n1 (spec drift on test directory) — flagged in front matter
- ✅ n2 (Exclude<…> too cute) — Task 9 inlines `'triaging' | 'generating'`
- ✅ n4 (spec relocation punt) — front matter decides: leave at `docs/superpowers/specs/`

**Out-of-scope (per spec):**
- Caching curated comments per issue.
- Streaming triager output.
- Multi-turn triager.
- Pagination beyond 250 comments.
- History/audit-event inclusion.

**Type consistency:**
- `Issue` shape with `uuid` consistent across Tasks 2, 11, 12, 13.
- `LinearComment` shape consistent across Tasks 3, 4, 11, 12, 13.
- `RawLinearComment` exported from `comment-fetcher.ts` and consumed by `register.ts` (Task 13) — no duplication.
- `GenerationPhase` consistent across Tasks 9, 10, 14, 15, 16, 17.
- `SpecPhaseEvent` / `TriagePhaseEvent` payload (`issueId`, `phase: 'triaging' | 'generating'`, `commentCount?`) matches between main-process emit (Tasks 11, 12) and renderer consume (Tasks 14, 15).
- Triager `streamClaude` parameter is the full `StreamClaudeInput` from `spec-generator.ts` (Task 4); no adapter layer in `register.ts` (Task 13).

**Placeholder scan:** none — every step has concrete code, exact paths, and explicit expected outputs.
