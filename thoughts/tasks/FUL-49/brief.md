**What the user likely wants**

Change the system default prep time for new orders from 60 minutes to 30 minutes so orders created quickly (especially via the scheduler "+" button without an assigned asset) don't silently save with the wrong prep duration. Reporter also hints at wanting a smarter flow when no asset is assigned at entry time — possibly auto-routing to a notes/unassigned section without requiring asset selection.

**Likely affected components**

- `packages/dashboard/src/components/form/OrderForm/logic/constants.ts:3` — `DEFAULT_PREP_TIME = minutesToSeconds(60)` is the single source of the wrong default; change to `minutesToSeconds(30)`.
- `packages/dashboard/src/components/form/OrderForm/logic/setFormValueDefaults.ts:7` — consumes `DEFAULT_PREP_TIME` to seed new schedule steps; inherits the fix automatically.
- `packages/dashboard/src/components/form/OrderForm/OrderForm.tsx:226,234` — uses `DEFAULT_PREP_TIME` as the reset/fallback when equipment changes; inherits the fix automatically.
- `packages/dashboard/src/components/scheduler/EquipmentScheduleList/NoteItem.tsx` / `NoteEvent.tsx` — reporter says orders without an asset end up in "notes section"; may need UX changes if the "better ideas" include a dedicated unassigned queue.
- `packages/dashboard/src/components/scheduler/SchedulerHeader.tsx` / toolbar area — the "+" button entry point; may need a default path that skips asset assignment.

**Open questions for reporter**

- "I have some ideas on how this could be better" — what are those ideas specifically? Is it a UI flow change (e.g., skip asset selection and auto-place in unassigned/notes), a notification/warning before confirmation goes out, or something else?
- When an order has no asset assigned, where *should* it live visually? Currently the scheduler notes section — is that acceptable, or does it need its own unassigned lane?
- Should the 30-minute default also apply to per-equipment `prepTime` fallback (currently: `selectedEquipment?.prepTime ?? DEFAULT_PREP_TIME`), or only when no equipment is selected?
- Is this pain specific to the scheduler "+" button, or also to the standalone order creation form?
- Are there existing orders with 60-min prep that need a bulk migration, or is forward-only acceptable?

**Suggested next step**

Ready for spec — the core fix (one constant change) is trivially locatable, but the reporter's "better ideas" hint at a broader UX redesign that needs scoping before touching the scheduler flow.