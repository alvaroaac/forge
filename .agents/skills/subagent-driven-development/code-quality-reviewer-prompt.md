# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```
Task tool (general-purpose):
  Use template at requesting-code-review/code-reviewer.md

  DESCRIPTION: [task summary, from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
```

**In addition to standard code quality concerns, the reviewer should check:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)
- If `thoughts/tasks/<task-slug>/plans/<plan-slug>.addendum.md` exists, every rule listed there applies as a binding quality criterion in addition to the items above. Inject its full contents into the reviewer prompt under a `## Plan Addendum` section so the reviewer enforces them.

**Drift detection (mandatory before writing the review):**

Before writing your own findings, read every existing `qa-review.md` for prior tasks in this plan run:

```
thoughts/tasks/<task-slug>/impl/task-1/qa-review.md
thoughts/tasks/<task-slug>/impl/task-2/qa-review.md
...
thoughts/tasks/<task-slug>/impl/task-<N-1>/qa-review.md
```

Look for the same class of issue (not the exact same issue — the same *pattern*) appearing in two or more prior tasks. Examples of patterns: "magic numbers extracted late", "tests mock instead of integrate against real data", "renderer code importing `node:*`", "function exceeds complexity 4", "duplicate code not extracted on second occurrence". If you find a pattern that repeats across two or more prior tasks AND appears again in the current task, add a `## Drift detected` section to your review. Name the pattern, cite the prior task numbers + file:line refs, and recommend appending a rule to `<plan-slug>.addendum.md`. The orchestrator decides whether to accept; do not edit the addendum yourself.

**Where to write your review:**

```
thoughts/tasks/<task-slug>/impl/task-<N>/qa-review.md
```

Overwrite this file when re-reviewing after fixes.

**Code reviewer returns (and writes to qa-review.md):** Strengths, Issues (Critical/Important/Minor), Drift detected (if any), Assessment
