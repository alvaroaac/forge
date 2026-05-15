# Triage Tab + Computron-Aware Brief — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Triage tab to Forge that surfaces team-wide Linear issues in the `triage` state, and replaces spec generation for those issues with an "engineering brief" produced by `claude` with read-only filesystem access to a configurable separate repo called *computron*.

**Architecture:** Bottom-up, TDD. Extend `IssueStatus` and Linear mapping first; add a `fetchTeamTriage` operation to the Linear skill client and merge results in `use-issues`; add a `computronRepoPath` config field; refactor `streamSpec` into a lower-level `streamClaude` that accepts extra CLI args; build a parallel triage pipeline (`triage-prompt` → `triage-generator` → `triage-writer`) sharing the spawn machinery; mirror spec IPC + preload + drawer plumbing for triage. Default selected tab on app open stays `Todo`.

**Tech Stack:** Electron + React + TypeScript; Vitest for unit tests + Testing Library for renderer tests; `claude` CLI (latest, with `--add-dir` and `--allowedTools` support) spawned via `node:child_process`; existing Linear OAuth client at `.agents/skills/linear/reference/linear.mjs`.

---

## Spec Reference

See [thoughts/tasks/add-triage/initial-spec.md](../initial-spec.md). All decisions in "Resolved Decisions" are locked. The plan implements every numbered approach step from the spec.

---

## File Structure

### Created
- `src/main/services/computron-checker.ts` — verify `computronRepoPath` exists and is a git repo.
- `src/main/services/triage-prompt.ts` — system + user prompt builder for the engineering brief.
- `src/main/services/triage-generator.ts` — wraps `streamClaude` with triage-specific args.
- `src/main/services/triage-writer.ts` — writes `triage-brief.md`, signals overwrite.
- `src/main/ipc/triage.ts` — IPC handlers for `triage:generate` and `triage:write`.
- `src/renderer/components/triage-drawer.tsx` — drawer rendering the engineering brief.
- `src/renderer/hooks/use-triage-stream.ts` — stream hook for triage brief.
- `tests/main/computron-checker.test.ts`
- `tests/main/triage-prompt.test.ts`
- `tests/main/triage-generator.test.ts`
- `tests/main/triage-writer.test.ts`
- `tests/main/ipc-triage.test.ts`
- `tests/main/linear-skill-fetchTeamTriage.test.ts`
- `tests/renderer/triage-drawer.test.tsx`
- `tests/renderer/use-triage-stream.test.ts`

### Modified
- `src/shared/types.ts` — extend `IssueStatus` (+`'triage'`), `AppConfig` (+`computronRepoPath`), add `assigneeId` to `Issue`, add `TriageStreamChunk`/`TriageGenerateDone`/`TriageGenerateError`/`TriageWriteResult` shapes, extend `AuthStatus` (+`computron`).
- `src/shared/ipc-channels.ts` — add `LinearFetchTeamTriage`, `LinearGetViewerId`, `TriageGenerate`, `TriageStreamChunk`, `TriageGenerateDone`, `TriageGenerateError`, `TriageWrite`.
- `src/shared/forge-api.ts` — expose `linear.fetchTeamTriage`, `linear.getViewerId`, `triage.*` methods.
- `src/main/preload.ts` — wire new channels.
- `src/main/services/linear-mapping.ts` — `triage` state.type now maps to `'triage'` (not `'todo'`).
- `src/main/services/linear-service.ts` — add `fetchTriage`, extend `mapIssue` with `assigneeId`.
- `src/main/services/spec-generator.ts` — extract `streamClaude(extraArgs)`; keep `streamSpec` as thin wrapper.
- `src/main/services/config-store.ts` — add `computronRepoPath: ''` to `DEFAULTS`.
- `src/main/services/auth-checker.ts` — add `computronRepoPath` to inputs; include `computron` boolean in `AuthStatus` (delegating to `computron-checker`).
- `src/main/ipc/linear.ts` — wire `fetchTeamTriage` + `getViewerId` handlers + cache.
- `src/main/ipc/register.ts` — load + pass new deps; register triage handlers.
- `src/main/ipc/auth.ts` — include `computronRepoPath` when calling `checkAll`.
- `.agents/skills/linear/reference/linear.mjs` — add `fetchTeamTriage`.
- `.agents/skills/linear/SKILL.md` — document new operation.
- `src/renderer/app.tsx` — open `TriageDrawer` when the active issue's status is `'triage'`.
- `src/renderer/hooks/use-issues.ts` — additionally fetch team triage and merge.
- `src/renderer/components/issue-list-panel.tsx` — add `'Triage'` tab + `MineOnly` toggle.
- `tests/main/linear-mapping.test.ts` — update the `'triage' → 'todo'` assertion.
- `tests/main/spec-generator.test.ts` — adapt to the refactor (no behavioural change).
- `tests/main/auth-checker.test.ts` — include `computron` in `AuthStatus` expectations.
- `tests/renderer/issue-list-panel.test.tsx` — add Triage tab + toggle tests.
- `tests/renderer/use-issues.test.ts` — cover the team-triage merge.
- `tests/shared/types.test.ts` and `tests/shared/ipc-channels.test.ts` — extend assertions.

### Out of scope
Config UI input for `computronRepoPath` (none of the other config fields have one today; user edits `config.json` directly).

---

## Conventions reminders

- All Linear access goes through `.agents/skills/linear/reference/linear.mjs`. Do **not** hand-roll GraphQL anywhere else.
- Tests use Vitest. Run with `npm test -- <filename>` for a single file.
- Commit after each task with conventional-commit prefix (`feat:`, `refactor:`, `test:`, `docs:`).
- `npm run typecheck` must pass after every task that changes types.

---

## Task 1: Extend `IssueStatus` with `'triage'`

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `tests/shared/types.test.ts`

- [ ] **Step 1: Update test to require `'triage'` in the union**

In `tests/shared/types.test.ts`, add a case that uses `'triage'` as an `IssueStatus` and ensures the type compiles:

```ts
it('allows triage as a valid IssueStatus', () => {
  const status: IssueStatus = 'triage';
  expect(status).toBe('triage');
});
```

- [ ] **Step 2: Run test — expect TS error**

Run: `npm run typecheck`
Expected: error along the lines of `Type '"triage"' is not assignable to type 'IssueStatus'`.

- [ ] **Step 3: Add `'triage'` to the union**

In `src/shared/types.ts`:

```ts
export type IssueStatus = 'triage' | 'todo' | 'in_progress' | 'in_review' | 'done';
```

- [ ] **Step 4: Re-run typecheck + the single test**

Run: `npm run typecheck && npm test -- tests/shared/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts tests/shared/types.test.ts
git commit -m "feat(types): add 'triage' to IssueStatus union"
```

---

## Task 2: Map Linear `triage` state.type to `'triage'`

**Files:**
- Modify: `src/main/services/linear-mapping.ts:11-19`
- Modify: `tests/main/linear-mapping.test.ts:36`

Today line 36 in the test asserts `mapStatus({ type: 'triage' }) === 'todo'`. We are flipping that.

- [ ] **Step 1: Update the existing assertion**

Replace the assertion at `tests/main/linear-mapping.test.ts:36` with:

```ts
expect(mapStatus({ name: 'Triage', type: 'triage' })).toBe('triage');
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/main/linear-mapping.test.ts`
Expected: assertion failure, current implementation still returns `'todo'`.

- [ ] **Step 3: Update the mapping table**

In `src/main/services/linear-mapping.ts`, replace the `STATUS_TABLE`:

```ts
const STATUS_TABLE: Record<string, IssueStatus> = {
  triage: 'triage',
  backlog: 'todo',
  unstarted: 'todo',
  started: 'in_progress',
  review: 'in_review',
  completed: 'done',
  canceled: 'done',
};
```

- [ ] **Step 4: Re-run test — expect PASS**

Run: `npm test -- tests/main/linear-mapping.test.ts`
Expected: all assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/linear-mapping.ts tests/main/linear-mapping.test.ts
git commit -m "feat(linear): map Linear triage state.type to IssueStatus 'triage'"
```

---

## Task 3: Carry `assigneeId` through `Issue`

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/services/linear-service.ts:13-44`
- Modify: `tests/renderer/issue-list-panel.test.tsx` (only to satisfy the new required field in fixtures)
- Modify: `tests/renderer/issue-group.test.tsx`, `tests/renderer/issue-card.test.tsx`, `tests/renderer/spec-tab.test.tsx`, `tests/renderer/detail-tab.test.tsx`, `tests/renderer/app.test.tsx`, `tests/renderer/spec-drawer.test.tsx` (same reason — wherever an `Issue` literal lacks `assigneeId`, add `assigneeId: null`)

- [ ] **Step 1: Update `Issue` interface**

In `src/shared/types.ts`:

```ts
export interface Issue {
  id: string;
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

- [ ] **Step 2: Run typecheck — expect failures across renderer test fixtures**

Run: `npm run typecheck`
Expected: TS errors of the form `Property 'assigneeId' is missing in type ...` in the test files listed above.

- [ ] **Step 3: Extend `RawLinearIssue` and `mapIssue`**

In `src/main/services/linear-service.ts`, replace the interface and `mapIssue`:

```ts
export interface RawLinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  state: { name: string; type: string };
  priority: number;
  labels: { nodes: Array<{ name: string }> };
  url: string;
  updatedAt: string;
  assignee?: { id: string } | null;
}

export function mapIssue(raw: RawLinearIssue): Issue {
  const labels = raw.labels.nodes.map((n) => n.name);

  return {
    id: raw.identifier,
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

- [ ] **Step 4: Update every renderer fixture to include `assigneeId: null`**

For each test file flagged in Step 2, locate the issue literal(s) and add the field. Example for `tests/renderer/issue-list-panel.test.tsx:51-96`:

```ts
const issues: Issue[] = [
  {
    id: 'FUL-1',
    title: 'first',
    description: '',
    status: 'todo',
    priority: 'urgent',
    labels: ['frontend'],
    url: '',
    updatedAt: '',
    isBug: true,
    assigneeId: null,
  },
  // ... etc.
];
```

- [ ] **Step 5: Re-run typecheck and full test suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/main/services/linear-service.ts tests/
git commit -m "feat(issues): add assigneeId to Issue and thread it from Linear"
```

---

## Task 4: Linear skill — `fetchTeamTriage`

**Files:**
- Modify: `.agents/skills/linear/reference/linear.mjs:540-595`
- Modify: `.agents/skills/linear/SKILL.md`
- Create: `tests/main/linear-skill-fetchTeamTriage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/main/linear-skill-fetchTeamTriage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface LinearSkillModule {
  createLinearClient(opts: { teamKey: string; titlePrefix: string }): {
    fetchTeamTriage: () => Promise<
      Array<{
        id: string;
        identifier: string;
        title: string;
        description: string;
        state: { name: string; type: string };
        priority: number;
        labels: { nodes: Array<{ name: string }> };
        url: string;
        updatedAt: string;
        assignee: { id: string } | null;
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

describe('linear client — fetchTeamTriage', () => {
  it('returns triage issues for the bound team and includes assignee id', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        data: {
          issues: {
            nodes: [
              {
                id: 'i1',
                identifier: 'FUL-9',
                title: 'a triage thing',
                description: 'reported by support',
                state: { name: 'Triage', type: 'triage' },
                priority: 0,
                labels: { nodes: [] },
                url: 'https://linear.app/foo/FUL-9',
                updatedAt: '2026-05-14T00:00:00Z',
                assignee: null,
              },
              {
                id: 'i2',
                identifier: 'FUL-10',
                title: 'assigned-but-triage',
                description: '',
                state: { name: 'Triage', type: 'triage' },
                priority: 0,
                labels: { nodes: [] },
                url: 'https://linear.app/foo/FUL-10',
                updatedAt: '2026-05-14T00:00:00Z',
                assignee: { id: 'u42' },
              },
            ],
          },
        },
      }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    const items = await client.fetchTeamTriage();

    expect(items).toHaveLength(2);
    expect(items[0].assignee).toBeNull();
    expect(items[1].assignee).toEqual({ id: 'u42' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables).toEqual({ teamKey: 'FUL' });
    expect(body.query).toMatch(/type: \{ eq: "triage" \}/);
    expect(body.query).toMatch(/team: \{ key: \{ eq: \$teamKey \} \}/);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- tests/main/linear-skill-fetchTeamTriage.test.ts`
Expected: `fetchTeamTriage is not a function`.

- [ ] **Step 3: Implement `fetchTeamTriage` in the skill client**

In `.agents/skills/linear/reference/linear.mjs`, immediately above the `return {...}` block (currently at line 575), add:

```js
async function fetchTeamTriage() {
  const data = await linearRequest(`
    query($teamKey: String!) {
      issues(
        first: 250,
        filter: {
          team: { key: { eq: $teamKey } }
          state: { type: { eq: "triage" } }
        }
      ) {
        nodes {
          id identifier title description
          state { name type }
          priority
          labels { nodes { name } }
          url updatedAt
          assignee { id }
        }
      }
    }
  `, { teamKey });
  return data.issues.nodes;
}
```

And include it in the `return {...}` block (currently lines 575-595):

```js
return {
  // ... existing entries ...
  fetchAssignedIssues,
  fetchTeamTriage,
};
```

- [ ] **Step 4: Re-run test — expect PASS**

Run: `npm test -- tests/main/linear-skill-fetchTeamTriage.test.ts`
Expected: PASS.

- [ ] **Step 5: Document in `SKILL.md`**

In `.agents/skills/linear/SKILL.md`, under the `### Reads` list, add a new bullet right after `fetchAssignedIssues`:

```markdown
- **`fetchTeamTriage()`** → `Array<{ id, identifier, title, description, state: { name, type }, priority, labels: { nodes: [{ name }] }, url, updatedAt, assignee: { id } | null }>` — every issue on the bound team whose state.type is `triage`. Returned items also include `assignee` so callers can render an "assigned to me" filter without a second query.
```

- [ ] **Step 6: Commit**

```bash
git add .agents/skills/linear tests/main/linear-skill-fetchTeamTriage.test.ts
git commit -m "feat(linear-skill): add fetchTeamTriage for team-wide triage queue"
```

---

## Task 5: `linear-service.fetchTriage`

**Files:**
- Modify: `src/main/services/linear-service.ts`
- Create: `tests/main/linear-service-fetchTriage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/main/linear-service-fetchTriage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fetchTriage, type RawLinearIssue } from '../../src/main/services/linear-service';

describe('fetchTriage', () => {
  it('maps raw triage issues to Issue and threads assigneeId', async () => {
    const raw: RawLinearIssue[] = [
      {
        id: 'i1',
        identifier: 'FUL-7',
        title: 't',
        description: null,
        state: { name: 'Triage', type: 'triage' },
        priority: 0,
        labels: { nodes: [] },
        url: '',
        updatedAt: '',
        assignee: { id: 'me' },
      },
    ];
    const client = {
      fetchTeamTriage: async () => raw,
    };

    const issues = await fetchTriage(client);

    expect(issues).toHaveLength(1);
    expect(issues[0].status).toBe('triage');
    expect(issues[0].assigneeId).toBe('me');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`fetchTriage is not exported`)

Run: `npm test -- tests/main/linear-service-fetchTriage.test.ts`

- [ ] **Step 3: Add `fetchTriage` to `linear-service.ts`**

Append to `src/main/services/linear-service.ts`:

```ts
interface LinearTriageClientShape {
  fetchTeamTriage(): Promise<RawLinearIssue[]>;
}

export async function fetchTriage(client: LinearTriageClientShape): Promise<Issue[]> {
  const raw = await client.fetchTeamTriage();
  return raw.map(mapIssue);
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/main/linear-service-fetchTriage.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/main/services/linear-service.ts tests/main/linear-service-fetchTriage.test.ts
git commit -m "feat(linear-service): expose fetchTriage that maps team-wide triage issues"
```

---

## Task 6: Add `computronRepoPath` to `AppConfig`

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/services/config-store.ts:7-12`
- Modify: `tests/main/ipc-config.test.ts` (if it asserts on `DEFAULTS`)

- [ ] **Step 1: Inspect `tests/main/ipc-config.test.ts` for any hard assertion on the defaults shape**

Run: `npm test -- tests/main/ipc-config.test.ts`
If it passes today, add a new test case below that asserts the default:

```ts
it('exposes computronRepoPath default as empty string', async () => {
  // arrange config store on a fresh temp path; then:
  const cfg = await store.get();
  expect(cfg.computronRepoPath).toBe('');
});
```

(If the existing structure of the test makes adding this difficult, instead add `expect((await store.get()).computronRepoPath).toBe('')` to whichever existing test reads `get()`.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/main/ipc-config.test.ts`
Expected: assertion failure (`undefined`) or TS error.

- [ ] **Step 3: Add field to type + defaults**

In `src/shared/types.ts`:

```ts
export interface AppConfig {
  linearTokenPath: string;
  linearTeamKey: string;
  repoPath: string;
  computronRepoPath: string;
  claudeModel: string;
}
```

In `src/main/services/config-store.ts`, update `DEFAULTS`:

```ts
const DEFAULTS: AppConfig = {
  linearTokenPath: join(homedir(), '.humanlayer', 'riptide', 'linear.json'),
  linearTeamKey: 'FUL',
  repoPath: '',
  computronRepoPath: '',
  claudeModel: 'claude-sonnet-4-6',
};
```

- [ ] **Step 4: Re-run config + typecheck**

Run: `npm run typecheck && npm test -- tests/main/ipc-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/main/services/config-store.ts tests/main/ipc-config.test.ts
git commit -m "feat(config): add computronRepoPath field with empty default"
```

---

## Task 7: Computron health check

**Files:**
- Create: `src/main/services/computron-checker.ts`
- Create: `tests/main/computron-checker.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkComputron } from '../../src/main/services/computron-checker';

let tempBase: string;

beforeEach(async () => {
  tempBase = await mkdtemp(join(tmpdir(), 'computron-checker-'));
});

afterEach(async () => {
  await rm(tempBase, { recursive: true, force: true });
});

describe('checkComputron', () => {
  it('returns false for empty path', async () => {
    expect(await checkComputron('')).toBe(false);
  });

  it('returns false when path does not exist', async () => {
    expect(await checkComputron(join(tempBase, 'missing'))).toBe(false);
  });

  it('returns false when path exists but has no .git directory', async () => {
    const path = join(tempBase, 'no-git');
    await mkdir(path);
    await writeFile(join(path, 'README.md'), 'hi');
    expect(await checkComputron(path)).toBe(false);
  });

  it('returns true when path is a git repo (has .git directory)', async () => {
    const path = join(tempBase, 'repo');
    await mkdir(path);
    await mkdir(join(path, '.git'));
    expect(await checkComputron(path)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect failure** (module not found)

Run: `npm test -- tests/main/computron-checker.test.ts`

- [ ] **Step 3: Implement the checker**

Create `src/main/services/computron-checker.ts`:

```ts
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkComputron(computronRepoPath: string): Promise<boolean> {
  if (!computronRepoPath) {
    return false;
  }
  try {
    const repoStat = await stat(computronRepoPath);
    if (!repoStat.isDirectory()) {
      return false;
    }
    const gitStat = await stat(join(computronRepoPath, '.git'));
    return gitStat.isDirectory();
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Re-run test — expect PASS**

Run: `npm test -- tests/main/computron-checker.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/main/services/computron-checker.ts tests/main/computron-checker.test.ts
git commit -m "feat(computron): add computron-checker for repo-path health"
```

---

## Task 8: Surface `computron` in `AuthStatus`

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/services/auth-checker.ts`
- Modify: `tests/main/auth-checker.test.ts`
- Modify: `src/main/ipc/auth.ts` (pass `computronRepoPath` to `checkAll`)

- [ ] **Step 1: Extend `AuthStatus` type**

In `src/shared/types.ts`:

```ts
export interface AuthStatus {
  linear: boolean;
  claudeCode: boolean;
  codex: boolean;
  computron: boolean;
}
```

- [ ] **Step 2: Update the test first**

In `tests/main/auth-checker.test.ts`, change the `checkAll` expectations:

```ts
const status = await checkAll({
  linearTokenPath: '/tmp/linear.json',
  linearClient,
  computronRepoPath: '/tmp/computron',
});

// expect(status).toEqual({ linear: true, claudeCode: true, codex: false, computron: false });
```

And in the second test (`returns linear false when token exists but viewer call fails`), pass the extra arg too.

Also add a focused case:

```ts
it('returns computron true when path has .git', async () => {
  const linearClient = createLinearClient(true);
  tryExecMock
    .mockResolvedValueOnce({ ok: true, value: { stdout: '', stderr: '' } })
    .mockResolvedValueOnce({ ok: true, value: { stdout: '', stderr: '' } });

  // Use a real temp dir for this case
  const { mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'auth-checker-comp-'));
  mkdirSync(join(dir, '.git'));

  const status = await checkAll({
    linearTokenPath: '/tmp/linear.json',
    linearClient,
    computronRepoPath: dir,
  });
  expect(status.computron).toBe(true);
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npm test -- tests/main/auth-checker.test.ts`
Expected: TS error (`computronRepoPath` not in opts) and assertion failures.

- [ ] **Step 4: Update `auth-checker.ts`**

```ts
import { checkComputron } from './computron-checker';
// ...
export async function checkAll(opts: {
  linearTokenPath: string;
  linearClient: LinearAuthClient;
  computronRepoPath: string;
}): Promise<AuthStatus> {
  const [linear, claudeCode, codex, computron] = await Promise.all([
    checkLinearApi(opts.linearClient, opts.linearTokenPath),
    checkCli('claude auth status'),
    checkCli('codex login status'),
    checkComputron(opts.computronRepoPath),
  ]);
  return { linear, claudeCode, codex, computron };
}
```

- [ ] **Step 5: Update the IPC auth caller**

In `src/main/ipc/auth.ts` (and the call site in `src/main/ipc/register.ts:70` if relevant — read the file first), ensure `checkAll` receives `computronRepoPath: cfg.computronRepoPath`. Show the change:

```ts
const status = await deps.checkAll({
  linearTokenPath: cfg.linearTokenPath,
  linearClient: deps.linearClient,
  computronRepoPath: cfg.computronRepoPath,
});
```

(Read `src/main/ipc/auth.ts` first and apply the same pattern it already uses for `linearTokenPath`.)

- [ ] **Step 6: Re-run tests + typecheck**

Run: `npm run typecheck && npm test -- tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts`
Expected: PASS. If `tests/main/ipc-auth.test.ts` builds an expected payload that didn't include `computron`, add `computron: false` there.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/main/services/auth-checker.ts src/main/ipc/auth.ts src/main/ipc/register.ts tests/main
git commit -m "feat(auth): include computron health in AuthStatus"
```

---

## Task 9: Refactor `spec-generator.ts` — extract `streamClaude(extraArgs)`

**Files:**
- Modify: `src/main/services/spec-generator.ts`
- Modify: `tests/main/spec-generator.test.ts`

`streamSpec` becomes a thin wrapper that calls `streamClaude` with `extraArgs: []`. Behaviour identical for existing callers.

- [ ] **Step 1: Add a failing test for the new entrypoint**

In `tests/main/spec-generator.test.ts`, append a new `describe`:

```ts
import { streamClaude } from '../../src/main/services/spec-generator';

describe('streamClaude', () => {
  it('appends extraArgs after the fixed args and before --output-format', async () => {
    const { calls, spawnProcess } = createFakeSpawn((child) => {
      child.stdout.write('ok');
      child.emit('close', 0);
    });

    await streamClaude({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      extraArgs: ['--add-dir', '/tmp/repo', '--allowedTools', 'Read,Glob,Grep'],
      onChunk: () => undefined,
      spawnProcess,
    });

    expect(calls[0].args).toEqual([
      '-p',
      '--model',
      'claude-sonnet-4-6',
      '--append-system-prompt',
      'sys',
      '--add-dir',
      '/tmp/repo',
      '--allowedTools',
      'Read,Glob,Grep',
      '--output-format',
      'text',
    ]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`streamClaude` not exported)

Run: `npm test -- tests/main/spec-generator.test.ts`

- [ ] **Step 3: Refactor**

In `src/main/services/spec-generator.ts`, restructure so the inner function takes extra args and `streamSpec` delegates with `extraArgs: []`:

```ts
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';

const CLAUDE_SPEC_TIMEOUT_MS = 120_000;

export interface StreamSpecInput {
  model: string;
  system: string;
  user: string;
  onChunk: (delta: string) => void;
  spawnProcess?: SpawnProcess;
}

export interface StreamClaudeInput extends StreamSpecInput {
  extraArgs?: readonly string[];
}

type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

function buildClaudeArgs(input: StreamClaudeInput): string[] {
  return [
    '-p',
    '--model',
    input.model,
    '--append-system-prompt',
    input.system,
    ...(input.extraArgs ?? []),
    '--output-format',
    'text',
  ];
}

function toCliError(code: number | null, stderr: string): Error {
  const exitCode = code === null ? 'unknown' : String(code);
  const trimmedStderr = stderr.trim();
  if (!trimmedStderr) {
    return new Error(`Claude CLI exited with code ${exitCode}.`);
  }
  return new Error(`Claude CLI exited with code ${exitCode}: ${trimmedStderr}`);
}

export async function streamClaude(input: StreamClaudeInput): Promise<string> {
  const spawnProcess = input.spawnProcess ?? spawn;
  const claude = spawnProcess('claude', buildClaudeArgs(input), {
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  claude.stdin.end(input.user);

  return new Promise<string>((resolve, reject) => {
    let full = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      claude.kill();
      reject(new Error(`Claude CLI timed out after ${CLAUDE_SPEC_TIMEOUT_MS / 1000}s.`));
    }, CLAUDE_SPEC_TIMEOUT_MS);

    const finish = (done: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      done();
    };

    claude.stdout.on('data', (chunk: Buffer | string) => {
      const delta = chunk.toString();
      if (!delta) return;
      full += delta;
      input.onChunk(delta);
    });

    claude.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    claude.on('error', (error) => {
      finish(() => reject(error));
    });

    claude.on('close', (code) => {
      if (code === 0) {
        finish(() => resolve(full));
        return;
      }
      finish(() => reject(toCliError(code, stderr)));
    });
  });
}

export async function streamSpec(input: StreamSpecInput): Promise<string> {
  return streamClaude({ ...input, extraArgs: [] });
}
```

- [ ] **Step 4: Re-run the spec-generator test file**

Run: `npm test -- tests/main/spec-generator.test.ts`
Expected: existing `streamSpec` test + new `streamClaude` test both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/spec-generator.ts tests/main/spec-generator.test.ts
git commit -m "refactor(spec-generator): extract streamClaude with extraArgs support"
```

---

## Task 10: `triage-prompt` module

**Files:**
- Create: `src/main/services/triage-prompt.ts`
- Create: `tests/main/triage-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildTriagePrompt } from '../../src/main/services/triage-prompt';
import type { Issue } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-77',
  title: 'job runner stuck',
  description: 'Customer reports the job runner stops at 30%.',
  status: 'triage',
  priority: 'high',
  labels: ['support'],
  url: 'https://linear.app/foo/FUL-77',
  updatedAt: '',
  isBug: true,
  assigneeId: null,
};

describe('buildTriagePrompt', () => {
  it('returns a system prompt that names the four output sections', () => {
    const { system } = buildTriagePrompt({ issue });
    expect(system).toMatch(/What the user likely wants/);
    expect(system).toMatch(/Likely affected components/);
    expect(system).toMatch(/Open questions for reporter/);
    expect(system).toMatch(/Suggested next step/);
  });

  it('reminds the model that cwd is the computron repo and tools are read-only', () => {
    const { system } = buildTriagePrompt({ issue });
    expect(system).toMatch(/--add-dir/);
    expect(system).toMatch(/Glob/);
    expect(system).toMatch(/Grep/);
    expect(system).toMatch(/Read/);
  });

  it('embeds issue identifier, title, priority, labels, and description in the user prompt', () => {
    const { user } = buildTriagePrompt({ issue });
    expect(user).toContain('FUL-77');
    expect(user).toContain('job runner stuck');
    expect(user).toContain('high');
    expect(user).toContain('support');
    expect(user).toContain('stops at 30%');
  });

  it('explicitly tells the model the cwd is the computron repo root', () => {
    const { user } = buildTriagePrompt({ issue });
    expect(user).toMatch(/cwd.*computron/i);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/main/triage-prompt.test.ts`

- [ ] **Step 3: Implement the module**

Create `src/main/services/triage-prompt.ts`:

```ts
import type { Issue } from '../../shared/types';

const SYSTEM = `You are reviewing an unrefined Linear triage issue. Your goal is to produce a short engineering brief that helps a human reviewer decide what to do with this ticket.

You have read-only access to the team's main codebase at the current working directory (mounted via --add-dir). Use Glob and Grep to locate code likely relevant to the issue. Use Read sparingly — only on files that look directly related. As a recommendation, cap yourself at roughly 6 tool calls; it's a soft hint, not a hard limit.

Output sections, in this exact order:

1. **What the user likely wants** — 1–3 sentences, plain language.
2. **Likely affected components** — bullet list of file paths or modules in the computron repo, one-line reason each.
3. **Open questions for reporter** — bullet list of things ambiguous in the issue.
4. **Suggested next step** — one of: "Needs reproduction", "Needs spec", "Probable duplicate of <X>", "Ready for spec", "Out of scope" — plus one sentence why.

Return only the markdown brief. No preamble, no postscript, no code fences wrapping the whole output.`;

export function buildTriagePrompt(input: { issue: Issue }): { system: string; user: string } {
  const { issue } = input;

  const user = [
    'Your current working directory is the root of the computron repository.',
    'Use Glob/Grep/Read to ground your suggestions in the actual code.',
    '',
    `## Issue: ${issue.id} — ${issue.title}`,
    `Priority: ${issue.priority}  Labels: ${issue.labels.join(', ') || '(none)'}`,
    '',
    issue.description || '(no description provided)',
  ].join('\n');

  return { system: SYSTEM, user };
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/main/triage-prompt.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/main/services/triage-prompt.ts tests/main/triage-prompt.test.ts
git commit -m "feat(triage): add triage-prompt builder for engineering brief"
```

---

## Task 11: `triage-generator` service

**Files:**
- Create: `src/main/services/triage-generator.ts`
- Create: `tests/main/triage-generator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { streamTriageBrief } from '../../src/main/services/triage-generator';
import type { Issue } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-77',
  title: 'x',
  description: 'y',
  status: 'triage',
  priority: 'medium',
  labels: [],
  url: '',
  updatedAt: '',
  isBug: false,
  assigneeId: null,
};

describe('streamTriageBrief', () => {
  it('calls streamClaude with --add-dir <computronRepoPath> and Read/Glob/Grep tools', async () => {
    const stream = vi.fn().mockResolvedValue('# brief');
    const chunks: string[] = [];

    const out = await streamTriageBrief({
      issue,
      computronRepoPath: '/tmp/computron',
      model: 'claude-sonnet-4-6',
      onChunk: (c) => chunks.push(c),
      streamClaude: stream,
    });

    expect(out).toBe('# brief');
    expect(stream).toHaveBeenCalledTimes(1);
    const arg = stream.mock.calls[0][0];
    expect(arg.model).toBe('claude-sonnet-4-6');
    expect(arg.extraArgs).toEqual([
      '--add-dir',
      '/tmp/computron',
      '--allowedTools',
      'Read,Glob,Grep',
    ]);
    expect(typeof arg.system).toBe('string');
    expect(arg.user).toContain('FUL-77');
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/main/triage-generator.test.ts`

- [ ] **Step 3: Implement**

Create `src/main/services/triage-generator.ts`:

```ts
import type { Issue } from '../../shared/types';
import { buildTriagePrompt } from './triage-prompt';

export interface StreamTriageBriefInput {
  issue: Issue;
  computronRepoPath: string;
  model: string;
  onChunk: (delta: string) => void;
  streamClaude: (input: {
    model: string;
    system: string;
    user: string;
    extraArgs: readonly string[];
    onChunk: (delta: string) => void;
  }) => Promise<string>;
}

export async function streamTriageBrief(input: StreamTriageBriefInput): Promise<string> {
  const { system, user } = buildTriagePrompt({ issue: input.issue });
  return input.streamClaude({
    model: input.model,
    system,
    user,
    extraArgs: ['--add-dir', input.computronRepoPath, '--allowedTools', 'Read,Glob,Grep'],
    onChunk: input.onChunk,
  });
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/main/triage-generator.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/main/services/triage-generator.ts tests/main/triage-generator.test.ts
git commit -m "feat(triage): add triage-generator wired to streamClaude with file-tools"
```

---

## Task 12: `triage-writer` service

**Files:**
- Create: `src/main/services/triage-writer.ts`
- Create: `tests/main/triage-writer.test.ts`

Per spec: writes only on explicit user action. Per resolved decisions: must signal "already exists" so renderer can prompt before overwriting. We expose `writeTriageBrief` with a `mode: 'create' | 'overwrite'` flag; if `mode === 'create'` and the file exists, return `{ written: false, exists: true, path }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeTriageBrief } from '../../src/main/services/triage-writer';

let tempBase: string;

beforeEach(async () => {
  tempBase = await mkdtemp(join(tmpdir(), 'triage-writer-'));
});

afterEach(async () => {
  await rm(tempBase, { recursive: true, force: true });
});

describe('writeTriageBrief', () => {
  it('writes to thoughts/tasks/<issueId>/triage-brief.md in create mode when file does not exist', async () => {
    const result = await writeTriageBrief({
      repoPath: tempBase,
      issueId: 'FUL-9',
      content: '# brief',
      mode: 'create',
    });

    expect(result.written).toBe(true);
    expect(result.exists).toBe(false);
    expect(result.path).toContain(join('thoughts', 'tasks', 'FUL-9', 'triage-brief.md'));
    const onDisk = await readFile(result.path, 'utf-8');
    expect(onDisk).toBe('# brief');
  });

  it('refuses to overwrite in create mode and reports exists=true', async () => {
    const dir = join(tempBase, 'thoughts', 'tasks', 'FUL-9');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'triage-brief.md'), 'old', 'utf-8');

    const result = await writeTriageBrief({
      repoPath: tempBase,
      issueId: 'FUL-9',
      content: 'new',
      mode: 'create',
    });

    expect(result.written).toBe(false);
    expect(result.exists).toBe(true);
    const onDisk = await readFile(result.path, 'utf-8');
    expect(onDisk).toBe('old');
  });

  it('overwrites when mode is overwrite', async () => {
    const dir = join(tempBase, 'thoughts', 'tasks', 'FUL-9');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'triage-brief.md'), 'old', 'utf-8');

    const result = await writeTriageBrief({
      repoPath: tempBase,
      issueId: 'FUL-9',
      content: 'new',
      mode: 'overwrite',
    });

    expect(result.written).toBe(true);
    expect(result.exists).toBe(true);
    const onDisk = await readFile(result.path, 'utf-8');
    expect(onDisk).toBe('new');
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/main/triage-writer.test.ts`

- [ ] **Step 3: Implement**

Create `src/main/services/triage-writer.ts`:

```ts
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface WriteTriageBriefInput {
  repoPath: string;
  issueId: string;
  content: string;
  mode: 'create' | 'overwrite';
}

export interface WriteTriageBriefResult {
  path: string;
  written: boolean;
  exists: boolean;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

export async function writeTriageBrief(
  opts: WriteTriageBriefInput,
): Promise<WriteTriageBriefResult> {
  const dir = join(opts.repoPath, 'thoughts', 'tasks', opts.issueId);
  const target = join(dir, 'triage-brief.md');
  const exists = await fileExists(target);

  if (exists && opts.mode === 'create') {
    return { path: target, written: false, exists: true };
  }

  await mkdir(dir, { recursive: true });
  await writeFile(target, opts.content, 'utf-8');
  return { path: target, written: true, exists };
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/main/triage-writer.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/main/services/triage-writer.ts tests/main/triage-writer.test.ts
git commit -m "feat(triage): add triage-writer with overwrite-aware create/overwrite modes"
```

---

## Task 13: IPC channel constants

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/shared/types.ts` (event payload types)
- Modify: `tests/shared/ipc-channels.test.ts`

- [ ] **Step 1: Update the channel-constants test**

In `tests/shared/ipc-channels.test.ts`, add expectations for the new channels:

```ts
it('exposes triage and team-triage channel names', () => {
  expect(IpcChannel.LinearFetchTeamTriage).toBe('linear:fetch-team-triage');
  expect(IpcChannel.LinearGetViewerId).toBe('linear:get-viewer-id');
  expect(IpcChannel.TriageGenerate).toBe('triage:generate');
  expect(IpcChannel.TriageStreamChunk).toBe('triage:stream-chunk');
  expect(IpcChannel.TriageGenerateDone).toBe('triage:generate-done');
  expect(IpcChannel.TriageGenerateError).toBe('triage:generate-error');
  expect(IpcChannel.TriageWrite).toBe('triage:write');
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/shared/ipc-channels.test.ts`

- [ ] **Step 3: Add channels**

In `src/shared/ipc-channels.ts`:

```ts
export const IpcChannel = {
  AuthCheck: 'auth:check',
  LinearFetchIssues: 'linear:fetch-issues',
  LinearFetchIssueDetail: 'linear:fetch-issue-detail',
  LinearFetchTeamTriage: 'linear:fetch-team-triage',
  LinearGetViewerId: 'linear:get-viewer-id',
  LinearRefresh: 'linear:refresh',
  SpecGenerate: 'spec:generate',
  SpecLaunchReview: 'spec:launch-review',
  SpecStreamChunk: 'spec:stream-chunk',
  SpecGenerateDone: 'spec:generate-done',
  SpecGenerateError: 'spec:generate-error',
  SpecGet: 'spec:get',
  SpecWrite: 'spec:write',
  TriageGenerate: 'triage:generate',
  TriageStreamChunk: 'triage:stream-chunk',
  TriageGenerateDone: 'triage:generate-done',
  TriageGenerateError: 'triage:generate-error',
  TriageWrite: 'triage:write',
  ConfigGet: 'config:get',
  ConfigSet: 'config:set',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];
```

- [ ] **Step 4: Add payload types in `src/shared/types.ts`**

Append:

```ts
export interface TriageStreamChunk {
  issueId: string;
  delta: string;
  done: boolean;
}

export interface TriageGenerateDone {
  issueId: string;
}

export interface TriageGenerateError {
  issueId: string;
  message: string;
}

export interface TriageBrief {
  issueId: string;
  content: string;
  generatedAt: string;
}

export interface TriageWriteResult {
  issueId: string;
  path: string;
  written: boolean;
  exists: boolean;
}
```

- [ ] **Step 5: Re-run + typecheck**

Run: `npm run typecheck && npm test -- tests/shared/ipc-channels.test.ts tests/shared/types.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared tests/shared
git commit -m "feat(ipc): add triage + team-triage channel constants and payload types"
```

---

## Task 14: IPC — `linear:fetchTeamTriage` and `linear:getViewerId`

**Files:**
- Modify: `src/main/ipc/linear.ts`
- Modify: `tests/main/ipc-linear.test.ts`

The handler should call into the Linear skill client, map results through `linear-service.fetchTriage`, and cache nothing (these are pull-on-demand). For `getViewerId`, cache the result for the session.

- [ ] **Step 1: Extend `tests/main/ipc-linear.test.ts`**

Read the existing test first to match its mock pattern, then add:

```ts
it('registers a fetch-team-triage handler that returns mapped triage issues', async () => {
  const triage = [/* mapped Issue[] fixture with status='triage' */];
  const fetchTriage = vi.fn().mockResolvedValue(triage);
  // ...register handlers with this dep...

  const result = await invokeHandler(IpcChannel.LinearFetchTeamTriage, {});

  expect(fetchTriage).toHaveBeenCalledOnce();
  expect(result).toEqual(triage);
});

it('caches viewer id across calls', async () => {
  const getCurrentUser = vi.fn().mockResolvedValue({ id: 'u42', name: 'Alvaro', email: '' });
  // ...register handlers with deps={ client: { getCurrentUser } }...

  const first = await invokeHandler(IpcChannel.LinearGetViewerId, {});
  const second = await invokeHandler(IpcChannel.LinearGetViewerId, {});

  expect(first).toBe('u42');
  expect(second).toBe('u42');
  expect(getCurrentUser).toHaveBeenCalledOnce();
});
```

(Adapt to the actual harness used in the existing file.)

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/main/ipc-linear.test.ts`

- [ ] **Step 3: Update `src/main/ipc/linear.ts`**

```ts
import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import type { IssuesCache } from '../services/issues-cache';
import type { Issue } from '../../shared/types';

export interface LinearDeps {
  cache: IssuesCache;
  fetchIssues: (client: unknown) => Promise<Issue[]>;
  fetchIssueDetail: (client: unknown, issueId: string) => Promise<Issue | null>;
  fetchTriage: (client: unknown) => Promise<Issue[]>;
  getViewerId: (client: unknown) => Promise<string>;
  client: unknown;
}

export function registerLinearHandlers(ipc: IpcMain, deps: LinearDeps): void {
  let cachedViewerId: string | null = null;

  ipc.handle(IpcChannel.LinearFetchIssues, async () => deps.cache.read());
  ipc.handle(IpcChannel.LinearFetchIssueDetail, async (_event, payload: { issueId: string }) =>
    deps.fetchIssueDetail(deps.client, payload.issueId),
  );
  ipc.handle(IpcChannel.LinearFetchTeamTriage, async () => deps.fetchTriage(deps.client));
  ipc.handle(IpcChannel.LinearGetViewerId, async () => {
    if (cachedViewerId) {
      return cachedViewerId;
    }
    cachedViewerId = await deps.getViewerId(deps.client);
    return cachedViewerId;
  });
  ipc.handle(IpcChannel.LinearRefresh, async () => {
    const issues = await deps.fetchIssues(deps.client);
    await deps.cache.write(issues);
    return issues;
  });
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/main/ipc-linear.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/linear.ts tests/main/ipc-linear.test.ts
git commit -m "feat(ipc): handlers for fetchTeamTriage and getViewerId (cached)"
```

---

## Task 15: IPC — `triage:generate` and `triage:write`

**Files:**
- Create: `src/main/ipc/triage.ts`
- Create: `tests/main/ipc-triage.test.ts`

Stream behaviour mirrors `spec:generate`. Write returns `{ written, exists }` so the renderer can prompt on overwrite.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  registerTriageGenerateHandler,
  registerTriageWriteHandler,
} from '../../src/main/ipc/triage';
import { IpcChannel } from '../../src/shared/ipc-channels';
import type { Issue } from '../../src/shared/types';

function fakeIpc() {
  const handlers = new Map<string, (event: unknown, payload: unknown) => unknown>();
  return {
    handle: (channel: string, fn: (event: unknown, payload: unknown) => unknown) => {
      handlers.set(channel, fn);
    },
    invoke: (channel: string, event: unknown, payload: unknown) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error(`no handler for ${channel}`);
      return fn(event, payload);
    },
  };
}

function fakeEvent() {
  const sent: Array<{ channel: string; payload: unknown }> = [];
  return {
    sender: {
      send: (channel: string, payload: unknown) => {
        sent.push({ channel, payload });
      },
    },
    sent,
  };
}

const triageIssue: Issue = {
  id: 'FUL-77',
  title: 't',
  description: 'd',
  status: 'triage',
  priority: 'medium',
  labels: [],
  url: '',
  updatedAt: '',
  isBug: false,
  assigneeId: null,
};

describe('triage:generate handler', () => {
  it('streams chunks then a done event and returns the full content', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerTriageGenerateHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath: '',
          computronRepoPath: '/tmp/computron',
          claudeModel: 'claude-sonnet-4-6',
        }),
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      streamTriageBrief: async ({ onChunk }) => {
        onChunk('part 1 ');
        onChunk('part 2');
        return 'part 1 part 2';
      },
    });

    const result = await ipc.invoke(
      IpcChannel.TriageGenerate,
      event,
      { issueId: 'FUL-77', model: 'claude-sonnet-4-6' },
    );

    expect(result).toEqual({ issueId: 'FUL-77', content: 'part 1 part 2' });
    const chunkSends = event.sent.filter((s) => s.channel === IpcChannel.TriageStreamChunk);
    expect(chunkSends).toHaveLength(3); // 2 deltas + 1 final done
    expect(chunkSends[2].payload).toMatchObject({ issueId: 'FUL-77', delta: '', done: true });
    expect(event.sent.some((s) => s.channel === IpcChannel.TriageGenerateDone)).toBe(true);
  });

  it('emits an error event when computronRepoPath is empty', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerTriageGenerateHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath: '',
          computronRepoPath: '',
          claudeModel: 'claude-sonnet-4-6',
        }),
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      streamTriageBrief: vi.fn(),
    });

    await expect(
      ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' }),
    ).rejects.toThrow(/computronRepoPath/);
    expect(event.sent.some((s) => s.channel === IpcChannel.TriageGenerateError)).toBe(true);
  });
});

describe('triage:write handler', () => {
  it('passes through to writeTriageBrief in create mode by default', async () => {
    const ipc = fakeIpc();
    const writeTriageBrief = vi.fn().mockResolvedValue({
      path: '/tmp/forge/thoughts/tasks/FUL-77/triage-brief.md',
      written: true,
      exists: false,
    });

    registerTriageWriteHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath: '/tmp/forge',
          computronRepoPath: '',
          claudeModel: '',
        }),
        set: async () => undefined,
      } as never,
      writeTriageBrief,
    });

    const result = await ipc.invoke(IpcChannel.TriageWrite, {}, {
      issueId: 'FUL-77',
      content: '# brief',
    });

    expect(writeTriageBrief).toHaveBeenCalledWith({
      repoPath: '/tmp/forge',
      issueId: 'FUL-77',
      content: '# brief',
      mode: 'create',
    });
    expect(result).toEqual({
      issueId: 'FUL-77',
      path: '/tmp/forge/thoughts/tasks/FUL-77/triage-brief.md',
      written: true,
      exists: false,
    });
  });

  it('uses overwrite mode when payload.overwrite=true', async () => {
    const ipc = fakeIpc();
    const writeTriageBrief = vi.fn().mockResolvedValue({
      path: '/tmp/forge/thoughts/tasks/FUL-77/triage-brief.md',
      written: true,
      exists: true,
    });

    registerTriageWriteHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath: '/tmp/forge',
          computronRepoPath: '',
          claudeModel: '',
        }),
        set: async () => undefined,
      } as never,
      writeTriageBrief,
    });

    await ipc.invoke(IpcChannel.TriageWrite, {}, {
      issueId: 'FUL-77',
      content: '# brief',
      overwrite: true,
    });

    expect(writeTriageBrief).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'overwrite' }),
    );
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/main/ipc-triage.test.ts`

- [ ] **Step 3: Implement the handlers**

Create `src/main/ipc/triage.ts`:

```ts
import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import { assertSafeIssueId, isSafeIssueId } from '../lib/issue-id';
import type { ConfigStore } from '../services/config-store';
import type { Issue, TriageWriteResult } from '../../shared/types';

interface TriageGenerateEventSender {
  send: (channel: string, payload: unknown) => void;
}

interface TriageGenerateEvent {
  sender: TriageGenerateEventSender;
}

type StreamTriageBrief = (input: {
  issue: Issue;
  computronRepoPath: string;
  model: string;
  onChunk: (delta: string) => void;
}) => Promise<string>;

export interface TriageGenerateDeps {
  store: ConfigStore;
  fetchTriageList: () => Promise<Issue[]>;
  streamTriageBrief: StreamTriageBrief;
}

export interface TriageWriteDeps {
  store: ConfigStore;
  writeTriageBrief: (input: {
    repoPath: string;
    issueId: string;
    content: string;
    mode: 'create' | 'overwrite';
  }) => Promise<Omit<TriageWriteResult, 'issueId'>>;
}

function findTriageIssue(issues: Issue[], issueId: string): Issue {
  if (!isSafeIssueId(issueId)) {
    throw new Error(`Triage issue not found: ${issueId}`);
  }
  const found = issues.find((i) => i.id === issueId);
  if (!found) {
    throw new Error(`Triage issue not found: ${issueId}`);
  }
  return found;
}

function sendTriageChunk(
  sender: TriageGenerateEventSender,
  issueId: string,
  delta: string,
  done: boolean,
): void {
  sender.send(IpcChannel.TriageStreamChunk, { issueId, delta, done });
}

export function registerTriageGenerateHandler(ipc: IpcMain, deps: TriageGenerateDeps): void {
  ipc.handle(
    IpcChannel.TriageGenerate,
    async (event: TriageGenerateEvent, payload: { issueId: string; model?: string }) => {
      try {
        const cfg = await deps.store.get();
        if (!cfg.computronRepoPath) {
          throw new Error('computronRepoPath is not configured');
        }
        const issues = await deps.fetchTriageList();
        const issue = findTriageIssue(issues, payload.issueId);
        const model = payload.model?.trim() || cfg.claudeModel;
        const content = await deps.streamTriageBrief({
          issue,
          computronRepoPath: cfg.computronRepoPath,
          model,
          onChunk: (delta) => sendTriageChunk(event.sender, payload.issueId, delta, false),
        });
        sendTriageChunk(event.sender, payload.issueId, '', true);
        event.sender.send(IpcChannel.TriageGenerateDone, { issueId: payload.issueId });
        return { content, issueId: payload.issueId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        event.sender.send(IpcChannel.TriageGenerateError, { issueId: payload.issueId, message });
        throw error;
      }
    },
  );
}

export function registerTriageWriteHandler(ipc: IpcMain, deps: TriageWriteDeps): void {
  ipc.handle(
    IpcChannel.TriageWrite,
    async (_event, payload: { issueId: string; content: string; overwrite?: boolean }) => {
      assertSafeIssueId(payload.issueId);
      const cfg = await deps.store.get();
      const result = await deps.writeTriageBrief({
        repoPath: cfg.repoPath,
        issueId: payload.issueId,
        content: payload.content,
        mode: payload.overwrite ? 'overwrite' : 'create',
      });
      return { issueId: payload.issueId, ...result };
    },
  );
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/main/ipc-triage.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/triage.ts tests/main/ipc-triage.test.ts
git commit -m "feat(ipc): triage:generate (streaming) + triage:write (create|overwrite)"
```

---

## Task 16: Preload + `ForgeApi` types

**Files:**
- Modify: `src/main/preload.ts`
- Modify: `src/shared/forge-api.ts`
- Modify: `tests/main/preload.test.ts`

- [ ] **Step 1: Update test to expect new methods**

In `tests/main/preload.test.ts`, add assertions that `window.forge.linear.fetchTeamTriage`, `window.forge.linear.getViewerId`, and `window.forge.triage.generate`/`write`/`onChunk`/`onDone`/`onError` are exposed and invoke the matching IPC channel.

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/main/preload.test.ts`

- [ ] **Step 3: Extend `forge-api.ts`**

```ts
export interface ForgeApi {
  auth: { check: () => Promise<AuthStatus> };
  linear: {
    fetch: () => Promise<Issue[]>;
    fetchIssueDetail: (issueId: string) => Promise<Issue | null>;
    refresh: () => Promise<Issue[]>;
    fetchTeamTriage: () => Promise<Issue[]>;
    getViewerId: () => Promise<string>;
  };
  spec: { /* unchanged */ };
  triage: {
    generate: (issueId: string, model?: string) => Promise<{ issueId: string; content: string }>;
    write: (
      issueId: string,
      content: string,
      opts?: { overwrite?: boolean },
    ) => Promise<TriageWriteResult>;
    onChunk: (handler: (chunk: TriageStreamChunk) => void) => () => void;
    onDone: (handler: (payload: TriageGenerateDone) => void) => () => void;
    onError: (handler: (payload: TriageGenerateError) => void) => () => void;
  };
  config: { get: () => Promise<AppConfig>; set: (patch: Partial<AppConfig>) => Promise<void> };
}
```

(Import the new types from `./types`.)

- [ ] **Step 4: Wire in `preload.ts`**

Inside the `api` object:

```ts
linear: {
  fetch: () => ipcRenderer.invoke(IpcChannel.LinearFetchIssues),
  fetchIssueDetail: (issueId) =>
    ipcRenderer.invoke(IpcChannel.LinearFetchIssueDetail, { issueId }),
  refresh: () => ipcRenderer.invoke(IpcChannel.LinearRefresh),
  fetchTeamTriage: () => ipcRenderer.invoke(IpcChannel.LinearFetchTeamTriage),
  getViewerId: () => ipcRenderer.invoke(IpcChannel.LinearGetViewerId),
},
// ...
triage: {
  generate: (issueId, model) =>
    ipcRenderer.invoke(IpcChannel.TriageGenerate, { issueId, model }),
  write: (issueId, content, opts) =>
    ipcRenderer.invoke(IpcChannel.TriageWrite, {
      issueId,
      content,
      overwrite: opts?.overwrite ?? false,
    }),
  onChunk: (handler) => subscribe<TriageStreamChunk>(IpcChannel.TriageStreamChunk, handler),
  onDone: (handler) => subscribe<TriageGenerateDone>(IpcChannel.TriageGenerateDone, handler),
  onError: (handler) => subscribe<TriageGenerateError>(IpcChannel.TriageGenerateError, handler),
},
```

(Add the new type imports at the top.)

- [ ] **Step 5: Re-run + typecheck**

Run: `npm run typecheck && npm test -- tests/main/preload.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/shared/forge-api.ts src/main/preload.ts tests/main/preload.test.ts
git commit -m "feat(preload): expose linear.{fetchTeamTriage,getViewerId} and triage.*"
```

---

## Task 17: `use-issues` — merge team triage

**Files:**
- Modify: `src/renderer/hooks/use-issues.ts`
- Modify: `tests/renderer/use-issues.test.ts`

The hook also fetches team triage on mount and on refresh, then merges by id (assigned-or-team-triage). Duplicates: team-triage wins for `assigneeId`, since team query also covers assigned-and-triage cases.

- [ ] **Step 1: Update the test**

Adapt `tests/renderer/use-issues.test.ts` to mock `window.forge.linear.fetchTeamTriage` returning two triage issues (one unassigned, one assigned to viewer), assert that the merged `issues` array contains both, and that calling `refresh()` re-fetches both endpoints.

(Read the existing file first; mirror the pattern.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/renderer/use-issues.test.ts`

- [ ] **Step 3: Update the hook**

In `src/renderer/hooks/use-issues.ts`:

```ts
async function loadAll(): Promise<Issue[]> {
  const [assigned, triage] = await Promise.all([
    window.forge.linear.refresh(),
    window.forge.linear.fetchTeamTriage(),
  ]);
  const byId = new Map<string, Issue>();
  for (const issue of assigned) byId.set(issue.id, issue);
  for (const issue of triage) byId.set(issue.id, issue); // triage list authoritative for assignee
  return Array.from(byId.values());
}
```

Replace `window.forge.linear.refresh()` inside `refresh` with `loadAll()`. Inside `syncOnMount`, replace `window.forge.linear.fetch()` and the subsequent `refresh()` call with a single `loadAll()`.

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/renderer/use-issues.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-issues.ts tests/renderer/use-issues.test.ts
git commit -m "feat(use-issues): merge team triage with assigned issues"
```

---

## Task 18: `use-triage-stream` hook

**Files:**
- Create: `src/renderer/hooks/use-triage-stream.ts`
- Create: `tests/renderer/use-triage-stream.test.ts`

Functionally mirrors `use-spec-stream.ts`. Difference: no `get` step (no persisted-on-disk fetch on mount — briefs are ephemeral until written by user).

- [ ] **Step 1: Write the failing test**

Mirror `tests/renderer/use-spec-stream.test.ts`. Cover: (a) `generate()` accumulates `streaming` from `onChunk` deltas; (b) `onDone` flips `isStreaming` to false; (c) `onError` populates `errorMessage`; (d) when `issueId` changes, state resets and prior subscriptions are removed.

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/renderer/use-triage-stream.test.ts`

- [ ] **Step 3: Implement**

Create `src/renderer/hooks/use-triage-stream.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TriageBrief,
  TriageGenerateDone,
  TriageGenerateError,
  TriageStreamChunk,
} from '../../shared/types';

function toGeneratedBrief(issueId: string, content: string): TriageBrief {
  return { issueId, content, generatedAt: new Date().toISOString() };
}

export function useTriageStream(issueId: string | null) {
  const [brief, setBrief] = useState<TriageBrief | null>(null);
  const [streaming, setStreaming] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentIssueIdRef = useRef<string | null>(null);
  const setupVersionRef = useRef(0);

  const isCurrentRun = useCallback(
    (targetIssueId: string, setupVersion: number): boolean => {
      return currentIssueIdRef.current === targetIssueId && setupVersionRef.current === setupVersion;
    },
    [],
  );

  const reset = useCallback((): void => {
    setBrief(null);
    setStreaming('');
    setIsStreaming(false);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    setupVersionRef.current += 1;
    const setupVersion = setupVersionRef.current;
    currentIssueIdRef.current = issueId;

    if (!issueId) {
      reset();
      return;
    }

    reset();

    const onChunk = (chunk: TriageStreamChunk) => {
      if (chunk.issueId !== issueId) return;
      if (!isCurrentRun(issueId, setupVersion)) return;
      if (chunk.done) {
        setIsStreaming(false);
        return;
      }
      setStreaming((current) => current + chunk.delta);
    };

    const onDone = (_payload: TriageGenerateDone) => {
      if (!isCurrentRun(issueId, setupVersion)) return;
      setIsStreaming(false);
    };

    const onError = (payload: TriageGenerateError) => {
      if (payload.issueId !== issueId) return;
      if (!isCurrentRun(issueId, setupVersion)) return;
      setErrorMessage(payload.message);
      setIsStreaming(false);
    };

    const unsubChunk = window.forge.triage.onChunk(onChunk);
    const unsubDone = window.forge.triage.onDone(onDone);
    const unsubError = window.forge.triage.onError(onError);

    return () => {
      unsubChunk();
      unsubDone();
      unsubError();
      if (currentIssueIdRef.current === issueId) {
        currentIssueIdRef.current = null;
      }
    };
  }, [issueId, isCurrentRun, reset]);

  const generate = useCallback(async (model?: string): Promise<void> => {
    if (!issueId) return;
    const setupVersion = setupVersionRef.current;
    setStreaming('');
    setIsStreaming(true);
    setErrorMessage(null);
    try {
      const result = model
        ? await window.forge.triage.generate(issueId, model)
        : await window.forge.triage.generate(issueId);
      if (!isCurrentRun(issueId, setupVersion)) return;
      setBrief(toGeneratedBrief(issueId, result.content));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isCurrentRun(issueId, setupVersion)) {
        setErrorMessage(message);
        setIsStreaming(false);
      }
    } finally {
      if (isCurrentRun(issueId, setupVersion)) {
        setIsStreaming(false);
      }
    }
  }, [issueId, isCurrentRun]);

  return { brief, streaming, isStreaming, errorMessage, generate };
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/renderer/use-triage-stream.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-triage-stream.ts tests/renderer/use-triage-stream.test.ts
git commit -m "feat(use-triage-stream): renderer hook for triage brief streaming"
```

---

## Task 19: `TriageDrawer` component

**Files:**
- Create: `src/renderer/components/triage-drawer.tsx`
- Create: `tests/renderer/triage-drawer.test.tsx`

Simpler than `SpecDrawer`: header with issue id/title, "Generate brief" button (disabled until `auth.computron === true`), streaming/error/brief display, "Write to file" button. On write, if response says `exists && !written`, call `window.confirm('Overwrite existing triage-brief.md?')` and retry with `{ overwrite: true }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TriageDrawer } from '../../src/renderer/components/triage-drawer';
import type { Issue } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-77',
  title: 'job runner stuck',
  description: '',
  status: 'triage',
  priority: 'high',
  labels: [],
  url: '',
  updatedAt: '',
  isBug: false,
  assigneeId: null,
};

beforeEach(() => {
  Object.assign(window, {
    forge: {
      triage: {
        write: vi.fn(),
        onChunk: () => () => undefined,
        onDone: () => () => undefined,
        onError: () => () => undefined,
        generate: vi.fn(),
      },
    },
  });
});

afterEach(() => cleanup());

describe('TriageDrawer', () => {
  it('disables Generate brief when computron health is false', () => {
    render(
      <TriageDrawer
        issue={issue}
        canGenerate={false}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /generate brief/i });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('renders streamed content when streaming', () => {
    render(
      <TriageDrawer
        issue={issue}
        canGenerate={true}
        isStreaming={true}
        streaming="## Likely affected components"
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Likely affected components/)).toBeTruthy();
  });

  it('renders Write to file button only when brief is present', () => {
    const { rerender } = render(
      <TriageDrawer
        issue={issue}
        canGenerate
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /write to file/i })).toBeNull();

    rerender(
      <TriageDrawer
        issue={issue}
        canGenerate
        isStreaming={false}
        streaming=""
        brief={{ issueId: 'FUL-77', content: '# done', generatedAt: '' }}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /write to file/i })).toBeTruthy();
  });

  it('prompts before overwriting when the first write reports exists=true, written=false', async () => {
    const writeMock = vi.fn()
      .mockResolvedValueOnce({ issueId: 'FUL-77', path: '/x', written: false, exists: true })
      .mockResolvedValueOnce({ issueId: 'FUL-77', path: '/x', written: true, exists: true });
    (window as never as { forge: unknown }).forge = {
      triage: {
        write: writeMock,
        onChunk: () => () => undefined,
        onDone: () => () => undefined,
        onError: () => () => undefined,
        generate: vi.fn(),
      },
    };
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <TriageDrawer
        issue={issue}
        canGenerate
        isStreaming={false}
        streaming=""
        brief={{ issueId: 'FUL-77', content: '# done', generatedAt: '' }}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /write to file/i }));
    await Promise.resolve();
    await Promise.resolve();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(writeMock).toHaveBeenCalledTimes(2);
    expect(writeMock.mock.calls[1][2]).toEqual({ overwrite: true });
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- tests/renderer/triage-drawer.test.tsx`

- [ ] **Step 3: Implement the component**

Create `src/renderer/components/triage-drawer.tsx`:

```tsx
import type { Issue, TriageBrief } from '../../shared/types';

type TriageDrawerProps = {
  issue: Issue | null;
  canGenerate: boolean;
  isStreaming: boolean;
  streaming: string;
  brief: TriageBrief | null;
  errorMessage: string | null;
  onGenerate: () => void;
  onClose: () => void;
};

async function handleWriteClick(issueId: string, content: string): Promise<void> {
  const first = await window.forge.triage.write(issueId, content);
  if (first.written) return;
  if (first.exists) {
    const ok = window.confirm('Overwrite existing triage-brief.md?');
    if (!ok) return;
    await window.forge.triage.write(issueId, content, { overwrite: true });
  }
}

export function TriageDrawer({
  issue,
  canGenerate,
  isStreaming,
  streaming,
  brief,
  errorMessage,
  onGenerate,
  onClose,
}: TriageDrawerProps) {
  if (!issue) return null;
  const displayContent = brief?.content ?? streaming;

  return (
    <aside className="drawer">
      <header className="drawer-head">
        <h2>{issue.id} — {issue.title}</h2>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </header>
      <div className="drawer-body">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isStreaming}
        >
          {isStreaming ? 'Generating…' : 'Generate brief'}
        </button>
        {!canGenerate ? (
          <p className="hint">
            Set <code>computronRepoPath</code> in config (and ensure the path is a git repo)
            to enable brief generation.
          </p>
        ) : null}
        {errorMessage ? <pre className="error">{errorMessage}</pre> : null}
        {displayContent ? <pre className="brief">{displayContent}</pre> : null}
        {brief ? (
          <button
            type="button"
            onClick={() => void handleWriteClick(issue.id, brief.content)}
          >
            Write to file
          </button>
        ) : null}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/renderer/triage-drawer.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/triage-drawer.tsx tests/renderer/triage-drawer.test.tsx
git commit -m "feat(triage-drawer): renderer drawer with computron-gated brief actions"
```

---

## Task 20: `IssueListPanel` — Triage tab + Mine-only toggle

**Files:**
- Modify: `src/renderer/components/issue-list-panel.tsx`
- Modify: `tests/renderer/issue-list-panel.test.tsx`

Triage tab goes first in `TABS` but `Todo` remains the default in `app.tsx` (which sets state initial value). The toggle only appears when `tab === 'Triage'`.

- [ ] **Step 1: Add the failing tests**

Append to `tests/renderer/issue-list-panel.test.tsx`:

```tsx
it('renders the Triage tab first and counts triage issues correctly', () => {
  render(
    <IssueListPanel
      issues={[
        { ...issues[0], status: 'triage' },
        { ...issues[1], status: 'triage' },
        ...issues.slice(2),
      ]}
      tab="Triage"
      setTab={vi.fn()}
      onOpen={vi.fn()}
      activeId={null}
      hasSpecFor={vi.fn()}
      onRefresh={vi.fn()}
      mineOnly={false}
      onMineOnlyChange={vi.fn()}
      viewerId={null}
    />,
  );

  const tabButtons = screen.getAllByRole('button').filter((b) => b.classList.contains('tab'));
  expect(tabButtons[0].textContent).toMatch(/^Triage/);
  expect(getTabCount(/^Triage/i)).toBe(2);
});

it('shows the Mine-only toggle only when Triage tab is active', () => {
  const { rerender } = render(
    <IssueListPanel
      issues={[]}
      tab="Todo"
      setTab={vi.fn()}
      onOpen={vi.fn()}
      activeId={null}
      hasSpecFor={vi.fn()}
      onRefresh={vi.fn()}
      mineOnly={false}
      onMineOnlyChange={vi.fn()}
      viewerId="u1"
    />,
  );
  expect(screen.queryByLabelText(/mine only/i)).toBeNull();

  rerender(
    <IssueListPanel
      issues={[]}
      tab="Triage"
      setTab={vi.fn()}
      onOpen={vi.fn()}
      activeId={null}
      hasSpecFor={vi.fn()}
      onRefresh={vi.fn()}
      mineOnly={false}
      onMineOnlyChange={vi.fn()}
      viewerId="u1"
    />,
  );
  expect(screen.getByLabelText(/mine only/i)).toBeTruthy();
});

it('filters triage list by viewerId when mineOnly is on', () => {
  render(
    <IssueListPanel
      issues={[
        { ...issues[0], status: 'triage', assigneeId: 'u1' },
        { ...issues[1], status: 'triage', assigneeId: null },
      ]}
      tab="Triage"
      setTab={vi.fn()}
      onOpen={vi.fn()}
      activeId={null}
      hasSpecFor={vi.fn()}
      onRefresh={vi.fn()}
      mineOnly={true}
      onMineOnlyChange={vi.fn()}
      viewerId="u1"
    />,
  );

  const ids = screen.getAllByTestId('issue-id').map((n) => n.textContent);
  expect(ids).toEqual(['FUL-1']);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/renderer/issue-list-panel.test.tsx`

- [ ] **Step 3: Update `IssueListPanel`**

```tsx
import { classifyGroup, type Group } from '../lib/classify';
import type { Issue, IssueStatus } from '../../shared/types';

import { IconRefresh } from './icons';
import { IssueGroup } from './issue-group';
import { PillTab } from './pill-tab';

export type Tab = 'Triage' | 'Todo' | 'In Progress' | 'In Review' | 'Done';

const TABS: Tab[] = ['Triage', 'Todo', 'In Progress', 'In Review', 'Done'];

const TAB_KEY: Record<Tab, IssueStatus> = {
  Triage: 'triage',
  Todo: 'todo',
  'In Progress': 'in_progress',
  'In Review': 'in_review',
  Done: 'done',
};

const GROUP_ORDER: Group[] = ['Bugs', 'Urgent', 'Feature', 'Chore'];

type IssueListPanelProps = {
  issues: Issue[];
  tab: Tab;
  setTab: (next: Tab) => void;
  onOpen: (issue: Issue, which: 'spec' | 'detail') => void;
  activeId: string | null;
  hasSpecFor: (issueId: string) => boolean;
  onRefresh: () => void;
  mineOnly: boolean;
  onMineOnlyChange: (next: boolean) => void;
  viewerId: string | null;
};

function applyMineOnlyFilter(
  issues: Issue[],
  tab: Tab,
  mineOnly: boolean,
  viewerId: string | null,
): Issue[] {
  if (tab !== 'Triage' || !mineOnly || !viewerId) return issues;
  return issues.filter((issue) => issue.assigneeId === viewerId);
}

function counts(issues: Issue[]) {
  return TABS.reduce((memo, tab) => {
    memo[tab] = issues.filter((issue) => issue.status === TAB_KEY[tab]).length;
    return memo;
  }, {} as Record<Tab, number>);
}

function groupVisible(visibleIssues: Issue[]) {
  return GROUP_ORDER.map((groupName) => ({
    name: groupName,
    items: visibleIssues.filter((issue) => classifyGroup(issue) === groupName),
  })).filter((group) => group.items.length > 0);
}

export function IssueListPanel({
  issues,
  tab,
  setTab,
  onOpen,
  activeId,
  hasSpecFor,
  onRefresh,
  mineOnly,
  onMineOnlyChange,
  viewerId,
}: IssueListPanelProps) {
  const byTab = issues.filter((issue) => issue.status === TAB_KEY[tab]);
  const visibleIssues = applyMineOnlyFilter(byTab, tab, mineOnly, viewerId);
  const visibleGroups = groupVisible(visibleIssues);
  const issueCounts = counts(issues);

  return (
    <div className="panel-left">
      <div className="panel-left-head">
        <div className="tabs">
          {TABS.map((item) => (
            <PillTab
              key={item}
              active={tab === item}
              count={issueCounts[item]}
              onClick={() => setTab(item)}
            >
              {item}
            </PillTab>
          ))}
        </div>
        <div className="panel-left-tools">
          {tab === 'Triage' ? (
            <label className="mine-only">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => onMineOnlyChange(e.target.checked)}
              />
              <span>Mine only</span>
            </label>
          ) : null}
          <button
            className="icon-btn"
            type="button"
            aria-label="Refresh"
            title="Refresh"
            onClick={onRefresh}
          >
            <IconRefresh size={12} />
          </button>
        </div>
      </div>
      <div className="panel-left-body">
        {visibleGroups.length === 0 ? (
          <div className="empty">No issues in {tab.toLowerCase()}.</div>
        ) : (
          visibleGroups.map((group) => (
            <IssueGroup
              key={group.name}
              name={group.name}
              items={group.items}
              onOpen={onOpen}
              activeId={activeId}
              hasSpecFor={hasSpecFor}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update existing tests to pass the three new required props**

Every existing render in `tests/renderer/issue-list-panel.test.tsx` now needs `mineOnly={false}`, `onMineOnlyChange={vi.fn()}`, `viewerId={null}`. Add them.

- [ ] **Step 5: Re-run — expect PASS**

Run: `npm test -- tests/renderer/issue-list-panel.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/issue-list-panel.tsx tests/renderer/issue-list-panel.test.tsx
git commit -m "feat(issue-list): add Triage tab (first) + Mine-only toggle"
```

---

## Task 21: `app.tsx` — route triage issues to `TriageDrawer`

**Files:**
- Modify: `src/renderer/app.tsx`
- Modify: `tests/renderer/app.test.tsx`

Default tab on app open stays `Todo` — no change there. Add `mineOnly` state, `viewerId` state (lazy-fetched when Triage tab first opens), and `auth.computron` gating.

- [ ] **Step 1: Update `app.test.tsx`**

Add a test that, given an issue with `status: 'triage'`, opening its drawer renders `TriageDrawer` and not `SpecDrawer`. Read the existing test file's harness first, then mirror.

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/renderer/app.test.tsx`

- [ ] **Step 3: Update `app.tsx`**

Key additions, placed appropriately within the existing component:

```tsx
const [tab, setTab] = useState<Tab>('Todo'); // unchanged
const [mineOnly, setMineOnly] = useState(false);
const [viewerId, setViewerId] = useState<string | null>(null);

useEffect(() => {
  if (tab !== 'Triage' || viewerId !== null) return;
  let cancelled = false;
  void window.forge.linear
    .getViewerId()
    .then((id) => { if (!cancelled) setViewerId(id); })
    .catch(() => undefined);
  return () => { cancelled = true; };
}, [tab, viewerId]);
```

In the JSX, pass `mineOnly`, `setMineOnly`/`onMineOnlyChange`, `viewerId` to `<IssueListPanel />`.

Drawer routing — replace the single `<SpecDrawer />` block with a conditional:

```tsx
{drawer?.issue.status === 'triage' ? (
  <TriageDrawerContainer
    issue={drawer.issue}
    canGenerate={auth.computron}
    onClose={() => setDrawer(null)}
  />
) : (
  <SpecDrawer /* unchanged existing props */ />
)}
```

Where `TriageDrawerContainer` is a small wrapper defined in `app.tsx` that owns the `useTriageStream` hook and feeds the props into the presentation component. Define inline:

```tsx
function TriageDrawerContainer({
  issue,
  canGenerate,
  onClose,
}: {
  issue: Issue;
  canGenerate: boolean;
  onClose: () => void;
}) {
  const { brief, streaming, isStreaming, errorMessage, generate } = useTriageStream(issue.id);
  return (
    <TriageDrawer
      issue={issue}
      canGenerate={canGenerate}
      isStreaming={isStreaming}
      streaming={streaming}
      brief={brief}
      errorMessage={errorMessage}
      onGenerate={() => void generate()}
      onClose={onClose}
    />
  );
}
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `npm test -- tests/renderer/app.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/app.tsx tests/renderer/app.test.tsx
git commit -m "feat(app): route triage issues to TriageDrawer; lazy viewer-id; mine-only state"
```

---

## Task 22: Wire IPC registrations

**Files:**
- Modify: `src/main/ipc/register.ts`

Bring the new services into `registerAll`. This is the integration step.

- [ ] **Step 1: Update `register.ts`**

Add imports:

```ts
import { fetchTriage } from '../services/linear-service';
import { streamClaude } from '../services/spec-generator';
import { streamTriageBrief } from '../services/triage-generator';
import { writeTriageBrief } from '../services/triage-writer';
import { registerTriageGenerateHandler, registerTriageWriteHandler } from './triage';
```

Extend the `LinearClient` interface with the new operations:

```ts
interface LinearClient {
  getCurrentUser(): Promise<{ id: string; name: string; email: string }>;
  checkAuth(tokenPath?: string): Promise<boolean>;
  fetchAssignedIssues(assigneeId: string): Promise<RawLinearIssue[]>;
  fetchIssueDetail(identifier: string): Promise<RawLinearIssue | null>;
  fetchTeamTriage(): Promise<RawLinearIssue[]>;
}
```

In `registerLinearHandlers` deps, add:

```ts
fetchTriage: (linearClient) => fetchTriage(linearClient as LinearClient),
getViewerId: async (linearClient) => {
  const me = await (linearClient as LinearClient).getCurrentUser();
  return me.id;
},
```

After the existing spec handler registrations, add:

```ts
registerTriageGenerateHandler(ipc, {
  store,
  fetchTriageList: () => fetchTriage(client as LinearClient),
  streamTriageBrief: ({ issue, computronRepoPath, model, onChunk }) =>
    streamTriageBrief({
      issue,
      computronRepoPath,
      model,
      onChunk,
      streamClaude,
    }),
});
registerTriageWriteHandler(ipc, { store, writeTriageBrief });
```

- [ ] **Step 2: Typecheck + full test run**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/register.ts
git commit -m "feat(ipc-register): wire triage generate/write and team-triage handlers"
```

---

## Task 23: End-to-end verification

**Files:** none modified. Manual smoke + dev run.

- [ ] **Step 1: Full lint + typecheck + tests**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 2: Manual smoke — preconditions**

- Edit `~/Library/Application Support/forge/config.json` (path used by `configPath()`; verify in `src/main/lib/paths.ts` if you're unsure) and set:

```json
{
  "linearTeamKey": "FUL",
  "repoPath": "/absolute/path/to/forge",
  "computronRepoPath": "/absolute/path/to/computron",
  "claudeModel": "claude-sonnet-4-6"
}
```

- Confirm `/absolute/path/to/computron/.git` exists.

- [ ] **Step 3: Run the app and smoke-test**

Run: `npm run dev`

Verify each of:

- Topbar auth row shows a green dot for "Computron".
- Triage tab appears first; `Todo` is initially selected.
- Switching to Triage shows team-wide triage issues.
- "Mine only" toggle filters to your assignee id.
- Opening a triage issue mounts `TriageDrawer` (not `SpecDrawer`).
- "Generate brief" button is enabled (computron health green); click streams a brief into the drawer.
- "Write to file" creates `thoughts/tasks/<id>/triage-brief.md` in the configured `repoPath`.
- Re-clicking "Write to file" prompts before overwriting.
- A non-triage issue still mounts `SpecDrawer` exactly as before.

- [ ] **Step 4: Cross-check spec coverage**

Open [thoughts/tasks/add-triage/initial-spec.md](../initial-spec.md). For each numbered Suggested Approach step (1–10) and each Resolved Decision, confirm a task above covers it. Note anything missing as tech-debt in `thoughts/tech-debt.md` rather than expanding scope here.

- [ ] **Step 5: Commit any final touch-ups**

If smoke surfaced minor fixes (CSS for `mine-only`, copy tweaks), include them in a small wrap-up commit:

```bash
git add -p
git commit -m "chore(triage): smoke-test polish"
```

---

## Self-review notes

- **Spec coverage:** Each numbered step of the spec (1–10) has at least one task: types (T1, T3, T6), Linear client (T4, T5), config (T6), computron health (T7, T8), spec-generator refactor (T9), triage prompt (T10), triage generator (T11), triage writer (T12), IPC channels (T13, T14, T15), preload (T16), use-issues merge (T17), use-triage-stream (T18), drawer (T19), tab + toggle (T20), app routing (T21), wire-up (T22). Resolved Decisions: triage flag syntax (used in T11), Mine-only default off (T21 — `useState(false)`), Triage tab first but `Todo` default (T20 ordering + T21 initial state), lazy viewer-id (T21 effect), soft tool-call cap (T10 prompt wording), prompt on overwrite (T12 service + T19 confirm).
- **Type consistency:** `IssueStatus` extension flows through `Issue`, mapping, list panel, app routing. `assigneeId` is plumbed end-to-end. `TriageBrief`, `TriageStreamChunk`, `TriageGenerateDone`, `TriageGenerateError`, `TriageWriteResult` all defined once in `src/shared/types.ts` and reused.
- **No hidden helpers:** Every function called in a later task is defined in an earlier task (or already exists in the repo).
