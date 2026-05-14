# Task 38 QA Review
Verdict: ✅ Approved

## Strengths
- **No raw HTML injection in `MarkdownSection`:** Rendering is done via `inlineParts()` -> React nodes; there is no `dangerouslySetInnerHTML` path in [markdown-section.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/markdown-section.tsx).
- **Inline token rendering is safe and exact:** `inlineParts()` tokenizes `` `code` ``, `§ref`, and `@mention`, and `MarkdownSection` renders them as `<code>/<span>` nodes with plain-text children (React escaping) rather than interpolated HTML. Mention text stays exact (`@alice`, not `alice`). ([markdown.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/lib/markdown.ts), [markdown-section.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/markdown-section.tsx))
- **Valid list semantics:** Contiguous bullet and numbered lines are grouped into real `<ul>/<ol class="md-list">` containers with `<li class="md-li">` children; tests assert both roles and parent tag validity. ([markdown-section.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/markdown-section.tsx), [markdown.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/markdown.test.tsx))
- **CRLF robustness at the parsing boundary:** `splitSections()` normalizes `\r\n`/`\r` to `\n` before heading splitting, and the test locks it in. ([markdown.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/lib/markdown.ts), [markdown.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/markdown.test.tsx))
- Tests are passing (`npx vitest run tests/renderer/markdown.test.tsx`).

## Critical issues
None.

## Important issues
- **Residual “footgun” API surface:** `highlightInline()` still returns an *unsanitized HTML string* (by design, to match the prototype) in [markdown.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/lib/markdown.ts). It is currently unused by the renderer (good), but it remains easy to misuse later by reintroducing `dangerouslySetInnerHTML`.
  - Concrete fix (future hardening, not required for Task 38): either deprecate/rename it to something like `highlightInlineUnsafeHtml()` and/or add a prominent doc comment warning that it must not be used with `dangerouslySetInnerHTML` on untrusted input.

## Minor issues
- `MarkdownSection` splits lines with `body.split('\\n')` and relies on `.trim()` to tolerate stray `\\r`. It’s fine given `splitSections()` CRLF-normalizes upstream, but if `MarkdownSection` is ever used independently with CRLF bodies, a local normalization (`body.replace(/\\r\\n?/g, '\\n')`) would make it fully self-contained.
- Small readability nit: `renderBody()` uses `blockKey++` for the paragraph key while also passing `blockKey` into `renderInline(...)`, which makes the “key prefix” one step out of sync with the paragraph key. It doesn’t break correctness, but it’s slightly surprising when reading the code.

## Drift detected
- Beneficial drift vs the Task 38 plan sketch: the plan’s prototype-faithful approach used `dangerouslySetInnerHTML` and (initially) `<li>` without list containers. The current implementation matches the intended visuals while meeting the project’s security posture and the Task 37 list-semantics discipline.

## Assessment
The previous QA blockers are resolved: `MarkdownSection` no longer injects raw HTML, inline tokens render safely as React nodes with exact mention text, list markup is semantically valid, and `splitSections` is CRLF-robust. Remaining concerns are minor and mostly about preventing future misuse of `highlightInline()` as an unsafe HTML helper. ✅
