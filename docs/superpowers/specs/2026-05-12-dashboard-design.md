# Forge Dashboard — Design Spec
_Date: 2026-05-12_

## Overview

Forge is a personal desktop engineering command center (Electron + React). This spec covers the dashboard UI design — layout, components, interactions, and visual language — for both MVP v0.1 and the projected final design.

---

## Layout Zones

Three-zone fixed layout with a sliding drawer overlay.

```
┌─────────────────────────────────────────────────────────────┐
│  FORGE                    [auth status] [last sync]  [⚙]   │  ← Top bar (slim)
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   ISSUE LIST (~40%)      │   RIGHT PANEL (~60%)             │
│   Status tabs            │   Idle state / running agents    │
│   Grouped issue cards    │                                  │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
                                    ↑
                        Drawer slides in from right,
                        overlays right panel, X / ESC to close
```

**Top bar:** app name, Linear auth indicator, Claude Code auth indicator, Codex auth indicator, last sync timestamp, settings icon.

**Left panel (~40%):** issue list with status tabs and horizontally scrollable grouped card grid.

**Right panel (~60%):** persistent — shows idle state (auth status + recent activity + agent cards) when no agent selected, never disappears.

**Drawer:** slides over the right panel from the right edge, ~55% window width, 200ms ease-out. Right panel dims slightly. Dismissed via `✕` button or `ESC`.

---

## Issue List Panel

### Status Tabs
Horizontal pill tabs at top of left panel:
`Todo` | `In Progress` | `In Review` | `Done`

### Card Grid Layout
Within each tab, issues are grouped into labeled sub-lists. Each group renders a horizontal card grid — 2 rows × 2-3 cards visible, horizontal scroll reveals overflow.

```
── 🔴 Bugs ──────────────────── (5) → ──
┌──────────────┐ ┌──────────────┐ ┌── →
│ ENG-142      │ │ ENG-139      │ │
│ Fix auth     │ │ Null ptr on  │ │
│ token expiry │ │ profile load │ │
│ 🔴 🔥 Urgent │ │ 🔴 ⬆ High   │ │
│ [Spec][→]    │ │ [Spec][→]    │ │
├──────────────┤ ├──────────────┤ ├── →
│ ENG-137      │ │ ENG-133      │ │
│ ...          │ │ ...          │ │
└──────────────┘ └──────────────┘
```

- Group header shows count + `→` overflow hint when scrollable
- All groups render continuously in the left panel — groups fill the screen if they fit, vertical scroll reveals the rest (not one group at a time)
- Card size: ~160-180px wide, ~110px tall

### Card Anatomy
- **Line 1:** Issue ID + title (truncated ~50 chars)
- **Line 2:** Label badge + priority indicator
- **Line 3 (right-aligned):** `[Spec]` / `[View Spec]` button + `[Detail →]` button
- Left border color = group color (bugs = red, urgent = orange, feature = indigo)
- `[Spec]` becomes `[View Spec]` (filled style) once a spec exists

### Group Order
Bugs → Urgent → High → by Linear label → Low / No priority

---

## Right Panel

### Auth Status
```
● Claude Code  connected
● Codex CLI    connected
● Linear       connected
```
Green dot = connected. Red dot = disconnected (clicking prompts manual login instructions).

### Recent Activity
Last 2-3 items:
```
ENG-142 · Spec generated   3m ago
ENG-138 · Agent finished   1h ago
```

### Agent Cards
```
┌──────────────────────────────┐
│ 🤖 Claude Code  ENG-138      │
│ ● Running · 4m elapsed       │
│ "Migrating schema..."        │
│                  [Manage →]  │
└──────────────────────────────┘
```
- Type badge (Claude Code / Codex), linked issue ID
- Status dot + elapsed time
- Last stdout line (truncated)
- `[Manage →]` opens agent session drawer

### Launch Button
`[+ New Agent]` — top-right of agents section. Disabled until a spec is approved. Opens agent type picker (Claude Code vs Codex).

### Empty State
```
No agents running.
Select a spec to launch one.
```

---

## Drawer — Issue Detail / Spec

Slides in from right, overlays right panel. Two tabs inside.

### Header
```
ENG-142  Fix auth token expiry                              ✕
🔴 Bug  •  🔥 Urgent  •  Linear ↗
─────────────────────────────────
[Detail]  [Spec]
```
`Linear ↗` opens issue in browser.

### Detail Tab
- Issue description (from Linear)
- Comments (from Linear)

### Spec Tab

**No spec yet:**
```
[Generate Spec]
```

**Spec exists:**
```
## Task Summary
## Context
## Suggested Approach
## Open Questions

[✎ Review Spec]    [✓ Approve Spec]
─────────────────────────────────────
[Continue with Claude Code]
[Continue with Codex]
```
- `[✓ Approve Spec]` locked until spec exists
- Agent buttons locked until spec approved — visually disabled
- `[Continue with ...]` replaces old "Implement with" language

---

## Spec Review Screen

Full-window mode, replaces entire app view.

### Top Bar
```
← Back   ENG-142 · Spec Review   [✎ Edit]   [Submit Comments]   [✓ Approve]
```
- `[Submit Comments]` appears only when ≥1 unsent comment thread exists
- `[Submit Comments]` sends ALL open threads to Claude → full spec regeneration
- `← Back` returns to main view, drawer reopens to same state. If unsaved comment threads exist, shows a "Discard comments and go back?" confirmation modal before navigating away.

### Default Mode (Read + Comment)
Full rendered markdown. Hover any paragraph/section block → `💬` icon appears on the right. Click opens inline comment thread anchored to that block. Multiple threads can be open simultaneously.

```
## Task Summary
Fix auth token expiry...                                    [💬]
                          ┌──────────────────────────┐
                          │ 💬 Add more context here │
                          └──────────────────────────┘

## Suggested Approach
1. Update token check...                                    [💬]
                          ┌──────────────────────────┐
                          │ 💬 Consider edge case X  │
                          └──────────────────────────┘
```

### Edit Mode (toggled via `[✎ Edit]`)
```
┌──────────────────────────┬───────────────────────────────────┐
│  Markdown editor         │  Live preview                     │
│  (editable)              │  (rendered, read-only)            │
└──────────────────────────┴───────────────────────────────────┘
```
Auto-saves to `thoughts/tasks/[issue-id]/initial-spec.md`.

---

## Visual Design Language

### Direction
Dark developer tool + command center. Dense but not cluttered. Monospace for identifiers, sans-serif for prose. Subtle motion only.

### Palette (reference — flexible, to be refined in Claude Design)
```
Background:      #0D0F12   near-black base
Surface:         #141720   panels, cards
Surface raised:  #1C2030   drawer, overlays
Border:          #252A3A   subtle grid lines
Accent:          #5B6EF5   primary indigo-blue
Accent dim:      #3D4DB8   hover states
Text primary:    #E8ECF4
Text secondary:  #7A8299
Success:         #2DD4A0   connected, approved
Warning:         #F5A623   urgent, high priority
Danger:          #F25C5C   bugs, disconnected
```
_These values are a starting point. Color, contrast, and accent hue should be adjusted in the design tool._

### Typography
- Identifiers, IDs, code snippets: `JetBrains Mono` or `Fira Code`
- UI prose, labels, headings: `Inter`

### Group Accent Borders (left border on card)
```
Bugs    → Danger (#F25C5C)
Urgent  → Warning (#F5A623)
Feature → Accent (#5B6EF5)
Other   → Border (#252A3A)
```

### Motion
- Drawer slide-in: 200ms ease-out
- No bounce, no spring
- Terminal cursor blink only

---

## MVP v0.1 Scope Delta

Same layout and zones, reduced feature set:

| Feature | v0.1 MVP | Final |
|---|---|---|
| Inline comment threads | ✗ — spec read-only, copy-paste to edit | ✓ |
| Spec regeneration per section | ✗ — full regenerate only | ✓ |
| Agent cards with live output | ✗ — status only | ✓ |
| Group color borders on cards | ✗ — monochrome | ✓ |
| Thread history | ✗ — deferred | ✓ |
| Agent session drawer | ✗ | ✓ |

---

## Claude Design Prompt

Use this prompt to generate mockups in Claude Design. Colors and typography are intentionally left open for iteration.

---

> Design a desktop application dashboard called **Forge** — a personal engineering command center. Dark mode. The aesthetic is a hybrid between a developer tool and a command center: dense, purposeful, slightly dramatic. Think Linear meets Raycast meets a terminal UI.
>
> **Layout:** Three-zone fixed layout.
> - Slim top bar: app name on the left, three auth status indicators (Claude Code, Codex CLI, Linear) with colored dots, last sync timestamp, settings icon on the right.
> - Left panel (~40% width): issue list. Horizontal pill tabs at the top for status (Todo / In Progress / In Review / Done). Below the tabs, issues are grouped into labeled sub-sections (Bugs, Urgent, Feature, etc.). Each group renders a horizontal grid of cards — 2 rows, 2-3 cards visible, scrollable right. Each card shows: issue ID in monospace, truncated title, a label badge, a priority badge, and two small action buttons (Spec, Detail).
> - Right panel (~60% width): persistent panel showing three auth status rows at the top, a short recent activity list, and below that a section for running agent cards. Each agent card shows: agent type badge, linked issue ID, status indicator with elapsed time, last output line truncated, and a manage button. A "New Agent" button sits in the top right of this section. Empty state shows a short message.
>
> **Drawer:** A slide-in drawer that overlays the right panel from the right edge (~55% window width). It has a header with issue ID, title, metadata badges, and a close button. Two tabs: Detail and Spec. The Spec tab shows rendered markdown with a Review and Approve button at the bottom. Agent launch buttons ("Continue with Claude Code", "Continue with Codex") appear below, disabled until approved.
>
> **Color palette:** Suggest a dark developer tool palette — near-black background, dark surface cards, a single vivid accent color (indigo, electric blue, or teal — your choice), muted secondary text, semantic colors for status (green = connected/approved, amber = warning/urgent, red = bug/error). Keep it flexible — this is a starting point for iteration.
>
> **Typography:** Monospace font for issue IDs, code, and terminal output. Clean sans-serif for everything else.
>
> **Style notes:** Subtle borders between zones. No heavy shadows. Compact card sizing. Status dots are small and crisp. Buttons are understated — outlined or ghost style, not filled blocks. The overall feel should be: "this was built for someone who lives in their terminal."
>
> Generate: (1) a full dashboard view with sample data, (2) the same view with the spec drawer open.

---

_Post-MVP backlog tracked in `thoughts/tech-debt.md`_
