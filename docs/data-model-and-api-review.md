# ZipShift Navigator — Data Model and Express API Review

## Scope

This review is based on the current ZipShift Navigator source snapshot, especially `server/index.ts`, `server/authUtils.ts`, `server/storage.ts`, `shared/referralFlow.ts`, the React workspace components, and the ordered SQL migrations under `server/migrations/`.

The companion architecture diagram is available as:

- [`zipshift-architecture.puml`](./zipshift-architecture.puml)
- [`zipshift-architecture.svg`](./zipshift-architecture.svg)

## 1. Core data model relationships

### 1.1 Identity, sessions, and authorization

`app_users` is the identity root for both public clients and staff. A user has an application role (`client`, `admin`, or `researcher`) and may also have a `specialist_role` such as intake, medical, peer-support, SUD, behavioral-health, residential-care, or care coordinator.

`app_sessions` belongs to `app_users` and stores the server-side session identifier and expiry. The browser receives the opaque `zipshift_session` cookie; API authorization resolves the cookie to a session, then joins the session to the active user. `password_reset_tokens` also belongs to `app_users` and is deleted with the user. The API consistently uses parameterized MySQL statements for these lookups.

This creates two authorization layers:

1. **Application role** gates broad workspaces. For example, admin-only routes use `requireRole(..., ["admin"])`, while research routes require `admin` or `researcher`.
2. **Specialist assignment** narrows care-team work. Milestones and tasks use `hasMilestonePermission` to allow administrators and care coordinators to manage all teams, assigned specialists to manage their own team, and researchers to read without writing.

### 1.2 Client profiles, cases, and the operational timeline

`referral_cases` is the central operational aggregate. A case can reference a client identity, a provider/resource, an optional study, and an optional protocol version. The case stores status and priority and acts as the parent for operational records.

The main case-connected records are:

- `client_profiles`: client-specific profile and intake information.
- `case_events`: append-oriented timeline records for meaningful state changes, staff actions, milestones, tasks, handoffs, and research activity.
- Notifications and saved-resource records: client-facing follow-up and persistence surfaces associated with the user or case workflow.
- YellowBook encounter records: clinical-style encounter information and audit activity associated with the case.

The API intentionally writes `case_events` in addition to updating the primary record. That gives the application a broad activity timeline while domain-specific audit tables retain more precise change history.

### 1.3 Care coordination documents and signatures

The care-document model has two complementary document paths:

1. **Structured care documents** use `care_coordination_documents`, with `care_document_signatures` as the signer child table. A case can have several document types, but the migration enforces one document of a given type per case with `UNIQUE (case_id, document_type)`. Documents can require specialist roles and one or more signer roles (`client` and/or `staff`). A document becomes signed only after all required signer roles are present.
2. **Uploaded intake files** use `case_document_files`, optionally linked to an `intake_packet_forms` record. `intake_packets` is a case-level assembled packet, and `intake_packet_items` orders the selected official forms. `case_document_file_signatures` stores signatures for uploaded files.

Both paths have audit support. `case_document_audit_events` records upload, privacy review, void, signing, and packet events. File contents are not stored in MySQL; the database stores the managed-storage key, URL metadata, MIME type, byte size, and SHA-256 hash. `server/storage.ts` obtains short-lived signed URLs for upload/download operations.

Deletion is deliberately case-scoped: deleting a case cascades to its document, packet, signature, and audit children. Signed or void records are treated as immutable at the API layer even where the database relationship permits parent cleanup.

### 1.4 Longitudinal milestones, tasks, and handoffs

`case_milestones` models durable progress points such as intake, referral, appointment, task, outcome, and handoff. Each milestone belongs to a case and is assigned to a specialist team. `case_milestone_audit_events` is append-only history for creation, updates, completion, and cancellation.

`case_tasks` is a separate work queue. A task belongs to a case and can optionally reference a milestone. Task status changes also synchronize an additive `task` milestone and create a `case_events` record. This intentionally provides two views of the same operational work:

- a queue-oriented view for due dates, assignment, and status;
- a longitudinal view for the case timeline.

`care_team_handoffs` represents a warm handoff from one specialist team to another. It belongs to a case, stores the sending and receiving teams, and records the accepting user and timestamp. Handoff creation and acceptance also update the case timeline and synchronize a handoff milestone.

### 1.5 Research governance and consent

`studies` is the research root. It belongs to an optional owner and records the administrators who created it. `study_protocol_versions` and `consent_documents` are versioned children of a study. `study_memberships` is the many-to-many bridge between staff users and studies.

Consent is represented separately from study membership:

- `participant_consents` links a client user to a study and a specific consent-document version.
- Enrollment requires a currently active, granted consent.
- `referral_cases.study_id` and `protocol_version_id` associate an operational case with research context without making every case a participant.

The participant layer is intentionally pseudonymized. `research_participant_controls` links a study to a case, generates a study-scoped pseudonym, and tracks enrollment, withdrawal, and retention. It has uniqueness constraints on `(study_id, case_id)` and `(study_id, pseudonym)`.

`research_assessments` belongs to the participant control, study, and case. It stores instrument key/version, structured responses, score, status, and creator. Withdrawn participant controls cause active assessment rows to be marked withdrawn. Exports select pseudonyms and assessment data rather than direct identifiers and create a `generated_reports` audit record.

### 1.6 Dictionaries and instruments

`data_dictionary_versions` belongs to a study and contains versioned `data_dictionary_variables`. `research_instruments` also belongs to a study and contains ordered `research_instrument_items`. An item may point to a dictionary variable, but the relationship is nullable so an instrument can contain a local item that is not mapped to a dictionary variable.

The API enforces version lifecycle rules: draft definitions can be edited, while active or retired versions must be superseded by a new version. Instrument items are checked to ensure a linked variable belongs to the same study. This prevents accidental cross-study variable reuse.

### 1.7 Administration, configuration, and analytics

`admin_pages` stores editable CMS-like page content. `admin_global_settings` stores the current key/value configuration, while `admin_global_setting_revisions` preserves previous and next values for undo. `admin_audit_log` records administrative changes such as user, page, setting, dictionary, instrument, and consent operations.

`field_test_events` is intentionally separate from identity and case data. Guided-access and resource-interaction telemetry uses an opaque client-generated session key and aggregate reporting. The design excludes IP addresses and direct user identifiers from the field-test event model.

Directory/provider information is split between static JSON seed data and database-backed directory/resource records. This is useful for resilient public navigation but means the source of truth should be made explicit in future schema documentation and operational runbooks.

## 2. Current Express API domains

| Domain | Representative routes | Primary data touched | Current authorization boundary |
|---|---|---|---|
| Health and setup | `/api/health`, `/api/setup/*` | `app_users` | Setup route is intentionally special; should be tightly rate-limited and one-time guarded |
| Authentication and profile | `/api/auth/*`, `/api/profile/*`, `/api/saved-resources/*` | users, sessions, profiles, consent | session and client/staff role checks |
| Navigator and directory | `/api/directory`, `/api/providers`, `/api/resources/*`, `/api/emergency-resources`, `/api/county-resources` | JSON resources and directory records | mostly public reads; authenticated writes where applicable |
| Client intake and feedback | `/api/intake`, `/api/feedback`, `/api/notifications`, `/api/cases/mine` | cases, events, notifications | client session or limited public submission paths |
| Analytics | `/api/analytics/*`, `/api/staff/reports/*` | field events, aggregate ZIP demand, reports | staff role for reports; public event ingestion exists |
| Staff cases and YellowBook | `/api/staff/cases/*`, `/api/staff/yellowbook/*` | cases, encounters, events | admin/researcher session plus workflow checks |
| Care portal | `/api/care-portal/*` | care documents, signatures, files, milestones, tasks, handoffs | `requireCareTeam` plus specialist-team checks for milestones/tasks |
| Research | `/api/research/*` | studies, consent, participants, assessments, exports | admin/researcher plus study membership checks |
| Research administration | `/api/admin/studies/*`, dictionaries, instruments, consent documents | versioned research configuration | admin-only |
| Platform administration | `/api/admin/users`, `/api/admin/pages`, `/api/admin/audit`, `/api/admin/global-settings` | users, pages, settings, revisions, audit | admin-only |
| Runtime/content | `/api/global-settings`, `/api/pages/:slug` | published settings/pages | public read for selected content |

## 3. Security improvements

### High priority

1. **Lock down `/api/events`.** The current route calls `getSession()` but does not require a session, validate the actor’s access to `caseId`, constrain `eventType`, or bound the note/event payload. An unauthenticated caller can potentially insert arbitrary timeline events for an arbitrary case. Require an authenticated actor, validate event types against an allowlist, verify case/workspace access, cap payload sizes, and write the event through a domain-specific helper.
2. **Add explicit case-level authorization to care routes.** `requireCareTeam` establishes a broad role boundary, but routes such as case detail, document reads, file downloads, document edits, and handoffs should consistently verify that the caller is allowed to inspect the specific case and assigned team. Reuse one `assertCaseAccess(session, caseId, action)` policy rather than relying on route-specific checks.
3. **Harden cookie-based state changes against CSRF.** The current session cookie is `SameSite: "lax"` and uses `secure` only when `NODE_ENV === "production"`. For an HTTPS embedded Preview or other cross-site iframe, use `SameSite=None; Secure` in that deployment mode and add an explicit CSRF strategy for all cookie-authenticated mutating requests: synchronizer token, double-submit token, or strict `Origin`/`Referer` validation at the trusted proxy boundary.
4. **Rate-limit authentication and setup.** Apply endpoint-specific limits to login, password reset, administrator setup, and account creation. Add progressive delays or lockout telemetry without revealing whether an email exists. The current password hashing uses Node `scryptSync`, which is a sound primitive but blocks the event loop during login; move hashing to an asynchronous worker/API or use an async password-hashing implementation under load.
5. **Protect sensitive error and audit data.** Add request IDs and structured redacted logging. Never log passwords, reset tokens, raw signature payloads, document contents, or full protected-client intake JSON. Ensure audit `details_json` follows a field-level allowlist so sensitive values are not copied into the audit ledger.

### Medium priority

6. **Make public analytics ingestion abuse-resistant.** `/api/analytics/field-event` and ZIP-search telemetry should validate event/resource identifiers, cap metadata depth and size, reject unexpected keys, and use a server-generated or signed anonymous session token where feasible. Add per-IP/device throttling at the edge without persisting raw IP addresses in the event table.
7. **Tighten file upload validation.** The PDF endpoint checks the `%PDF` header and a 20 MB body limit, but production hardening should parse and validate the PDF structure, reject malformed or decompression-bomb inputs, enforce per-user/case quotas, stream to object storage instead of buffering the full body, and use server-generated filenames exclusively. Keep content disposition and download responses non-sniffable.
8. **Prevent replay and race conditions in signature flows.** Use a transaction and a unique constraint on `(document_id, signer_role)` for structured signatures, then handle duplicate-key conflicts deterministically. For uploaded-file signatures, make the status transition conditional (`WHERE status = 'review'`) so two simultaneous sign requests cannot both pass the pre-check.
9. **Review public content exposure.** Keep `/api/global-settings` and `/api/pages/:slug` limited to an explicit public-safe projection. Do not return internal revision metadata or unpublished content. Confirm that static storage URLs do not expose private source PDFs without a signed URL.
10. **Add security headers and transport policy.** Use a reverse-proxy or Express security middleware configuration for HSTS, CSP, frame-ancestors, X-Content-Type-Options, Referrer-Policy, and a narrowly scoped Permissions-Policy. CSP should explicitly cover the map provider, managed storage, and Preview embedding requirements.

## 4. Performance and reliability improvements

1. **Use transactions for multi-write workflows.** Packet assembly, signature completion, milestone/task updates, handoffs, research enrollment, consent recording, and admin-setting changes currently perform multiple sequential queries. Acquire a pool connection and commit the primary record, audit record, timeline event, and synchronization record atomically; roll back on any failure.
2. **Reduce N+1 and correlated-subquery work.** Care queue/dashboard endpoints use several correlated subqueries for document counts and latest handoffs. Replace repeated per-case lookups with pre-aggregated joins or bounded subqueries, and inspect `EXPLAIN` plans for the queue, dashboard, participant list, and case detail endpoints.
3. **Add pagination everywhere a collection can grow.** Several list endpoints return full collections or use fixed limits without cursors, including users, pages, studies, participants, and some case/document views. Prefer stable cursor pagination on `(updated_at, id)` and return `nextCursor`. Keep hard server-side maximums even when clients provide a limit.
4. **Align composite indexes to actual filters.** The migrations already add useful indexes for cases, milestones, tasks, studies, and assessments. Validate and consider additional indexes such as:
   - `care_team_handoffs (case_id, created_at, status, to_team)` for latest-handoff and queue checks;
   - `care_document_signatures (document_id, signer_role)` for signer uniqueness and completion;
   - `research_assessments (participant_control_id, status, created_at)` for participant history;
   - `participant_consents (participant_user_id, study_id, decision, withdrawn_at, decided_at)` for active-consent lookup;
   - `case_events (case_id, created_at)` for timeline reads;
   - `admin_audit_log (created_at, actor_user_id)` for audit browsing.
   Confirm each candidate with production-like cardinality and `EXPLAIN`; avoid indexing every JSON field.
5. **Stream exports and large responses.** Research and case CSV exports are assembled in memory. Stream CSV rows from the database or enqueue an export job and store the result in managed storage. Add maximum export windows and audit the requested filters.
6. **Batch writes and avoid looped round trips.** Packet item insertion and global-setting updates issue one query per item/key. Use transactions with batched inserts or prepared statements. Keep audit records, but reduce network round trips.
7. **Separate static serving from API lifecycle when scaling.** The Express process currently serves both the compiled SPA and API. That is convenient for deployment, but a CDN/object store can serve immutable `dist/public` assets while API instances focus on authenticated traffic. Preserve SPA fallback through the edge or a small static host.
8. **Instrument the pool and route latency.** Expose internal metrics for pool acquisition wait, active connections, query latency, response size, 4xx/5xx counts, upload bytes, and signed-URL latency. Alert on pool saturation and slow queries rather than increasing `connectionLimit` blindly.
9. **Use bounded concurrency for background work.** PDF generation, signed-storage operations, report exports, and analytics aggregation should not monopolize the event loop or the eight-connection pool. Move expensive work to a queue/worker path when traffic grows.
10. **Make caching explicit.** Public directory/provider reads and published pages can use short-lived cache headers or an application cache keyed by version/update time. Never cache personalized profile, case, consent, document, or research responses at a shared intermediary.

## 5. Recommended implementation order

1. Fix `/api/events` authorization and add a shared `assertCaseAccess` policy.
2. Add CSRF/origin protection, rate limits, security headers, request IDs, and redacted structured logging.
3. Convert signature, packet, handoff, milestone/task, and enrollment flows to transactions with conditional updates.
4. Add cursor pagination and review `EXPLAIN` plans for care queues, participant lists, reports, and case timelines.
5. Stream file uploads and exports, then add storage/database quotas and observability.
6. Move the API route file toward domain routers/services so policy, transactions, and query code are testable without a 2,000-line monolith.

These recommendations preserve the current product boundaries while reducing authorization risk, partial-write risk, memory pressure, and query amplification.
