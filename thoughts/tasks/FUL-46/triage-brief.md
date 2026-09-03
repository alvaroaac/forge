## What user likely wants

Pick one canonical Prisma enum value casing (snake_case vs SCREAMING_SNAKE vs PascalCase), rename all existing enum values to match, document convention. Goal: kill ambiguity for new contributors. No behavior change.

## Likely affected components

- `packages/api/prisma/schema.prisma` — ~58 enums, mixed styles. Examples: `SiteStatus` SCREAMING (L787), `OrderDetailsType` lowercase (L435), `SubRequestStatus` snake_case (L617), `Transmission` SCREAMING (L1100), `RefundOption` SCREAMING (L3000), `PaymentTypeCategory` snake_case (L3006). Even adjacent enums diverge.
- `packages/api/prisma/migrations/` — every value rename = Postgres enum `ALTER TYPE ... RENAME VALUE` migration, one per renamed value per enum.
- `packages/api/src/**` — Nexus resolvers, helpers, seeds reference enum literals (e.g. `OrderInvoiceBuilder.ts`, `defaultPaymentRefundTypes.ts`, `equipment-availability.ts`).
- `packages/api/schema.graphql` (auto-gen) + downstream copies in `customer-app`, `crew-app`, `pipeline`, `shared/` — GraphQL enum values mirror Prisma; client consumers break on rename.
- `packages/dashboard/gql-docs/**`, `packages/customer-app-v2/src/schema.graphql` (manual subset) — codegen + manual schema both need refresh.
- `packages/api/test/**` — 76+ enum literal references across unit + integration tests sampled.
- `docs/` or new `CONTRIBUTING` section — convention doc.

## Open questions for reporter

- Which casing wins? Brandon's preference? Prisma docs lean SCREAMING_SNAKE but lowercase/snake_case is currently most common here. Need decision before scoping.
- DB-level rename strategy: in-place `ALTER TYPE ... RENAME VALUE` (Postgres 10+), or new enum + column swap? Former is simpler, latter handles edge cases.
- Rollout: one mega-PR (atomic, large diff, deploy risk) vs per-enum PRs (incremental, transient inconsistency)?
- Does rename apply to GraphQL enum values too (breaking change for API clients incl. mobile/customer apps), or only Prisma-internal with mapping at GQL layer?
- Are external integrations (Quickbooks/Samsara/Stripe sync, webhooks, stored Json blobs containing enum strings) holding raw enum values? Persisted Json with old values would silently break.
- Legacy enums (`UserRoleLegacy`) — rename or skip as deprecated?

## Suggested next step

**Needs spec.** Decision on canonical casing + GraphQL breaking-change posture + rollout strategy must be locked before any code moves. Touches ~58 enums, dozens of migrations, generated schemas across 4+ packages, and external API consumers — too much blast radius to start without alignment.