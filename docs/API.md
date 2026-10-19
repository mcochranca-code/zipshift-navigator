# ZipShift Navigator API Reference

This document describes the Express API implemented in [`server/index.ts`](../server/index.ts). The API is consumed by the React client and is organized around identity, resource discovery, referrals, care coordination, research operations, administration, and analytics.

## Base conventions

- Base path: `/api`
- Content type: `application/json` unless an endpoint explicitly accepts PDF/octet-stream data or returns a file/export.
- Authentication: session-backed authenticated requests. The server resolves the current user through the request session; client route visibility is not an authorization boundary.
- IDs: application identifiers are generally UUID-like `CHAR(36)` values; provider IDs are directory record identifiers.
- Errors: JSON responses use an `error` message and an appropriate HTTP status. Clients should handle `400` validation failures, `401` unauthenticated requests, `403` authorization failures, `404` missing records, and `500` unexpected server errors without exposing server internals.
- Pagination/filtering: list endpoints accept the query parameters implemented in `server/index.ts`; preserve unknown query parameters when adding clients so server-side filters can evolve without a breaking route change.
- File access: private files are delivered through signed storage URLs. Do not persist signed URLs in logs, issue reports, analytics events, or long-lived client state.

## Public and setup endpoints

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/health` | Liveness response `{ ok: true }`. | Public |
| `GET` | `/setup/status` | Reports whether initial setup is required. | Public/setup |
| `POST` | `/setup/admin` | Creates the initial administrator during setup. | Setup-only |
| `GET` | `/providers` | Returns the curated provider dataset used by directory flows. | Public |
| `GET` | `/coverage/zips` | Returns supported ZIP-code coverage metadata. | Public |
| `GET` | `/emergency-resources` | Returns emergency resource directory data. | Public |
| `GET` | `/county-resources` | Returns county resource directory data. | Public |
| `GET` | `/resources/canonical` | Returns canonicalized resource records for client display. | Public |
| `GET` | `/operations/schedules` | Returns operational schedule data used by resource workflows. | Public |
| `GET` | `/pages/:slug` | Reads a published content page by slug. | Public |
| `POST` | `/feedback` | Accepts product feedback from the client experience. | Public/validated |
| `POST` | `/events` | Accepts generic product events subject to server validation. | Session/validated |

## Authentication and profile

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Registers a client or eligible user with validated account data. |
| `POST` | `/auth/login` | Starts a session and returns the authenticated user context. |
| `POST` | `/auth/forgot-password` | Starts password-reset handling without revealing account existence. |
| `POST` | `/auth/reset-password` | Consumes a reset token and sets a new password. |
| `POST` | `/auth/logout` | Invalidates the current session. |
| `GET` | `/auth/me` | Returns the current session user or an unauthenticated response. |
| `GET` | `/auth/verify` | Verifies the current session/authentication state. |
| `GET` | `/profile` | Reads the current user profile. |
| `PUT` | `/profile` | Updates allowed profile fields with server-side validation. |
| `GET` | `/profile/consents` | Lists the current user’s consent records. |
| `POST` | `/profile/consents` | Records a privacy or research consent decision. |
| `GET` | `/saved-resources` | Lists the current user’s saved provider/resource IDs. |
| `PUT` | `/saved-resources/:providerId` | Saves a provider/resource for the current user. |
| `DELETE` | `/saved-resources/:providerId` | Removes a saved provider/resource. |

Consent records are not a substitute for authorization. Consent, role, study membership, case/team access, and the endpoint’s specific permission must all be evaluated where applicable.

## Directory, analytics, and intake

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/directory` | Searches or filters the provider directory. The client uses category, ZIP, language, access, capacity, and related directory filters. |
| `POST` | `/analytics/zip-search` | Records an aggregate ZIP-search event without storing unnecessary identifying data. |
| `POST` | `/analytics/field-event` | Records a pseudonymous field-test event for product analysis. |
| `GET` | `/staff/reports/field-test` | Returns staff-authorized field-test analytics. |
| `GET` | `/staff/reports/zip-demand` | Returns staff-authorized ZIP demand summaries. |
| `POST` | `/intake` | Creates a client intake/referral submission after validation. |
| `GET` | `/intake-library` | Lists available intake packet forms. |
| `POST` | `/intake-library/assemble` | Assembles a selected set of intake forms into a packet definition. |

## Case and notification endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/cases/mine` | Lists cases/referrals visible to the current user. |
| `GET` | `/cases/:caseId/events` | Returns the case activity/event timeline after access checks. |
| `GET` | `/notifications` | Returns role- and case-relevant notifications. |
| `GET` | `/staff/cases` | Lists staff-visible cases with staff filters. |
| `PATCH` | `/staff/cases/:caseId` | Updates permitted case status, assignment, or workflow fields. |
| `POST` | `/staff/navigator-events` | Records a staff navigator event associated with an authorized workflow. |

Case mutation clients should treat server state as authoritative. When a field mutation is queued offline, retain the operation type, stable entity ID, minimal payload, and retry status; never queue credentials or private document contents in an analytics event.

## YellowBook and staff reports

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/staff/yellowbook/cases/:caseId` | Reads YellowBook encounters for an authorized case. |
| `POST` | `/staff/yellowbook` | Creates a YellowBook encounter. |
| `GET` | `/staff/yellowbook/:encounterId/events` | Reads the encounter’s activity/audit events. |
| `PATCH` | `/staff/yellowbook/:encounterId` | Updates an encounter with role and case checks. |
| `GET` | `/staff/yellowbook/:encounterId/export.pdf` | Generates a printable PDF export for an authorized encounter. |
| `GET` | `/staff/reports/summary` | Returns staff dashboard summary data. |
| `GET` | `/staff/reports/export` | Returns an authorized staff report export. |

## Care coordination and documents

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/care-portal/dashboard` | Returns case-scoped care dashboard data. |
| `GET` | `/care-portal/queue` | Returns the care team work queue. |
| `GET` | `/care-portal/cases/:caseId` | Reads the authorized case coordination view. |
| `GET` | `/care-portal/cases/:caseId/documents` | Lists case documents and file metadata. |
| `POST` | `/care-portal/cases/:caseId/documents` | Creates a care-coordination document record. |
| `PATCH` | `/care-portal/documents/:documentId` | Updates an authorized care document. |
| `POST` | `/care-portal/documents/:documentId/signatures` | Adds a role-checked signature record. |
| `POST` | `/care-portal/cases/:caseId/files` | Uploads PDF/octet-stream case file content; request body limit is 20 MB. |
| `GET` | `/care-portal/files/:fileId/download` | Redirects an authorized user to a short-lived signed file URL. |
| `PATCH` | `/care-portal/files/:fileId/status` | Updates an authorized file status. |
| `POST` | `/care-portal/files/:fileId/signatures` | Adds a signature record for a case file. |
| `GET` | `/care-portal/milestones` | Lists milestones visible to the care team. |
| `POST` | `/care-portal/cases/:caseId/milestones` | Creates a case milestone. |
| `PATCH` | `/care-portal/milestones/:milestoneId` | Updates milestone state, dates, or completion metadata. |
| `GET` | `/care-portal/milestones/:milestoneId/audit` | Reads milestone audit events. |
| `GET` | `/care-portal/tasks` | Lists care tasks. |
| `POST` | `/care-portal/cases/:caseId/tasks` | Creates a case task. |
| `PATCH` | `/care-portal/tasks/:taskId` | Updates or completes a task. |
| `POST` | `/care-portal/cases/:caseId/handoffs` | Creates a care-team handoff. |
| `PATCH` | `/care-portal/handoffs/:handoffId` | Accepts or updates a handoff. |

Signatures must be treated as integrity-sensitive records. Keep signature storage keys, hashes, signer role, and audit metadata server-controlled; do not trust client-provided authorization or storage URLs.

## Administration and research configuration

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/admin/users` | Lists users for authorized administrative management. |
| `PATCH` | `/admin/users/:userId` | Updates allowed role/profile controls. |
| `POST` | `/admin/users/:userId/reset-password` | Starts an administrator-authorized password reset. |
| `GET` | `/admin/studies` | Lists studies. |
| `POST` | `/admin/studies` | Creates a study. |
| `PATCH` | `/admin/studies/:studyId` | Updates study metadata/status. |
| `GET` | `/admin/studies/:studyId` | Reads study details. |
| `POST` | `/admin/studies/:studyId/protocols` | Creates a protocol version. |
| `PATCH` | `/admin/protocols/:protocolId` | Updates protocol metadata/status. |
| `POST` | `/admin/studies/:studyId/members` | Adds a study member with role/permission checks. |
| `GET` | `/admin/studies/:studyId/research-config` | Reads the complete study research configuration. |
| `POST` | `/admin/studies/:studyId/dictionaries` | Creates a data-dictionary version. |
| `GET` | `/admin/dictionaries/:dictionaryId` | Reads a dictionary and its variables. |
| `PATCH` | `/admin/dictionaries/:dictionaryId` | Updates dictionary metadata/status. |
| `POST` | `/admin/dictionaries/:dictionaryId/variables` | Adds a dictionary variable. |
| `PATCH` | `/admin/dictionary-variables/:variableId` | Updates a dictionary variable. |
| `POST` | `/admin/studies/:studyId/instruments` | Creates a research instrument. |
| `GET` | `/admin/instruments/:instrumentId` | Reads instrument configuration. |
| `PATCH` | `/admin/instruments/:instrumentId` | Updates instrument metadata/scoring rules. |
| `POST` | `/admin/instruments/:instrumentId/items` | Adds an instrument item. |
| `PATCH` | `/admin/instrument-items/:itemId` | Updates an instrument item. |
| `POST` | `/admin/studies/:studyId/consent-documents` | Creates a consent document/version. |
| `PATCH` | `/admin/consent-documents/:documentId` | Updates consent document metadata and expiry. |
| `GET` | `/research/studies/:studyId/research-config` | Reads research configuration for an authorized researcher. |

Configuration changes should be versionable where the study protocol, consent document, instrument, dictionary, or scoring rules affect participant data interpretation.

## Research operations

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/research/studies` | Lists studies available to the current researcher. |
| `GET` | `/research/studies/:studyId/participant-controls` | Lists participant-control records for an authorized study. |
| `POST` | `/research/studies/:studyId/participant-controls` | Creates a participant-control record linked to an authorized case/study. |
| `PATCH` | `/research/participant-controls/:controlId/retention` | Updates retention status/deadline. |
| `POST` | `/research/participant-controls/:controlId/withdraw` | Withdraws a participant-control record according to study rules. |
| `GET` | `/research/participant-controls/:controlId/assessments` | Lists participant assessments. |
| `POST` | `/research/participant-controls/:controlId/assessments` | Records an assessment response/result. |
| `GET` | `/research/studies/:studyId/export.csv` | Exports authorized study data in CSV form. |

Research endpoints require both researcher authorization and study-level access. Export implementations must preserve the study’s consent, retention, withdrawal, and minimum-necessary data rules.

## Admin settings, pages, and audit

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/global-settings` | Reads public/global presentation settings. |
| `GET` | `/admin/global-settings` | Reads editable global settings and revision context. |
| `PATCH` | `/admin/global-settings` | Updates global editor settings. |
| `POST` | `/admin/global-settings/undo` | Reverts a setting change using revision history. |
| `GET` | `/admin/audit` | Lists administrative audit events. |
| `GET` | `/admin/pages` | Lists editable admin-managed pages. |
| `POST` | `/admin/pages` | Creates an editable content page. |
| `PATCH` | `/admin/pages/:pageId` | Updates an editable content page. |
| `POST` | `/staff/users` | Creates or provisions a staff user through the authorized staff flow. |

## Adding or changing an endpoint

1. Define the route near its domain group in `server/index.ts`.
2. Put authorization checks before database reads/writes or private storage redirects.
3. Validate body, query, and path parameters; reject unknown or malformed sensitive inputs where appropriate.
4. Keep response shapes stable and document them here.
5. Add or update tests for success, validation failure, unauthenticated access, unauthorized access, and not-found behavior.
6. Update migrations and migration documentation if persistence changes.
7. Run `pnpm run check`, `pnpm test`, and `pnpm run build`.
