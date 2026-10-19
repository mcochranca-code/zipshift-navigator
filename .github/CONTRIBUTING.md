# Contributing to ZipShift Navigator

Thank you for contributing to ZipShift Navigator. The project is a privacy-aware PWA for community-resource discovery, referral coordination, care workflows, and research operations. Contributions should preserve the existing role-aware experience, accessible interaction patterns, minimum-necessary data display, and offline field behavior.

## Before you start

Read the root [`README.md`](../README.md), [`docs/API.md`](../docs/API.md), and [`docs/component-hierarchy.md`](../docs/component-hierarchy.md). For schema work, also read [`server/migrations/README.md`](../server/migrations/README.md). Search existing issues before opening a new one.

Do not include client, participant, provider, credential, signed-URL, or production database data in issues, pull requests, screenshots, fixtures, or logs. Use synthetic examples and redact identifiers.

## Development setup

Requirements are Node.js, pnpm 10.x, and MySQL/MariaDB for API-backed workflows.

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run build
pnpm run dev
```

Keep secrets in environment variables. Never commit `.env` files, credentials, private PDFs, signed storage URLs, generated `dist/` output, or local database files.

## Branches and commits

Use a focused branch from `main`, for example `feat/research-export`, `fix/field-dock-toggle`, or `docs/api-reference`. Keep commits cohesive and use an imperative conventional-style subject when practical:

- `feat: add participant retention export`
- `fix: preserve field queue on reconnect`
- `docs: expand care portal API reference`
- `test: cover consent expiry guard`

## Code expectations

- Keep route authorization in the server as the source of truth; client-side visibility is not a security boundary.
- Reuse shared constants and referral rules from `shared/` rather than duplicating workflow states.
- Preserve the existing React/Tailwind/shadcn visual language and keyboard-visible focus behavior.
- Use accessible labels, semantic controls, and bilingual copy where a workflow already supports it.
- Treat privacy mode, consent state, study membership, case/team access, and audit events as product behavior.
- Keep field operations resilient to offline conditions. Mutations that are intentionally queueable must remain idempotent or safely retryable.
- Keep components task-oriented. Prefer extending the existing component hierarchy over introducing a second shell or duplicate workspace UI.
- Avoid logging request bodies, signatures, tokens, health information, or private document metadata.

## Database migrations

Add schema changes as a new ordered file under `server/migrations/`. Do not rewrite an already-applied migration. Include:

1. A forward-only, repeat-safe migration using the project’s existing SQL conventions.
2. Appropriate indexes and foreign-key behavior.
3. A short update to migration documentation when the change creates a new domain or changes retention/access semantics.
4. Tests or validation for the API behavior that depends on the new schema.

## Testing and review

Run all relevant checks before opening a pull request:

```bash
pnpm run check
pnpm test
pnpm run build
```

For UI changes, verify keyboard operation, responsive layout, loading/error/empty states, and the affected role flow. For API changes, cover authorization, invalid input, not-found behavior, and safe error responses. For documents or signatures, verify storage and audit behavior without using real data.

## Pull requests

A good pull request includes:

- A concise summary of the problem and solution.
- The affected role(s), route(s), API endpoint(s), and migration(s).
- Screenshots or a short screen recording for visual changes using synthetic data.
- Test commands and results.
- Any privacy, consent, retention, storage, or deployment considerations.
- Follow-up work that is intentionally out of scope.

Keep pull requests reviewable. Split unrelated refactors from feature changes, and update documentation when the public API, component hierarchy, migration behavior, or developer workflow changes.

## Reporting security issues

Do not open a public issue for a suspected vulnerability or exposed credential. Revoke exposed credentials immediately, preserve only non-sensitive reproduction details, and contact the project maintainers through a private security channel. See the repository’s GitHub security settings for the current reporting route.
