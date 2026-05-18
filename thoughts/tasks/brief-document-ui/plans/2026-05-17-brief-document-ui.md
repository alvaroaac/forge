# Brief Document UI Refactor

## Context

The triage brief drawer currently feels disconnected from the spec generator UI. It renders generated markdown as a raw `<pre>`, uses an unpolished drawer body, and duplicates document rendering behavior that already exists in the spec path.

The goal is to make specs and briefs share one generated-document surface so both artifacts feel like first-class Forge outputs.

## Branch

Start from the branch that contains the merged `add-triage` work.

Suggested branch:

```sh
git switch -c codex/brief-document-ui
```

## Scope

- Renderer UI refactor.
- Shared markdown document rendering for specs and briefs.
- Tests for the shared renderer and both consumers.
- No generator plumbing changes unless a tiny prop/type change is required.
- No persistence changes.
- Do not include generated local artifacts such as `thoughts/tasks/FUL-7/`.

## Implementation Plan

### 1. Extract a shared generated document component

Add `src/renderer/components/generated-document.tsx`.

The component should own the common generated-artifact surface:

- meta strip
- artifact path
- streaming marker
- error/status text
- empty state
- activity/loading state
- markdown section rendering via `splitSections` and `MarkdownSection`
- configurable action area

Suggested props:

```ts
type GeneratedDocumentProps = {
  artifactPath: string;
  content: string;
  isStreaming: boolean;
  streamStatus?: string[];
  errorMessage?: string | null;
  statusMessage?: string | null;
  emptyTitle: React.ReactNode;
  emptyDescription?: React.ReactNode;
  activityTitle: string;
  activityStatusFallback: string;
  actions?: React.ReactNode;
  emptyActions?: React.ReactNode;
};
```

Keep this component presentation-focused. Do not move spec-specific review logic or brief-specific write behavior into it.

### 2. Refactor `SpecTab`

Keep spec-specific behavior in `SpecTab`:

- saved vs streaming vs reviewed content selection
- model picker
- review status handling
- review changes toggle
- launch review/write/copy handlers

Move the common document rendering into `GeneratedDocument`.

Preserve current visible spec behavior:

- path: `thoughts/tasks/<issue-id>/initial-spec.md`
- empty state
- streaming activity
- markdown rendering
- review action area

### 3. Refactor `TriageDrawer`

Replace raw `<pre>` output with `GeneratedDocument`.

Visible language:

- artifact name: `Brief`
- empty state: `No brief yet for <issue-id>.`
- generate action: `Generate Brief`
- path: `thoughts/tasks/<issue-id>/triage-brief.md`
- activity title: `Generating brief`

Keep current behavior:

- generation still calls `onGenerate`
- write still calls `window.forge.triage.write`
- overwrite confirmation stays unchanged
- `canGenerate` still gates generation

### 4. Normalize drawer shell/header

Prefer extracting a small shared `IssueDrawerShell` only if it reduces obvious duplication without broadening the task.

Potential responsibilities:

- scrim
- open drawer shell
- close button
- issue id/title header
- priority/labels/Linear link
- optional tabs
- children

If the extraction starts to grow, defer it. The must-have is shared generated-document rendering, not a full drawer architecture refactor.

### 5. Tests

Add tests for `GeneratedDocument`:

- empty state renders
- activity state renders before content arrives
- markdown sections render through `MarkdownSection`
- action slots render
- status/error messages render

Update `SpecTab` tests:

- spec markdown still renders
- streaming activity still renders
- actions still call existing handlers
- reviewed content still wins over saved/streaming content

Update `TriageDrawer` tests:

- drawer shell still opens
- generate button says `Generate Brief`
- brief content renders as markdown, not raw `<pre>`
- write action still works
- overwrite confirmation still works

Keep app routing tests intact:

- triage detail opens detail drawer
- triage brief/spec action opens brief drawer

### 6. Verification

Run:

```sh
npm run typecheck
npm test -- tests/renderer/generated-document.test.tsx tests/renderer/spec-tab.test.tsx tests/renderer/triage-drawer.test.tsx tests/renderer/app.test.tsx
npm test
npm run package:app
```

Report rebuilt app path:

```text
/Users/alvarocarvalho/desenv/personal/forge/dist/mac-arm64/Forge.app
```

## Suggested Commit

```text
refactor(ui): share generated document rendering
```

## Non-Goals

- Do not change Claude/triage generation prompts.
- Do not add triage stream-json status plumbing in this task.
- Do not alter file persistence paths.
- Do not redesign the entire drawer system unless it falls out as a very small extraction.
