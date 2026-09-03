# Spec: Comment-aware triage briefs and specs

> **Status:** Draft
> **Generated:** 2026-05-19
> **Branch:** TBD (off `main`)
> **Issue:** N/A (project-level work)

---

## Task Summary

Linear issues frequently carry important signal in their comments — reporter clarifications, reproduction notes, links to related work, decisions made in discussion, pasted Slack threads — that the current Forge triage-brief and spec-generation flows never see. Today both flows feed only `title`, `description`, `priority`, and `labels` to the researcher Claude model.

This spec adds a **two-stage pipeline** to both the triage and spec flows:

1. **Comment triager** — a cheap LLM call (Claude Haiku 4.5) that takes the issue's comments and filters/restructures them into a curated context block.
2. **Researcher** — the existing generation call, now receiving the curated comment block alongside the issue body.

The UI exposes this as a visible **two-phase progress** indicator so the user understands the extra latency.

---

## Context

### Where today's flows live

- **Linear client (read ops):** `.agents/skills/linear/reference/linear.mjs`
  - `fetchAssignedIssues(assigneeId)` (line 551) and `fetchTeamTriage()` (line 575) fetch `id identifier title description state priority labels url updatedAt`. **No comment fetch exists** anywhere in the client.
  - `fetchIssueDetail(identifier)` (line 519) — same field set, no comments.
- **Linear service:** `src/main/services/linear-service.ts` — surfaces the client to main process.
- **Spec generation:** `src/main/services/spec-generator.ts` — exposes `streamSpec({ model, system, user, onChunk })` plus a lower-level `streamClaude`. Spawns `claude -p ...` and streams stdout deltas.
- **Triage brief generation:** `src/main/services/triage-generator.ts` — wraps `streamClaude` with the triage prompt and `--add-dir` for the computron repo.
- **Spec drawer / triage drawer:** `src/renderer/components/spec-drawer.tsx` and `triage-drawer.tsx`, backed by `use-spec-stream.ts` / `use-triage-stream.ts` hooks and `src/main/ipc/spec.ts` / `triage.ts` IPC.

### Linear's comment data model

Linear's GraphQL exposes issue comments under `issue.comments.nodes`. Each comment has:

- `id`, `body` (markdown), `createdAt`
- `user { id name }` — the human author (null for bot-authored)
- `botActor { id }` — non-null for bot/integration/automation comments. **This is the authoritative bot signal — no body-substring heuristics needed.** We only need the existence check, so we select the minimum field (`id`) and discard the rest.

Linear's status-change / move / assign system events are exposed via `issue.history`, **not** `issue.comments`, so the `comments` query is already free of system noise.

### Conventions from `AGENTS.md`

- All Linear ops through `.agents/skills/linear/reference/linear.mjs`. No hand-rolled GraphQL elsewhere.
- Local-first, no backend. Config-driven.
- `thoughts/tasks/<task-slug>/` is the agent handshake folder.

---

## Suggested Approach

### 1. Linear client — fetch issue comments

In `.agents/skills/linear/reference/linear.mjs`, add:

```js
/**
 * Fetch all comments on an issue.
 *
 * @param {string} issueId  Linear issue id (UUID, not identifier)
 * @returns {Promise<Array<{
 *   id: string,
 *   body: string,
 *   createdAt: string,
 *   user: { id: string, name: string } | null,
 *   botActor: { id: string } | null,
 * }>>}
 */
async function fetchIssueComments(issueId) {
  const data = await linearRequest(
    `
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
  `,
    { issueId },
  );
  return data.issue?.comments?.nodes ?? [];
}
```

- Document in `.agents/skills/linear/SKILL.md` under Reads.
- Export from the client factory.

### 2. Comment fetcher service (main)

New module `src/main/services/comment-fetcher.ts`:

```ts
export type LinearComment = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string; // user.name OR botActor.name
  isBot: boolean; // botActor !== null
};

export async function fetchIssueComments(
  client: LinearClient,
  issueId: string,
): Promise<LinearComment[]>;
```

Normalises the Linear shape, sets `isBot` from `botActor !== null`, then applies the **single pre-filter rule**: drop entries where `isBot === true`. Returns the surviving comments. No substring heuristics, no Linear-system filter (system events live in `history`, not `comments`).

### 3. Comment triager (Haiku call)

New module `src/main/services/comment-triager.ts`:

```ts
export type TriageInput = {
  issueTitle: string;
  issueDescription: string;
  comments: LinearComment[];
};

export async function triageComments(input: TriageInput): Promise<string>;
```

Spawns Claude with `--model claude-haiku-4-5-20251001`, reusing the existing `streamClaude` runner from `spec-generator.ts` (which already accepts a `model` arg). Returns the full curated markdown as a single string (no streaming to renderer — this is an internal step).

**Empty-comments path:** if `comments.length === 0`, return `''` without spawning Claude.

**System prompt (verbatim):**

```
You are filtering and restructuring Linear ticket comments for an engineer
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

(Repeat per relevant comment. Separate with a `---` line.)

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
5. Use `reason` values from this set only: `bot` (shouldn't happen,
   pre-filtered), `won't-do`, `noise`, `filler`, `off-topic`.
6. If no comments are relevant, output `## Relevant Comments\n_(none)_`
   followed by the Skipped Comments section.
7. Return only the two sections. No preamble, no postscript, no code
   fences wrapping the whole output.
```

**User prompt body:** issue title + description + a numbered list of comments rendered as `### {n}. {author} — {createdAt}\n\n{body}\n`.

### 4. Wire curated context into both generators

`spec-generator.ts`:

- Add optional param to `streamSpec`: `curatedComments?: string`.
- When non-empty, prepend a `## Comment context\n\n{curated}\n\n---\n\n` block to the user prompt, **above** the issue body.

`triage-generator.ts`:

- Same param, same prepend.

The researcher prompts already treat the user message as free-form context — no further prompt changes needed beyond the prepend.

### 5. Orchestration in IPC handlers

`src/main/ipc/spec.ts` and `src/main/ipc/triage.ts` change identically. Pseudocode for the spec handler:

```ts
ipcMain.handle('spec:generate', async (e, { issueId, ... }) => {
  // Phase 1: triage comments
  const comments = await fetchIssueComments(client, issueId);
  e.sender.send('spec:phase', { phase: 'triaging', commentCount: comments.length });

  let curated = '';
  if (comments.length > 0) {
    try {
      curated = await triageComments({ issueTitle, issueDescription, comments });
    } catch (err) {
      log.warn('comment triage failed, proceeding without', err);
      // curated stays ''
    }
  }

  // Phase 2: main generation
  e.sender.send('spec:phase', { phase: 'generating' });
  await streamSpec({
    ...,
    curatedComments: curated,
    onChunk: chunk => e.sender.send('spec:chunk', chunk),
  });
  e.sender.send('spec:done');
});
```

**Failure mode:** if the triage step throws or times out, log a warning and proceed with `curated = ''`. Generation must never be blocked by comment triage.

**No new IPC channels.** A single new event type on each existing channel: `spec:phase` and `triage:phase` with payload `{ phase: 'triaging' | 'generating', commentCount?: number }`.

### 6. Renderer — phase indicator

`use-spec-stream.ts` and `use-triage-stream.ts` track a new `phase` state (`'idle' | 'triaging' | 'generating' | 'done'`) updated from incoming `phase` events.

`spec-drawer.tsx` / `triage-drawer.tsx` render a small status row above the streaming area:

- `triaging` → `"Triaging {commentCount} comment(s)..."` (spinner).
- `generating` → `"Generating brief..."` / `"Generating spec..."` (spinner). Replaced visually by stream content once chunks arrive.
- `done` → indicator hidden.

If `commentCount === 0` the triaging phase is still surfaced briefly but the message reads `"No comments to triage"` and resolves quickly.

### 7. Config

No new config fields. Haiku model id is a constant (`claude-haiku-4-5-20251001`) in `comment-triager.ts`. The existing Claude CLI auth and `claude` binary path settings cover both calls.

### 8. Tests

For each new / modified module, add a unit test in the matching `__tests__/` folder.

#### `comment-fetcher`

- Bot filter strips entries where `botActor !== null`; survives `botActor === null`.
- Non-bot rows preserved verbatim with normalised `{id, body, createdAt, authorName, isBot}` shape.
- Empty list passes through unchanged.
- `authorName` falls back correctly: `user.name` when present, else `'Unknown'` when both `user` and `botActor` are null (defensive — shouldn't happen post-filter).

#### `comment-triager` — infrastructure tests

- Empty input (zero comments) returns `''` without spawning Claude.
- Spawn-mock test verifying `--model claude-haiku-4-5-20251001` is passed.
- Snapshot of the assembled user prompt for a fixed input (issue title + description + numbered comments).
- Spawn failure / non-zero exit → `triageComments` throws (caller is responsible for catching).

#### `comment-triager` — prompt rule coverage

One test per system-prompt rule, asserting the prompt text contains the rule (string-match against the constant). Plus one end-to-end test per rule using a mocked Claude that returns a canned response, asserting the test fixture reaches the curated-output assertions:

- **Rule 1 (relevance):** fixture with a comment containing a stack-trace + repro steps → asserted as Relevant with verbatim body.
- **Rule 2 (skip noise):** fixture with a `"+1"` comment → asserted as Skipped with `reason: noise`.
- **Rule 3 (won't-do thread):** fixture with a 3-comment thread ending in "we won't do this" → asserted as single Skipped entry with `reason: won't-do`, no Relevant entries from that thread.
- **Rule 5 (reason vocabulary):** assert the prompt explicitly enumerates `bot | won't-do | noise | filler | off-topic` and no other reason value appears in fixture outputs.
- **Rule 6 (empty relevant section):** fixture where every comment is noise → output contains `## Relevant Comments\n_(none)_`.
- **Rule 7 (no preamble):** fixture output asserted not to start with anything other than `## Relevant Comments`.

#### `comment-triager` — Slack thread restructuring (Rule 4)

Minimum five distinct fixture tests, one per sub-behaviour:

1. **Length threshold — under:** Slack thread of 10 messages / 500 words → output preserves verbatim, no restructuring applied.
2. **Length threshold — over:** Slack thread of 60 messages / 3000 words → output is summarised, original verbatim body absent from the Relevant entry.
3. **Timestamp stripping:** fixture thread with per-message `[10:23 AM]` markers → asserted that no timestamp markers appear in the curated output.
4. **Consecutive same-author collapse:** thread with `alice → alice → alice → bob → alice` ordering → asserted that the curated output has at most one author header for each contiguous run (so 3 headers total for that sequence, not 5).
5. **Substantive content preservation:** thread that contains both filler ("got it", "lol", "ok") and a concrete technical sentence ("the bug is in `auth/middleware.ts:42`, the token check uses `<` not `<=`") → asserted that the technical sentence appears verbatim in the curated output and the filler does not.

Each test uses a mocked Claude that returns a canned response shaped to validate the behaviour; the assertion targets the rendered output, not the prompt. (Real LLM behaviour is verified manually during dev — these tests pin the contract between triager and downstream.)

#### Other modules

- `spec-generator` / `triage-generator`: `curatedComments` is injected above the issue body when non-empty; omitted entirely (no empty `## Comment context` header) when empty string.
- `spec` / `triage` IPC handlers:
  - `phase` event fires with `triaging` before first chunk.
  - `phase` event fires with `generating` after triage completes.
  - Triage failure (mocked throw from triager) does not block generation — asserts `spec:chunk` events still arrive.
  - `commentCount` payload matches the post-bot-filter survivor count.
- Linear client: snapshot of the `fetchIssueComments` GraphQL query string.
- Renderer hooks (`use-spec-stream`, `use-triage-stream`): phase state transitions correctly on incoming events (`idle → triaging → generating → done`).

---

## Resolved Decisions

- [x] **Filter scope** — `botActor !== null` is the only hard pre-filter. Linear system events live in `history`, not `comments`, so no system-message filter needed.
- [x] **GraphQL field selection for `botActor`** — `botActor { id }` only. We only need existence; `name` and `type` were discarded downstream (YAGNI). The normalised `LinearComment.isBot: boolean` is the only field that crosses the service boundary.
- [x] **Triager model** — `claude-haiku-4-5-20251001`.
- [x] **Output format** — Relevant section: optional 1-line annotation + verbatim body. Skipped section: one-line summary + reason tag.
- [x] **Slack thread handling** — triager summarizes, strips per-message timestamps, collapses consecutive same-author messages.
- [x] **"Won't do" threads** — whole thread skipped with one combined summary line.
- [x] **Failure handling** — triage failure logs a warning and generation proceeds without curated comments.
- [x] **UI** — two-phase visible progress (`triaging` → `generating`), reusing existing IPC channels with a new `phase` event type.
- [x] **No new config** — Haiku model id is a constant.

---

## Out of Scope (tech-debt candidates)

- **Caching curated comments per issue.** Re-runs always re-triage. Adding a cache (e.g. keyed on `issueId` + comment-id hash) is a later optimisation.
- **Streaming the triager output.** Triager returns a single string; the user only sees the phase indicator while it runs, not partial output. Streaming the triager would add complexity for low UX value.
- **Multi-turn triager.** Triager is one-shot per generation; it cannot ask follow-up questions about a comment.
- **Pagination beyond 250 comments.** The GraphQL query uses `first: 250`. Tickets exceeding that are vanishingly rare in practice; pagination can be added if it ever bites.
- **History/audit-event inclusion.** Linear's `issue.history` (status moves, label changes, assignee changes) is not fetched. Could be a future signal but adds noise risk.
