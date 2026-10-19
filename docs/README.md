# ZipShift Navigator Documentation

- [`../README.md`](../README.md) — product overview, setup, architecture summary, data model, and validation status.
- [`API.md`](API.md) — Express API route reference, authentication, authorization, payload conventions, and domain endpoint groups.
- [`component-hierarchy.md`](component-hierarchy.md) — React shell, product workflows, field operations tree, state boundaries, and extension guidance.
- [`DUAL_DATABASE_MIGRATION.md`](DUAL_DATABASE_MIGRATION.md) — 108-route dual-database refactor strategy, rollout modes, parity checks, and cutover gates.
- [`DUAL_DATABASE_IMPLEMENTATION.md`](DUAL_DATABASE_IMPLEMENTATION.md) — adapter, repository, monitoring endpoint, dashboard, and baseline snapshot implementation notes.
- [`architecture.mmd`](architecture.mmd) — editable Mermaid system architecture.
- [`zipshift-architecture.puml`](zipshift-architecture.puml) — editable PlantUML component/deployment architecture.
- [`zipshift-architecture.svg`](zipshift-architecture.svg) — vector export of the PlantUML architecture diagram.
- [`database-schema.mmd`](database-schema.mmd) — editable Mermaid entity relationship diagram.
- [`user-journeys.mmd`](user-journeys.mmd) — editable Mermaid user and security journey diagram.
- [`data-model-and-api-review.md`](data-model-and-api-review.md) — detailed data relationships plus Express security and performance recommendations.
- [`../.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md) — setup, coding, testing, migration, privacy, and pull-request expectations.
- [`../server/migrations/README.md`](../server/migrations/README.md) — ordered migration guidance.
- [`../db/cockroach-migrations/README.md`](../db/cockroach-migrations/README.md) — generated Cockroach DDL candidate review and baseline-schema warning.

When adding a public endpoint, new role workflow, schema domain, or cross-cutting component, update the relevant documentation in the same pull request.
