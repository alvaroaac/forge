# Orchestrators

Status: Draft project notes, added 2026-05-13.

Forge should treat orchestrators as first-class workflow definitions. Any multi-step workflow that coordinates agents, user input, repo context, Linear state, or generated artifacts should eventually be implemented through an orchestrator instead of being hardcoded directly into one UI flow.

## Product Direction

- Forge should ship with one seeded default orchestrator so the app works out of the box.
- Creating a new orchestrator should be encouraged, not treated as an expert-only escape hatch.
- Orchestrators should be configurable enough for different engineering teams, repos, and agent styles without requiring users to fork Forge.
- The dashboard should make orchestrators visible and manageable as part of the core workflow surface.

## MVP Stance

For the MVP, Forge can use the currently written orchestrator as a hardcoded/default implementation. This keeps early scope constrained while preserving the product direction.

The MVP should still define the shape that future orchestrators will use, even if the first runtime only supports the seeded default. Avoid spreading orchestration assumptions across unrelated UI, IPC, and service code. Keep the eventual orchestrator boundary obvious.

## Orchestrator Creation Workflow

Creating an orchestrator should be a multi-step AI-guided workflow. The AI should interview the user and ask enough questions to customize the orchestrator properly before generating the definition.

The creation flow should gather, at minimum:

- What workflow the orchestrator owns.
- What triggers the workflow.
- What inputs it needs from the user, Linear, repo files, `thoughts/`, config, or prior agent output.
- Which agents or CLIs it may invoke.
- What approval gates are required before taking action.
- What artifacts it should read and write.
- What progress, review, and completion signals it should surface.
- What failure modes need explicit handling.
- Whether the orchestrator is repo-specific, team-specific, or reusable.

The AI should produce a proposed orchestrator definition, explain the workflow back to the user, and require approval before saving or activating it.

## Dashboard And Management UI

The Forge dashboard should support orchestrator creation and management. When managing an orchestrator, the UI should show useful operational detail rather than just a name.

An orchestrator management view should show:

- Name, purpose, status, and scope.
- Workflow steps and their order.
- Trigger conditions.
- Required inputs and generated outputs.
- Approval gates.
- Agent/CLI dependencies.
- `thoughts/` paths the orchestrator reads or writes.
- Recent runs, current run state, and failure history.
- Whether it is the seeded default or user-created.

## Future Structure To Define

Forge needs a concrete structure for creating, storing, validating, and running new orchestrators.

Open design questions:

- Where orchestrator definitions live on disk.
- Whether definitions are plain markdown, JSON, YAML, TypeScript modules, or a hybrid.
- How an orchestrator references skills, agents, and CLI commands.
- How versioning and migration work when the orchestrator schema changes.
- How user-created orchestrators are exported, imported, or shared.
- How the app distinguishes a reusable orchestrator template from a repo-local configured instance.
- How orchestrator runs map back to `thoughts/tasks/<task-slug>/impl/` artifacts.

Initial bias: define a small declarative manifest for metadata, inputs, gates, and steps, with optional code-backed executors for advanced workflows. Keep the manifest stable and inspectable so the dashboard can render details without executing the orchestrator.
