# Phase 1 Technical Spec — MVP: "See your board, generate a spec"

_Date: 2026-05-12_

## Goal

Open the app → see assigned Linear issues → click an issue → read a generated spec in under 30 seconds.

## Scope

- Electron + React shell (bootstrapped)
- Auth checker on startup (Linear, Claude Code, Codex CLI)
- Linear polling: fetch assigned issues for configured sub-team
- Issue list UI with status tabs and grouped cards
- Issue detail drawer
- Spec Generator: reads AGENTS.md (or CLAUDE.md fallback) + thoughts/ + issue → calls Claude API → renders structured markdown spec
- Spec is copyable
- No agent spawning in Phase 1

---

## Data Model

### Issue

```ts
interface Issue {
  id: string               // Linear issue ID (e.g. "ENG-142")
  title: string
  description: string      // markdown from Linear
  status: IssueStatus
  priority: Priority
  labels: string[]
  url: string              // Linear issue URL
  updatedAt: string        // ISO timestamp
}

type IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none'
```

### Spec

```ts
interface CommentThread {
  blockAnchor: string      // identifies the markdown block this thread is anchored to
  comments: string[]       // user comment history — unused in Phase 1
}

interface Spec {
  issueId: string
  content: string          // raw markdown
  generatedAt: string      // ISO timestamp
  approved: boolean
  comments?: CommentThread[] // review comment threads — populated in Phase 2+
}
```

### AppConfig

```ts
interface AppConfig {
  linearTokenPath: string  // default: ~/.humanlayer/riptide/linear.json (shape: { access_token })
  linearTeamKey: string    // default: 'FUL'
  repoPath: string         // absolute path to the repo being worked on
  claudeModel: string      // default: claude-sonnet-4-6
}
```

### AuthStatus

```ts
interface AuthStatus {
  linear: boolean
  claudeCode: boolean
  codex: boolean
}
```

---

## Linear Polling

- **Transport:** Raw GraphQL via the existing `createLinearClient` factory in `.agents/skills/linear/reference/linear.mjs`. Do not use `@linear/sdk` or hand-roll mutations.
- **Query:** two-step. First call `getCurrentUser()` to get the viewer's id, then call `fetchAssignedIssues(assigneeId)` filtered by team key. Both functions to be added to the linear client following the existing pattern.
- **Poll interval:** 60 seconds (manual refresh button also available)
- **Fields fetched:** id, identifier, title, description, state (name + type), priority, labels (name), issueType (if present in API response), url, updatedAt
- **Storage:** in-memory cache in main process, persisted to flat JSON (`~/.forge/issues.json`) for cold-start speed
- **IPC channel:** `linear:fetch-issues` → returns `Issue[]`

### New functions to add to `.agents/skills/linear/reference/linear.mjs`

```js
// Returns the authenticated user's id and name
async function getCurrentUser() // → { id, name, email }

// Returns all open issues assigned to assigneeId within the bound team
async function fetchAssignedIssues(assigneeId) // → Issue[]
// Fields: id, identifier, title, description, state { name, type },
//         priority, labels { nodes { name } }, issueType { name } (if available), url, updatedAt
```

Follow the existing `createLinearClient` factory pattern. Add to the `return {}` block and document in `SKILL.md`.

### Bug detection

An issue is classified as a bug (for grouping purposes) if either condition is true — checked in order:

1. Any label name matches `/^bug$/i`
2. `issueType.name` matches `/^bug$/i` (fallback — only if Linear returns this field)

### Priority mapping from Linear

```
Linear priority 1 → urgent
Linear priority 2 → high
Linear priority 3 → medium
Linear priority 4 → low
Linear priority 0 → none
```

### Status mapping from Linear

Map Linear workflow state names to internal status. On first connect, fetch all workflow states from Linear for the configured team and seed the mapping. Config-driven — user customizes the mapping in Phase 5. The seeded mapping is persisted to `~/.forge/config.json` so it survives restarts.

Internal statuses are intentionally coarse — many Linear states collapse to the same bucket:

```
type → todo        (e.g. "Todo", "Backlog", "Triage")
type → in_progress (e.g. "In Progress", "Started")
type → in_review   (e.g. "In Review", "In QA")
type → done        (e.g. "Done", "Completed", "Cancelled")
```

Linear state `type` field drives the mapping, not the name — more reliable across teams.

---

## Spec Generator

### Input

1. `AGENTS.md` from configured `repoPath` (fallback to `CLAUDE.md` if `AGENTS.md` is absent)
2. All files in `thoughts/` from configured `repoPath` (excluding `tasks/`)
3. Linear issue: title + description + labels + priority

### Prompt structure

```
System: You are a senior engineer writing a structured implementation spec.
        Use the provided codebase context and issue details to produce a spec
        following the template format exactly.

User:   [AGENTS.md contents — or CLAUDE.md contents if AGENTS.md absent]
        [thoughts/conventions.md contents]
        [thoughts/tech-debt.md contents if relevant]

        Issue: [id] — [title]
        Priority: [priority]  Labels: [labels]

        [issue description]

        Write a spec using this template:
        [spec-template.md contents]
```

### Output

Raw markdown conforming to `docs/templates/spec-template.md`. Rendered in the spec drawer tab. Copyable via a copy button.

### IPC channel

`spec:generate` → `{ issueId: string }` → streams markdown back to renderer, final result saved to `thoughts/tasks/[issueId]/initial-spec.md` in the configured repo.

### Claude API config

- Model: `claude-sonnet-4-6` (configurable)
- Streaming: yes — render tokens as they arrive
- Max tokens: 2048

---

## Electron IPC Structure

All communication between renderer and main process goes through typed IPC channels.

### Channel naming

`domain:action` — e.g. `linear:fetch-issues`, `spec:generate`, `auth:check`

### Phase 1 channels

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `auth:check` | renderer → main | — | `AuthStatus` |
| `linear:fetch-issues` | renderer → main | — | `Issue[]` |
| `linear:refresh` | renderer → main | — | `Issue[]` |
| `spec:generate` | renderer → main | `{ issueId }` | streaming markdown chunks |
| `spec:get` | renderer → main | `{ issueId }` | `Spec \| null` |
| `config:get` | renderer → main | — | `AppConfig` |
| `config:set` | renderer → main | `Partial<AppConfig>` | `void` |

### Renderer constraints

- No direct Node.js API calls in renderer. IPC only.
- `contextBridge` exposes a typed `window.forge` API surface — no `ipcRenderer` exposed directly.

---

## Auth Checker

On startup, main process checks:

1. **Linear:** read `access_token` from `linearTokenPath` (default: `~/.humanlayer/riptide/linear.json`). If present, attempt a minimal GraphQL query via `createLinearClient`. Success = connected.
2. **Claude Code:** run `claude --version` via child_process. Exit 0 = connected.
3. **Codex:** run `codex --version` via child_process. Exit 0 = connected.

Result sent to renderer via `auth:check` response. Displayed in right panel as colored status dots. No retry logic — user fixes manually.

---

## Storage

- **Issues cache:** `~/.forge/issues.json` — flat JSON, overwritten on each poll
- **Specs:** written to `thoughts/tasks/[issueId]/initial-spec.md` inside configured `repoPath`
- **Config:** `~/.forge/config.json`

Phase 1 uses no SQLite. Flat JSON is sufficient for issue count at this scale.

---

## Coding Standards

These are non-negotiable constraints for all Phase 1 implementation. Exceptions require an explicit comment explaining why.

### TDD
Write tests before implementation. Every module has a corresponding test file. No feature is considered done until its tests pass.

### No duplication
Extract shared logic immediately — don't wait for a third occurrence. Shared utilities belong in `src/shared/` (main + renderer safe) or `src/main/lib/` (main-only).

### Cyclomatic complexity
Maximum complexity of 4 per function. Functions that would exceed this must be decomposed. Use early returns over nested conditionals.

```ts
// Bad — complexity 5
function classify(issue) {
  if (issue.labels.some(l => /^bug$/i.test(l))) {
    if (issue.priority === 'urgent') { return 'urgent-bug'; }
    else { return 'bug'; }
  } else {
    if (issue.priority === 'urgent') { return 'urgent'; }
    else { return 'normal'; }
  }
}

// Good — complexity 2 each
function isBug(issue) {
  return issue.labels.some(l => /^bug$/i.test(l))
      || /^bug$/i.test(issue.issueType?.name ?? '');
}

function classifyPriority(issue) {
  if (isBug(issue)) return issue.priority === 'urgent' ? 'urgent-bug' : 'bug';
  return issue.priority === 'urgent' ? 'urgent' : 'normal';
}
```

### TypeScript
No `any` without a `// reason:` comment on the same line. Prefer `unknown` + type narrowing.

---

## Milestone Definition

Phase 1 is complete when:
1. App launches and displays auth status for Linear, Claude Code, Codex
2. Assigned Linear issues appear in the issue list with correct grouping and status tabs
3. Clicking an issue opens the detail drawer with Linear description
4. Clicking "Generate Spec" streams a structured spec into the spec tab in under 30 seconds
5. Generated spec is saved to `thoughts/tasks/[issueId]/initial-spec.md`
6. Spec is copyable
