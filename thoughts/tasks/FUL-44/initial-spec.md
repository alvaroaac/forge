# Spec: FUL-44 — Create a maintenance event type in the Schedule

> **Status:** Draft
> **Generated:** 2026-05-14
> **Issue:** https://linear.app/fulcrum/issue/FUL-44

---

## Task Summary

Add a **Maintenance** event type to the Schedule module so users can create a new asset schedule of type maintenance directly from the Schedule view — without navigating to the asset detail page first. Maintenance is an urgent operational workflow; users need to log it quickly from wherever they already are.

---

## Context

The Schedule module already supports asset schedules. There is at least one existing event type (inferred: inspection, service, or similar). The new Maintenance type follows the same schedule-creation pattern but needs a dedicated UI entry point on the Schedule itself — a quick-create action that pre-fills event type = `maintenance` and prompts only for asset and date.

**Key constraints:**
- Maintenance schedules must be persisted identically to existing schedule entries — same data model, same API, only a new `type` value.
- The quick-create flow must be reachable from the Schedule view without leaving it.
- Priority is urgent — keep scope tight. No new fields beyond what existing schedule creation requires.

**Files to locate before starting:**
- Schedule view component (renders the calendar/list of events).
- Asset schedule creation modal/form component.
- Schedule event type enum or constant definition.
- API/service layer for creating asset schedules.
- Existing tests for schedule creation.

---

## Suggested Approach

1. **Add `maintenance` to the event type enum/constants.** Find where event types are defined (likely a shared constants file or DB enum) and add `maintenance`. Verify downstream consumers (renderers, filters, labels) handle the new value without crashing.

2. **Update the schedule creation form.** Add `maintenance` as a selectable option in the event type dropdown (or radio group). Confirm form validation, labels, and any color/icon mappings cover the new type.

3. **Add a quick-create entry point on the Schedule view.** Place a "New Maintenance" action (button, context menu, or `+` shortcut) directly in the Schedule UI. This action opens the existing schedule-creation modal pre-populated with `type = maintenance` — asset and date fields remain user-editable.

4. **Wire up the API call.** Confirm the existing schedule-creation endpoint/mutation accepts `type = maintenance` without server-side changes. If a schema migration is needed, run it and update the migration log.

5. **Write/update tests.** Unit-test the new enum value and form behavior. Add an integration test (or update existing) for creating a maintenance schedule through the Schedule view.

6. **Smoke-test the golden path.** Open Schedule → trigger quick-create → select asset → set date → save → confirm maintenance entry appears in the schedule list with correct type label.

---

## Open Questions

- [ ] What are the existing event types? (Need the full list to understand enum scope and avoid naming collisions.)
- [ ] Is there a color, icon, or badge assigned per event type? If so, what should Maintenance use?
- [ ] Does "asset" here mean single asset or can a maintenance schedule cover a group/category?
- [ ] Is there a required duration or recurrence for maintenance events, or is it always one-off?
- [ ] Does creating a maintenance schedule trigger downstream workflows (notifications, status changes on the asset, Linear comments)? If yes, scope must expand.
- [ ] Where exactly on the Schedule UI should the quick-create entry point live? (Header button, date-cell right-click, FAB, other?)
- [ ] Server-side: does the `type` field already exist on the schedule model, or does this require a DB migration?