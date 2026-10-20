# ZipShift Navigator — Performance, Security, Compliance, and FHIR-Ready Implementation Plan

## 1. Purpose and implementation principles

This proposal turns the performance recommendations from the API review into an implementation sequence for the current Express/MySQL runtime and the repository’s planned CockroachDB migration.

The plan follows five principles:

1. **Preserve endpoint contracts.** Existing `/api/*` paths and response semantics remain stable while query and repository implementations improve.
2. **Use keyset pagination, not offset pagination.** Cursors remain stable when new cases/events arrive and avoid scanning increasingly large offsets.
3. **Treat authorization as a data-access invariant.** Every case, study, document, event, and research record is fetched through a scope-aware query or an explicit access assertion.
4. **Make multi-record workflows atomic.** A primary mutation, timeline event, audit record, and synchronization record either all commit or all roll back.
5. **Keep interoperability additive.** FHIR resources are an interoperability projection over the operational model, not a replacement for the case, care, consent, and research aggregates.

The proposal is deliberately written as a draft. SQL should be applied only after comparing the candidate indexes with production `SHOW CREATE TABLE`, `SHOW INDEX`, row counts, and `EXPLAIN` plans.

## 2. Migration and rollout sequence

### Phase 0 — establish a measured baseline

Capture the following before changing indexes or query shapes:

- p50/p95/p99 latency and response size for case events, staff cases, care queue, care dashboard, milestones, tasks, audit, participant controls, assessments, and research exports;
- MySQL `EXPLAIN` and `EXPLAIN ANALYZE` output for the current queries;
- rows examined, temporary tables, filesorts, pool wait time, and connection utilization;
- result counts and authorization-denial behavior for representative roles;
- duplicate-index inventory from `SHOW INDEX FROM <table>`.

Store the baseline as a versioned review artifact, but never include protected client values or raw document content.

### Phase 1 — add non-destructive indexes

Apply the candidate index migration online where supported. Index builds must be scheduled for a low-traffic window, monitored for lock impact, and reversible through a separately reviewed down migration or `DROP INDEX` script.

### Phase 2 — introduce cursor contracts behind feature flags

Initially support both legacy list behavior and cursor behavior:

- no cursor: preserve the existing default response for existing clients;
- `?limit=50&cursor=<opaque>`: return the new paged shape;
- optionally add `X-ZipShift-Pagination: cursor` while clients migrate;
- remove unbounded legacy behavior after all production clients use cursors.

### Phase 3 — harden events and transaction boundaries

Ship authorization and validation changes before enabling new clients to send event idempotency keys. Convert one mutation family at a time to `withTransaction`, beginning with `/api/events`, task/milestone writes, handoffs, and document signatures.

### Phase 4 — dual-database compatibility validation

The repository’s dual-database strategy makes MySQL the current legacy runtime and targets CockroachDB as the authoritative database after parity checks. For each new migration/query:

- keep the source migration in MySQL syntax under `server/migrations/`;
- run `pnpm db:translate-mysql`;
- review generated Cockroach DDL and index semantics;
- avoid MySQL-only query constructs in new repository code;
- compare normalized result sets in shadow mode;
- do not silently fall back between databases on a failed write.

## 3. Proposed composite-index migration

Create a migration such as:

`server/migrations/20261019_add_cursor_and_scope_indexes.sql`

The exact `IF NOT EXISTS` syntax must follow the project’s migration runner and the verified target engine. The following is a candidate MySQL source migration; it is not a blind production script.

```sql
-- Case event timeline: newest-first keyset pagination per case.
ALTER TABLE case_events
  ADD INDEX IF NOT EXISTS idx_case_events_case_created_id
    (case_id, created_at, id);

-- Case lists and case-scoped dashboards commonly sort by updated_at.
ALTER TABLE referral_cases
  ADD INDEX IF NOT EXISTS idx_referral_cases_updated_id
    (updated_at, id),
  ADD INDEX IF NOT EXISTS idx_referral_cases_status_updated_id
    (status, updated_at, id),
  ADD INDEX IF NOT EXISTS idx_referral_cases_assignee_status_updated_id
    (assigned_to, status, updated_at, id);

-- Latest handoff and receiving-team queue lookups.
ALTER TABLE care_team_handoffs
  ADD INDEX IF NOT EXISTS idx_handoffs_case_created_id
    (case_id, created_at, id),
  ADD INDEX IF NOT EXISTS idx_handoffs_team_status_created_id
    (to_team, status, created_at, id);

-- Case document and audit timelines.
ALTER TABLE case_document_files
  ADD INDEX IF NOT EXISTS idx_case_files_case_uploaded_id
    (case_id, uploaded_at, id);

ALTER TABLE case_document_audit_events
  ADD INDEX IF NOT EXISTS idx_case_doc_audit_case_created_id
    (case_id, created_at, id);

ALTER TABLE care_coordination_documents
  ADD INDEX IF NOT EXISTS idx_care_docs_case_status_updated_id
    (case_id, status, updated_at, id);

-- Signer completion and duplicate detection.
ALTER TABLE care_document_signatures
  ADD UNIQUE INDEX IF NOT EXISTS uq_care_signatures_document_role
    (document_id, signer_role),
  ADD INDEX IF NOT EXISTS idx_care_signatures_document_signed_id
    (document_id, signed_at, id);

-- Work queues: equality filters first, then status/date ordering.
ALTER TABLE case_milestones
  ADD INDEX IF NOT EXISTS idx_milestones_team_status_updated_id
    (assigned_team, status, updated_at, id),
  ADD INDEX IF NOT EXISTS idx_milestones_case_updated_id
    (case_id, updated_at, id);

ALTER TABLE case_tasks
  ADD INDEX IF NOT EXISTS idx_tasks_team_status_due_updated_id
    (assigned_team, status, due_at, updated_at, id),
  ADD INDEX IF NOT EXISTS idx_tasks_case_updated_id
    (case_id, updated_at, id);

-- Research participant list, active-consent checks, and assessment history.
ALTER TABLE study_memberships
  ADD INDEX IF NOT EXISTS idx_memberships_user_active_study
    (user_id, is_active, study_id);

ALTER TABLE participant_consents
  ADD INDEX IF NOT EXISTS idx_consents_user_study_decision_date
    (participant_user_id, study_id, decision, withdrawn_at, decided_at, id);

ALTER TABLE research_participant_controls
  ADD INDEX IF NOT EXISTS idx_participants_study_status_updated_id
    (study_id, enrollment_status, updated_at, id);

ALTER TABLE research_assessments
  ADD INDEX IF NOT EXISTS idx_assessments_participant_status_created_id
    (participant_control_id, status, created_at, id),
  ADD INDEX IF NOT EXISTS idx_assessments_study_instrument_created_id
    (study_id, instrument_key, created_at, id);

-- Admin and audit browsing.
ALTER TABLE admin_audit_log
  ADD INDEX IF NOT EXISTS idx_admin_audit_created_id
    (created_at, id),
  ADD INDEX IF NOT EXISTS idx_admin_audit_actor_created_id
    (actor_user_id, created_at, id);

ALTER TABLE admin_pages
  ADD INDEX IF NOT EXISTS idx_admin_pages_published_updated_id
    (is_published, updated_at, id);
```

### Index design notes

- The final `id` column is a deterministic tie-breaker when timestamps collide. Every cursor query must order by the same `(timestamp, id)` pair.
- Equality predicates precede range/order columns. For example, `(case_id, created_at, id)` supports a case-specific descending timeline; `(assigned_team, status, due_at, updated_at, id)` supports a care queue filtered by team/status.
- Do not add every candidate index automatically. Composite indexes consume write I/O and storage and may duplicate an existing unique index. Compare `SHOW INDEX` output first.
- If `id` is not present on an existing base table, use the table’s immutable primary key as the tie-breaker and update the query examples accordingly.
- For nullable `due_at`, standardize ordering explicitly with a generated sort key or a portable `CASE` expression; do not assume MySQL and Cockroach place nulls identically.
- If MySQL’s `ALTER TABLE ... ADD INDEX IF NOT EXISTS` is not supported by the deployed version, use the project migration runner’s guarded DDL or a preflight check. The translator must also be reviewed for Cockroach index syntax.

### Optional event idempotency migration

If the product will accept retried offline events, add a separate idempotency table rather than guessing at the existing `case_events` base schema:

```sql
CREATE TABLE IF NOT EXISTS case_event_idempotency (
  id CHAR(36) NOT NULL PRIMARY KEY,
  actor_user_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  case_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_event_idempotency_actor_key (actor_user_id, idempotency_key),
  UNIQUE KEY uq_event_idempotency_event (event_id),
  INDEX idx_event_idempotency_created (created_at)
);
```

Add foreign keys only after confirming the exact base-table types and migration ordering. A retention job should delete idempotency rows after the client retry window while preserving the canonical `case_events` record.

## 4. Cursor pagination design

### 4.1 Cursor contract

Every paginated endpoint should accept:

- `limit`: integer from 1 through 100; default 50;
- `cursor`: opaque, signed, route-specific cursor;
- endpoint-specific filters such as `caseId`, `team`, `status`, or `studyId`.

Responses should use:

```json
{
  "items": [],
  "nextCursor": "eyJ2IjoxLCJzb3J0IjoiY3JlYXRlZF9hdCxpZCIsLi4ufQ..."
}
```

The cursor must contain the last row’s sort values and a version, but it must not contain PHI, signed URLs, or authorization claims. Sign it with an HMAC so clients cannot alter the position or inject filters. Reapply all authorization and filters from the request; never trust filter values encoded in a cursor.

### 4.2 TypeScript cursor helper

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const CURSOR_SECRET = process.env.CURSOR_SIGNING_SECRET;
if (!CURSOR_SECRET) throw new Error("CURSOR_SIGNING_SECRET is required");

type TimelineCursor = {
  v: 1;
  sort: "created_at,id";
  createdAt: number;
  id: string;
};

function encodeCursor(value: TimelineCursor) {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  const mac = createHmac("sha256", CURSOR_SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function decodeCursor(raw: unknown): TimelineCursor | null {
  if (typeof raw !== "string" || raw.length > 512) return null;
  const [body, suppliedMac] = raw.split(".");
  if (!body || !suppliedMac) return null;
  const expectedMac = createHmac("sha256", CURSOR_SECRET).update(body).digest("base64url");
  const a = Buffer.from(suppliedMac);
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<TimelineCursor>;
    if (parsed.v !== 1 || parsed.sort !== "created_at,id" || typeof parsed.id !== "string" || !Number.isFinite(parsed.createdAt)) return null;
    return parsed as TimelineCursor;
  } catch {
    return null;
  }
}
```

In a dual-database implementation, put this helper in a shared pagination module and keep the SQL predicate portable. Avoid row-value comparisons if the translation layer does not guarantee equivalent behavior:

```sql
WHERE case_id = ?
  AND (created_at < ? OR (created_at = ? AND id < ?))
ORDER BY created_at DESC, id DESC
LIMIT ?
```

### 4.3 `/api/cases/:caseId/events` example

```ts
app.get("/api/cases/:caseId/events", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const limit = parseLimit(req.query.limit, 50, 100);
  const cursor = decodeCursor(req.query.cursor);
  if (req.query.cursor && !cursor) {
    return res.status(400).json({ error: "Invalid or expired cursor." });
  }

  // Must check the caller can read this specific case before querying events.
  if (!(await canReadCase(session, req.params.caseId))) {
    return res.status(404).json({ error: "Case not found." });
  }

  const params: Array<string | number> = [req.params.caseId];
  let after = "";
  if (cursor) {
    after = " AND (e.created_at < ? OR (e.created_at = ? AND e.id < ?))";
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  params.push(limit + 1);

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT e.id, e.event_type, e.event_data_json, e.note, e.created_at,
            u.display_name AS actor_name
       FROM case_events e
       LEFT JOIN app_users u ON u.id = e.actor_user_id
      WHERE e.case_id = ?${after}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ?`,
    params
  );

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  res.json({
    items: page.map(normalizeCaseEvent),
    nextCursor: rows.length > limit && last
      ? encodeCursor({ v: 1, sort: "created_at,id", createdAt: Number(last.created_at), id: String(last.id) })
      : null,
  });
});
```

The same pattern should be applied to:

- `/api/staff/cases` ordered by `updated_at,id`;
- `/api/care-portal/milestones` ordered by `updated_at,id`;
- `/api/care-portal/tasks` ordered by a documented priority/due-date key plus `id`;
- `/api/care-portal/queue` ordered by priority rank, `updated_at,id`;
- `/api/admin/audit` ordered by `created_at,id`;
- `/api/admin/users` and `/api/admin/pages` ordered by `created_at,id` or `updated_at,id`;
- `/api/research/studies/:studyId/participant-controls` ordered by `updated_at,id`;
- `/api/research/participant-controls/:controlId/assessments` ordered by `created_at,id`.

For compound ordering such as priority then update time, encode the complete sort tuple in the cursor, e.g. `{priorityRank, updatedAt, id}`, and repeat the lexicographic predicate in SQL.

## 5. `/api/events` hardening plan

### 5.1 Current risk

The current route obtains an optional session and inserts a caller-supplied `caseId`, `eventType`, `eventData`, and `note`. It needs a mandatory authenticated actor, a case-level read/write policy, an event-type allowlist, bounded structured data, and retry/idempotency behavior.

### 5.2 Validation schema

The project already uses Zod in the dependency set. A dedicated schema keeps validation centralized:

```ts
import { z } from "zod";

const CASE_EVENT_TYPES = [
  "CLIENT_PROFILE_UPDATED",
  "REFERRAL_CREATED",
  "REFERRAL_STATUS_UPDATED",
  "NAVIGATOR_ACTION",
  "CARE_DOCUMENT_UPDATED",
  "CARE_TEAM_HANDOFF_CREATED",
  "CARE_TEAM_HANDOFF_STATUS_UPDATED",
  "CASE_TASK_CREATED",
  "CASE_TASK_STATUS_UPDATED",
  "LONGITUDINAL_MILESTONE_CREATED",
  "LONGITUDINAL_MILESTONE_UPDATED",
  "RESEARCH_PARTICIPANT_ENROLLED",
  "RESEARCH_PARTICIPANT_WITHDRAWN",
  "RESEARCH_ASSESSMENT_RECORDED",
] as const;

const caseEventInput = z.object({
  caseId: z.string().uuid(),
  eventType: z.enum(CASE_EVENT_TYPES),
  eventData: z.record(z.string(), z.unknown()).default({}),
  note: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._~-]{16,100}$/).optional(),
}).strict();
```

Add a recursive size/depth guard for `eventData`. A schema that only checks the top-level object can still accept a very large nested payload.

### 5.3 Shared case authorization

```ts
async function canWriteCase(session: SessionContext, caseId: string) {
  if (session.user.role === "admin") return true;

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.id
       FROM referral_cases c
       LEFT JOIN care_team_handoffs h
         ON h.case_id = c.id
        AND h.to_team = ?
        AND h.status IN ('pending', 'accepted')
      WHERE c.id = ?
        AND (
          c.client_id = ?
          OR c.assigned_to = ?
          OR ? = 'care_coordinator'
          OR h.id IS NOT NULL
        )
      LIMIT 1`,
    [session.user.specialistRole || "", caseId, session.user.id, session.user.id, session.user.specialistRole || ""]
  );
  return Boolean(rows[0]);
}
```

The exact policy must be adapted to the product’s intended staff visibility. The important requirement is that event insertion uses the same case-scope rules as case reads and mutations, not only a broad `admin`/`researcher` role check.

### 5.4 Hardened endpoint with idempotency

```ts
app.post("/api/events", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const parsed = caseEventInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid case event payload." });
  }
  const input = parsed.data;

  if (!(await canWriteCase(session, input.caseId))) {
    return res.status(404).json({ error: "Case not found." });
  }

  const requestId = getRequestId(req);
  const eventId = randomUUID();
  const timestamp = now();

  const result = await withTransaction(async (connection) => {
    if (input.idempotencyKey) {
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT event_id
           FROM case_event_idempotency
          WHERE actor_user_id = ? AND idempotency_key = ?
          LIMIT 1`,
        [session.user.id, input.idempotencyKey]
      );
      if (existing[0]) return { eventId: String(existing[0].event_id), replayed: true };
    }

    await connection.execute(
      `INSERT INTO case_events
        (id, case_id, actor_user_id, event_type, event_data_json, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventId, input.caseId, session.user.id, input.eventType,
       JSON.stringify({ ...input.eventData, requestId }), input.note || null, timestamp]
    );

    if (input.idempotencyKey) {
      await connection.execute(
        `INSERT INTO case_event_idempotency
          (id, actor_user_id, idempotency_key, case_id, event_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), session.user.id, input.idempotencyKey, input.caseId, eventId, timestamp]
      );
    }

    return { eventId, replayed: false };
  });

  res.status(result.replayed ? 200 : 201).json(result);
});
```

If the idempotency insert returns a duplicate-key error due to a concurrent retry, re-read the existing idempotency row and return its event ID rather than creating a second timeline event.

## 6. Transaction implementation plan

### 6.1 MySQL transaction helper

Move this helper into `server/db/transaction.ts` or the planned database port. Do not let route handlers call `beginTransaction` directly after the Cockroach adapter lands.

```ts
import type { PoolConnection } from "mysql2/promise";

export async function withTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original error */ }
    throw error;
  } finally {
    connection.release();
  }
}
```

The production helper should set a bounded transaction timeout where supported and include a retry policy only at the database transaction boundary. For CockroachDB, retry serialization failures by rerunning the transaction closure, not by replaying an entire HTTP request with side effects.

### 6.2 Convert helper functions to accept an executor

Current helpers such as `syncCaseMilestone` use the global pool. Change them to accept a query executor:

```ts
type SqlExecutor = Pick<PoolConnection, "query" | "execute">;

async function syncCaseMilestone(
  connection: SqlExecutor,
  input: SyncMilestoneInput,
) {
  const [rows] = await connection.query<RowDataPacket[]>(/* existing lookup */);
  // all reads and writes use connection, never the global pool
  await connection.execute(/* insert/update milestone */);
  await connection.execute(/* insert milestone audit */);
}
```

This prevents a transaction from silently mixing transactional and non-transactional connections.

### 6.3 Transaction boundaries by workflow

| Workflow | Atomic unit |
|---|---|
| Case event | event row + idempotency row |
| Task create/update | task mutation + synchronized milestone + `case_events` row |
| Milestone create/update | milestone mutation + milestone audit + `case_events` row + case timestamp |
| Handoff create/accept | handoff mutation + milestone synchronization + `case_events` row |
| Care document signature | signature row + document status transition + `case_events` row |
| File signature | signature metadata row + file status transition + audit event; object upload must be compensatable or staged before commit |
| Packet assembly | packet row + all packet items + packet audit row |
| Research enrollment | participant control + enrollment event; consent is checked before transaction and must still be valid inside it |
| Participant withdrawal | participant status + assessment withdrawal + case event |
| Global settings | revision rows + current setting upserts + admin audit |

Object storage is not transactional with MySQL. For file uploads, use a staged object key, commit database metadata only after upload succeeds, and run a compensating cleanup job for orphaned objects. Do not put document bytes into the database transaction or migration outbox.

### 6.4 Tests for transaction behavior

Add integration tests that force failures after each intermediate write and assert:

- no partial task/milestone/event set remains;
- retrying an idempotent request returns the original entity;
- duplicate signer requests produce one signature;
- concurrent handoff acceptance allows exactly one winner;
- research withdrawal leaves no active assessment rows;
- transaction rollback does not delete pre-existing audit records.

## 7. Security and Compliance program

This section is an engineering research and control plan, not a legal determination. Counsel, the organization’s privacy/security officer, and—where research involves human subjects—the responsible IRB or ethics committee must confirm which laws, agreements, and institutional policies apply.

### 7.1 Research workstreams

#### Workstream A — data inventory and classification

Create a field-level inventory covering:

- identity and authentication fields;
- client profile and intake fields;
- case/referral and care-team fields;
- document metadata, storage keys, signatures, and hashes;
- research consent, participant controls, pseudonyms, assessments, and exports;
- operational telemetry and ZIP analytics;
- FHIR projections and external identifiers.

For each field record owner, purpose, sensitivity, source, retention period, access roles, encryption requirements, export behavior, and deletion/withdrawal behavior. Classify direct identifiers, quasi-identifiers, clinical/behavioral health information, research data, audit data, and public directory content separately.

#### Workstream B — consent and research governance

Define the consent matrix before enabling additional research workflows:

- consent document ID/version/language/purpose;
- decision (`granted`, `declined`, `withdrawn`);
- decision timestamp and recording actor;
- effective/expiry dates;
- study/protocol version at the time of decision;
- permitted purposes and data categories;
- withdrawal effect on future collection, active views, exports, and retention;
- re-consent rules when a protocol or consent version changes.

Enrollment must remain study-scoped and consent-gated. A role or study membership is not consent, and consent does not grant staff authorization to access a case.

#### Workstream C — access control and minimum necessary

Formalize an authorization matrix across role, specialist team, study membership, case assignment/handoff, document required role, signer role, and action. Test every read and write route with:

- unauthenticated caller;
- client viewing own record;
- client attempting another client’s record;
- assigned specialist;
- unassigned specialist;
- care coordinator;
- researcher with and without study membership;
- admin;
- deactivated user;
- expired session.

Use deny-by-default repository methods such as `getCaseForSession`, `listStudyParticipantsForSession`, and `getDocumentForCaseAccess` so authorization cannot be accidentally omitted by a new route.

#### Workstream D — auditability and incident response

Use append-only audit records for authentication changes, consent decisions, enrollment/withdrawal, document status/signature changes, case access-sensitive actions, exports, settings, and privileged administrative actions. Every audit record should include actor, action, target type/id, timestamp, request ID, authorization context, outcome, and a minimal redacted detail set.

Define incident playbooks for unauthorized case access, lost/stolen device, signed-URL leakage, malformed upload, research export error, consent withdrawal failure, and database migration rollback. Preserve evidence without copying protected payloads into logs.

#### Workstream E — retention and deletion

Define retention schedules by record class, then implement scheduled jobs that are authorization-aware and auditable. Research withdrawal should suppress future active research use while preserving only what the approved retention schedule requires. Deleting or anonymizing a participant must not break audit referential integrity or make a historical consent decision uninterpretable.

Use a legal-hold flag or retention exception record where required. Do not implement irreversible deletion until retention, audit, backup, and recovery behavior are approved.

#### Workstream F — security validation

Research and validate:

- dependency and container scanning;
- secret scanning and key rotation;
- TLS and storage encryption configuration;
- CSP, HSTS, cookie, CORS, and CSRF behavior;
- rate limiting and abuse controls;
- SQL injection and dynamic-query tests;
- authorization/IDOR tests;
- upload parser and signed-URL tests;
- backup restore and migration rollback;
- vulnerability disclosure and patch SLAs.

## 8. FHIR-ready schema plan

### 8.1 Interoperability boundary

Do not remodel the operational schema directly into FHIR resources. Instead, add a versioned interoperability layer that maps local records to FHIR R4/R4B resources and preserves local identifiers and provenance.

Recommended mapping:

| ZipShift domain | FHIR projection | Relationship |
|---|---|---|
| Client user/profile | `Patient` | local client identity is the subject; direct identifiers are released only to authorized systems |
| Provider directory | `Organization`, `Location`, `HealthcareService`, `Practitioner`, `PractitionerRole` | directory records become searchable service endpoints and roles |
| Referral case | `ServiceRequest` plus local `CarePlan`/case extension | referral intent and operational case lifecycle remain distinguishable |
| Case task | `Task` | `basedOn`/`focus` links to the referral or care plan; local task remains authoritative for UI workflow |
| YellowBook encounter | `Encounter` | clinical encounter summary with local audit linkage |
| Structured care document | `Consent` or `DocumentReference` | use `Consent` for permissions and `DocumentReference` for a document artifact |
| Uploaded PDF/signature | `DocumentReference` + external binary/object reference | keep bytes in managed storage; use signed access and content hash |
| Care-team handoff | `Task` or `CarePlan.activity` | receiving team and status are represented with provenance and local extension |
| Study | `ResearchStudy` | protocol and lifecycle projection |
| Participant control | `ResearchSubject` | study-scoped subject reference; local pseudonym is not a universal patient identifier |
| Assessment response | `QuestionnaireResponse`, with derived `Observation` where clinically appropriate | preserve instrument version and scoring provenance |
| Case event/audit | `Provenance` and/or `AuditEvent` | distinguish clinical provenance from security audit events |
| Consent decision | `Consent` | link exact consent-document version and decision/period |

### 8.2 Proposed interoperability tables

Add these tables only after the resource ownership and external exchange requirements are approved:

```sql
CREATE TABLE fhir_resource_links (
  id CHAR(36) NOT NULL PRIMARY KEY,
  local_entity_type VARCHAR(80) NOT NULL,
  local_entity_id CHAR(36) NOT NULL,
  fhir_resource_type VARCHAR(80) NOT NULL,
  fhir_resource_id VARCHAR(128) NOT NULL,
  profile_url VARCHAR(255) NULL,
  version_id VARCHAR(80) NULL,
  last_local_revision BIGINT NULL,
  last_fhir_updated_at BIGINT NULL,
  sync_state VARCHAR(30) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE KEY uq_fhir_link_local (local_entity_type, local_entity_id, fhir_resource_type),
  UNIQUE KEY uq_fhir_link_external (fhir_resource_type, fhir_resource_id),
  INDEX idx_fhir_link_state_time (sync_state, updated_at)
);

CREATE TABLE fhir_sync_outbox (
  id CHAR(36) NOT NULL PRIMARY KEY,
  idempotency_key VARCHAR(160) NOT NULL,
  local_entity_type VARCHAR(80) NOT NULL,
  local_entity_id CHAR(36) NOT NULL,
  fhir_resource_type VARCHAR(80) NOT NULL,
  operation VARCHAR(20) NOT NULL,
  payload_version VARCHAR(40) NOT NULL,
  payload_json JSON NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  available_at BIGINT NOT NULL,
  locked_at BIGINT NULL,
  completed_at BIGINT NULL,
  last_error_code VARCHAR(80) NULL,
  last_error_redacted TEXT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_fhir_outbox_idempotency (idempotency_key),
  INDEX idx_fhir_outbox_ready (available_at, completed_at, id),
  INDEX idx_fhir_outbox_entity (local_entity_type, local_entity_id, created_at)
);

CREATE TABLE fhir_sync_errors (
  id CHAR(36) NOT NULL PRIMARY KEY,
  outbox_id CHAR(36) NOT NULL,
  http_status INT NULL,
  error_class VARCHAR(100) NOT NULL,
  redacted_diagnostics TEXT NULL,
  retryable BOOLEAN NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_fhir_errors_outbox_time (outbox_id, created_at)
);
```

Foreign keys and engine-specific JSON types must be added through the same verified MySQL-to-Cockroach migration process. Do not store access tokens, full external payloads containing unnecessary PHI, or signed storage URLs in the outbox.

### 8.3 FHIR mapping requirements

Each projection should define:

- a stable local identifier and external FHIR identifier mapping;
- canonical profile URL and version;
- `meta.security` labels for sensitivity and purpose of use;
- `meta.source` or `Provenance` linkage to the local actor and request;
- status mapping and allowed state transitions;
- reference integrity (`Patient`, `Organization`, `PractitionerRole`, `CarePlan`, `Encounter`, `ResearchStudy`);
- last-write/version behavior and conflict resolution;
- redaction rules for client-facing versus research-facing exchange;
- retry and idempotency behavior for create/update/delete;
- audit records for every outbound and inbound exchange.

Use conditional updates with ETags or version identifiers where the receiving FHIR server supports them. Never blindly overwrite a newer external version. Treat an external FHIR response as untrusted input: validate resource type, profile, references, cardinalities, coding systems, and maximum payload sizes.

### 8.4 FHIR research plan

The first research interoperability slice should be read-only and de-identified where possible:

1. Map `studies` to `ResearchStudy` metadata.
2. Map consent documents and decisions to versioned `Consent` resources.
3. Map `research_participant_controls` to `ResearchSubject` using a study-scoped pseudonym.
4. Map approved assessment instruments to `Questionnaire` and responses to `QuestionnaireResponse`.
5. Map selected derived scores to `Observation` only when the clinical meaning, provenance, unit, and interpretation are explicit.
6. Publish `Provenance` for generated research resources and `AuditEvent` for exchange/access security events.
7. Add a formal data-use/purpose-of-use check before any export or external push.

A direct-identifier `Patient` link should be created only for an approved exchange purpose and authorization context. Research pseudonyms must not be reused as global patient identifiers.

## 9. Acceptance criteria and verification gates

### Performance

- Candidate index migrations are validated against production-like row counts and do not create redundant indexes.
- Keyset queries use the intended composite index in `EXPLAIN` plans.
- P95 latency and rows examined improve for the baseline endpoints at representative page depths.
- Cursor pagination returns no duplicates or gaps under concurrent inserts and updates.
- Legacy and cursor response contracts are covered during the migration window.

### Security

- `/api/events` rejects unauthenticated calls, unauthorized case IDs, unknown event types, oversized payloads, malformed idempotency keys, and replayed conflicting requests.
- Case, study, document, signature, and export authorization tests cover positive and negative role/scope combinations.
- CSRF/origin, cookie, rate-limit, signed-URL, upload, and security-header tests pass.
- Logs and audit records contain request IDs and no secrets, raw signed URLs, document bytes, or unnecessary PHI.

### Transactions

- All listed multi-write workflows roll back on injected failure.
- Duplicate and concurrent requests are idempotent where promised.
- Object-storage orphan cleanup is observable and bounded.
- Cockroach transaction retry behavior is implemented in the database adapter, not by replaying HTTP handlers.

### Compliance and FHIR readiness

- A reviewed data inventory and retention matrix exists.
- Consent, withdrawal, study membership, case access, and minimum-necessary policies are documented and tested independently.
- FHIR mappings have profile/version decisions, provenance, identifier policy, and redaction rules.
- Outbound exchange is disabled by default until credentials, endpoint trust, purpose-of-use, consent, and audit requirements are approved.
- IRB/privacy/security review gates are recorded before enabling new research collection or external FHIR exchange.
