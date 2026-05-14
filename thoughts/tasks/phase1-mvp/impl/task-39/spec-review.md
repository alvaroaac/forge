# Task 39 Spec Review
Verdict: ✅ Spec compliant

## Missing requirements
- None found.

## Extras / scope drift
- Introduced shared helper `renderInlineMarkdown` (`src/renderer/components/markdown-inline.tsx`) and reused it from both `DetailTab` and `MarkdownSection`. This is aligned with the repo “extract on 2nd duplicate” convention and does not change Task 39’s required DOM shape/behavior.
- Paragraph splitting is more robust than the plan’s literal `split('\n\n')` (it normalizes CRLF and treats whitespace-only blank lines as separators). This is acceptable per the Task 39 QA rubric (“CRLF/whitespace-blank robustness acceptable QA improvement”).

## Misunderstandings
- None found.

## Addendum-rule check
- Addendum protected dirs (`.agents/`, `resources/design/`, `scripts/orchestrator-core/`) were not touched by Task 39 work.
- Task 39 does write to `thoughts/` as explicitly allowed by the conventions (progress + tech-debt).

## Tech-debt-accounting check
- Tech debt entry exists and is correctly formatted:
  - `thoughts/tech-debt.md` includes `- [2026-05-13][Task 39] ... Reason: deferred-phase. Re-evaluate: Phase 2 ...` for dropping the comments section.

## Evidence
- **DetailTab props `{ issue: Issue }`:** `DetailTabProps` is `{ issue: Issue }` and the component signature is `export function DetailTab({ issue }: DetailTabProps)` in `src/renderer/components/detail-tab.tsx`.
- **Comments section dropped + tech-debt logged:** `DetailTab` renders only the Description section; tests assert comments are absent via `screen.queryByRole('heading', { name: /comments/i })` and `.comments` query in `tests/renderer/detail-tab.test.tsx`. Tech-debt entry is present in `thoughts/tech-debt.md` for Phase 2.
- **Empty/whitespace fallback exact text + wrapper:** when `issue.description.trim() === ''`, output is `.drawer-empty .mono.dim` with exact text `No description from Linear.` in `src/renderer/components/detail-tab.tsx`, covered by the “empty” and “only whitespace” tests in `tests/renderer/detail-tab.test.tsx`.
- **Required structure for non-empty description:** renders `.detail-tab > .md-section > .md-h (Description) > .md-body > p...` in `src/renderer/components/detail-tab.tsx`; test “renders heading and paragraph split…” asserts `.detail-tab`, heading “Description”, and paragraph count/text in `tests/renderer/detail-tab.test.tsx`.
- **Paragraph splitting + newline normalization:** implementation normalizes CRLF (`replace(/\\r\\n?/g, '\\n')`), splits on blank lines (`split(/\\n\\s*\\n/)`), and normalizes single newlines to spaces (`replace(/\\n/g, ' ')`). Tests cover `\\n\\n`, CRLF blank lines, whitespace-only blank lines, and single-newline-to-space behavior in `tests/renderer/detail-tab.test.tsx`.
- **Safe inline highlighting reused; no raw HTML injection:** `DetailTab` uses `renderInlineMarkdown` (React nodes) backed by `inlineParts` in `src/renderer/lib/markdown.ts`; no `dangerouslySetInnerHTML` in `DetailTab`, `markdown-inline.tsx`, or the `MarkdownSection` reuse. Tests verify `.md-code`, `.md-ref`, `.md-mention` classes and that HTML-like strings do not create `img`/`script` nodes in `tests/renderer/detail-tab.test.tsx`.
