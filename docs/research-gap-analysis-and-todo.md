# ZipShift Navigator Research-Focus Gaps Analysis and Todo List

**Date:** 2026-09-30  
**Scope:** Current ZipShift Navigator application, with emphasis on research readiness, ethical data handling, operational validity, and reproducible reporting.

## Executive conclusion

ZipShift Navigator has a strong operational base. It supports authenticated client and staff workspaces, referral cases, resource directories, access feedback, YellowBook encounters, aggregate ZIP-demand reporting, role-based administration, audit logs, and CSV/PDF exports.

The main gap is that the application is currently **research-informed rather than research-ready**. It captures service activity and access barriers, but it does not yet define a study, version its instruments and consent language, preserve a formal data dictionary, manage data-quality review, support longitudinal cohort analysis, or produce reproducible de-identified research packages. These gaps should be addressed before the system is used to support formal evaluation, publication, grant reporting, or human-subjects research.

## Current capability baseline

The following capabilities are already present and should be preserved:

- Role-gated client, researcher, and administrator workspaces.
- Database-backed sessions, profiles, cases, case events, feedback, saved resources, notifications, and YellowBook encounters.
- County and emergency resource directories with search, maps, geocoding, source fields, verification indicators, and exports.
- Intake consent capture and access-barrier feedback.
- Aggregate ZIP-demand reporting with a minimum cohort threshold of three.
- Staff case status, priority, resolution notes, referral exports, and encounter PDF export.
- Administrator account controls, content editing, global appearance editing, undo history, and audit records.
- Automated tests for auth, workflow rules, directory data, analytics, PDFs, screen coverage, and staff authorization.

## Priority gaps

### P0 — Required before formal research use

#### 1. Study and protocol management

**Gap:** There is no study/project entity that defines the research question, population, sites, enrollment dates, protocol version, investigator ownership, or reporting status. The current case model is operational and does not distinguish routine service delivery from research participation.

**Risk:** Analysts cannot reliably determine which records belong to a study, which protocol was active, or whether an analysis population was defined prospectively.

**Todo:** Add `studies`, `study_sites`, and `study_memberships` or an equivalent scoped-study model. Add study selection to staff workflows and require every research export to declare a study and protocol version.

**Acceptance criteria:**

- An administrator can create, archive, and version a study.
- A researcher can only view records for assigned studies or approved scopes.
- Every study has a protocol version, owner, status, start date, and end date.
- Study scope is enforced server-side, not only hidden in the UI.

#### 2. Versioned consent and participant authorization

**Gap:** Intake stores a boolean `consent` value and free-form handoff data. Privacy and consent notices are rendered as current notifications rather than versioned agreements. There is no consent purpose, language, timestamped version, withdrawal state, or re-consent flow.

**Risk:** The system cannot demonstrate what a participant agreed to, for which purpose, in which language, or whether consent was later withdrawn.

**Todo:** Create versioned consent documents and participant consent records. Separate service consent from research consent, data-use consent, contact consent, and future-use consent. Add withdrawal and re-consent workflows.

**Acceptance criteria:**

- Each consent record stores document version, purpose, language, timestamp, actor, and source context.
- Withdrawal prevents future research use while preserving an auditable historical record.
- A participant can review active consents and withdraw or renew them.
- Exports exclude records without the required consent purpose.

#### 3. Research data dictionary and provenance

**Gap:** Fields such as HSAI scores, access outcomes, barriers, transit feasibility, and resource verification are used in the UI and reports, but there is no central definition of their meaning, allowed values, collection method, unit, provenance, or version.

**Risk:** Different staff or analysts may interpret the same field differently. Published results would be difficult to reproduce.

**Todo:** Add a data dictionary and provenance registry. Link report fields and instruments to dictionary entries. Document transformations from supplied CSVs and imported resource data.

**Acceptance criteria:**

- Every research-exported field has a label, definition, type, allowed values, source, and sensitivity classification.
- Derived values identify their formula and source fields.
- Resource records retain source file, source row or identifier, import timestamp, geocoding method, and verification status.
- Dictionary changes create versions rather than silently changing definitions.

#### 4. De-identification and disclosure control

**Gap:** Staff exports currently include case-level operational data. The ZIP-demand report suppresses cohorts below three, but there is no general de-identification policy, small-cell suppression across all dimensions, date-shifting option, pseudonymous subject key, or export review step.

**Risk:** A legitimate research export could disclose identity through combinations of names, dates, ZIP codes, free text, or rare categories.

**Todo:** Build a research export service that applies field-level suppression, pseudonymization, minimum-cell rules, free-text handling, and export approval. Keep operational exports separate from research exports.

**Acceptance criteria:**

- Research exports never include names, direct contact fields, or unrestricted narrative by default.
- Small cells are suppressed across configured dimensions, not only ZIP demand.
- Every export records requester, study, purpose, filters, fields, suppression rules, row count, and checksum.
- A reviewer can approve or reject an export before download when the study requires it.

#### 5. Data-quality and missingness workflow

**Gap:** Directory records expose verification indicators, but there is no systematic quality dashboard for case completeness, missing consent metadata, invalid values, duplicate participants, stale resources, or inconsistent event sequences.

**Risk:** Research findings may reflect data-entry gaps or resource staleness rather than real access patterns.

**Todo:** Add configurable validation rules, a quality queue, missingness summaries, duplicate detection, and resolution ownership.

**Acceptance criteria:**

- Researchers can see completeness and missingness by field, study, site, and time period.
- Invalid values and impossible event sequences are flagged without being silently rewritten.
- Each issue has status, owner, note, and resolution timestamp.
- Resource records have a freshness threshold and next-review date.

### P1 — Required for credible longitudinal and mixed-methods analysis

#### 6. Longitudinal participant and encounter model

**Gap:** Cases and YellowBook encounters provide a useful event ledger, but there is no stable research subject identifier, enrollment status, follow-up schedule, repeated-measures structure, or explicit baseline/follow-up relationship.

**Todo:** Add a pseudonymous participant key, enrollment and visit entities, scheduled follow-ups, outcome timepoints, and loss-to-follow-up reasons.

**Acceptance criteria:**

- One participant can have multiple cases and encounters without duplicating the research identity.
- Baseline, follow-up, and exit measures are distinguishable.
- Staff can record contact attempts and follow-up disposition.
- Analysts can export a visit-level table and a participant-level table separately.

#### 7. Instrument and form versioning

**Gap:** Intake, feedback, HSAI domains, and YellowBook fields are hard-coded in components. There is no instrument catalog, question version, response validation metadata, skip logic, or change history.

**Todo:** Create versioned research instruments with question definitions, response types, requiredness, skip logic, translations, and publication status. Preserve the instrument version on every response.

**Acceptance criteria:**

- Administrators can draft, publish, retire, and clone an instrument version.
- Existing responses remain linked to the version used at collection time.
- Spanish and English labels are stored with the instrument version.
- Question changes do not mutate historical answers.

#### 8. Cohort builder and reproducible analysis filters

**Gap:** Reporting is mostly fixed summary cards, status distributions, event counts, ZIP demand, and CSV export. There is no saved cohort definition, date range control, multi-variable filter, or analysis snapshot.

**Todo:** Add a cohort builder with saved filter definitions and an analysis snapshot that records the exact query, dictionary version, consent rule, suppression rule, and generated timestamp.

**Acceptance criteria:**

- Researchers can filter by study, site, enrollment period, service category, consent status, outcome, and instrument version.
- A saved cohort can be rerun or cloned.
- Dashboard results and exports use the same server-side query definition.
- Snapshots show the record count and suppression decisions used.

#### 9. Mixed-methods notes and qualitative coding

**Gap:** Free-text situation, narrative, service notes, and resolution notes are captured, but there is no structured coding workflow, codebook, inter-rater review, or separation between operational notes and research data.

**Todo:** Add an optional qualitative module with a versioned codebook, coded excerpts, coder identity, adjudication status, and redaction controls.

**Acceptance criteria:**

- Research notes can be separated from operational case notes.
- Coded excerpts do not expose direct identifiers in research exports.
- Codebook versions and coder actions are auditable.
- Two coders can independently code the same excerpt and resolve disagreement.

#### 10. Research dashboards and uncertainty-aware metrics

**Gap:** Current dashboards show counts and completion rates but not denominators, confidence intervals, missingness, subgroup comparisons, trends over time, or warnings when a metric is underpowered.

**Todo:** Add time-series and subgroup views with denominators, suppressed-cell handling, confidence intervals where appropriate, and explicit “descriptive only” labels for small samples.

**Acceptance criteria:**

- Every metric displays numerator, denominator, timeframe, and inclusion rule.
- Small or unstable estimates are labeled and suppressed according to study settings.
- Analysts can export the underlying aggregated data used for a chart.
- Charts have accessible text equivalents and CSV download.

### P1 — Governance, security, and operational trust

#### 11. Research role separation and least privilege

**Gap:** Roles are currently client, researcher, and admin. The researcher role is broad and there is no study-specific permission model, data steward role, export reviewer role, or separation between content editing and participant-data access.

**Todo:** Introduce scoped permissions such as study researcher, data steward, export reviewer, and content editor. Apply permissions to endpoints and exports.

**Acceptance criteria:**

- A content editor cannot automatically access participant-level data.
- A researcher cannot manage users or global appearance settings.
- Export approval is separate from export creation when configured.
- Forbidden access attempts are recorded with endpoint and scope.

#### 12. Audit completeness and tamper evidence

**Gap:** Admin actions and selected case events are logged, but research reads, exports, consent changes, instrument changes, and data-quality actions are not consistently represented. Audit rows are not chained or checksummed.

**Todo:** Expand the audit taxonomy and add immutable event metadata, request correlation IDs, actor scope, reason, before/after references, and optional hash chaining.

**Acceptance criteria:**

- Sensitive reads and exports are auditable.
- Every mutation includes actor, role, reason or workflow context, target, timestamp, and result.
- Audit records cannot be edited through application endpoints.
- Administrators can filter and export audit records without exposing narrative content unnecessarily.

#### 13. Retention, archival, and participant rights

**Gap:** There is no documented retention schedule, automated archival, deletion/anonymization workflow, data-access request workflow, or legal hold mechanism.

**Todo:** Add configurable retention rules by study and record type. Support participant access requests, correction requests, withdrawal, anonymization, archival, and legal hold.

**Acceptance criteria:**

- Retention rules are visible to administrators and versioned.
- Destructive actions require a reason and produce an audit event.
- Anonymization removes direct identifiers while preserving allowed aggregates.
- Legal holds prevent automatic deletion.

#### 14. Security hardening and session operations

**Gap:** Password reset and seven-day sessions exist, but the research deployment still needs documented rate limiting, login attempt monitoring, MFA or step-up authentication for administrators, session inventory, and CSRF/security-header review.

**Todo:** Add administrator step-up authentication, session inventory and revocation, login throttling, suspicious-login alerts, and a security configuration review.

**Acceptance criteria:**

- Administrators can view and revoke active sessions.
- Repeated login failures are throttled and audited.
- High-impact actions require step-up verification when configured.
- Security headers and cookie attributes are tested in production-like environments.

### P2 — Product quality and scale

#### 15. Offline-first and synchronization behavior

**Gap:** The product is described as a PWA, but the core research workflows do not yet have an explicit offline queue, conflict resolution policy, or visible sync state.

**Todo:** Define offline support for resource lookup, intake drafts, and encounter notes. Add queued writes, retry behavior, conflict handling, and user-visible sync status.

#### 16. Resource stewardship and verification workflow

**Gap:** Resource data includes verified flags and source fields, but future CSV import, deduplication, provider change review, and expiration workflows are not complete.

**Todo:** Add staged imports, field-level diffs, duplicate matching, approval, rollback, provider verification reminders, and geocode confidence review.

#### 17. Accessibility and language validation

**Gap:** The interface has accessibility work such as focus trapping and responsive navigation, and Spanish labels exist in several areas. However, there is no automated WCAG regression suite or translation completeness check for research instruments, errors, exports, and admin screens.

**Todo:** Add keyboard and screen-reader regression coverage, contrast checks, reduced-motion checks, translation key coverage, and bilingual PDF/export verification.

#### 18. Observability and release controls

**Gap:** Health checks and tests exist, but there is no research-specific monitoring for failed exports, stale resources, consent errors, data-quality backlog, or schema migration status.

**Todo:** Add structured application events, error tracking, export job status, data-quality alerts, migration checks, and a release checklist for study-impacting changes.

## Recommended implementation order

### Phase 1: Establish research governance

1. Study and protocol management.
2. Versioned consent and participant authorization.
3. Research roles and least-privilege scopes.
4. Data dictionary and provenance registry.
5. Research export service with de-identification and disclosure control.
6. Expanded audit taxonomy.

### Phase 2: Make the data analyzable

7. Data-quality dashboard and issue queue.
8. Instrument and form versioning.
9. Longitudinal participant and encounter model.
10. Cohort builder and reproducible analysis snapshots.
11. Research dashboards with denominators and uncertainty labels.

### Phase 3: Complete trust and scale controls

12. Retention, archival, participant rights, and legal holds.
13. Administrator step-up authentication and session operations.
14. Resource import stewardship and verification lifecycle.
15. Offline synchronization and conflict handling.
16. Accessibility, bilingual, observability, and release hardening.

## Suggested first sprint

The highest-value first sprint should not add more dashboard cards. It should establish the boundaries that make later analysis trustworthy:

- Create the study, protocol-version, and study-scope tables.
- Create versioned consent documents and purpose-specific participant consent records.
- Define the first data dictionary for cases, feedback, HSAI domains, resources, and events.
- Split operational CSV export from a reviewed, de-identified research export.
- Add audit events for consent changes, research reads, export creation, export approval, and dictionary changes.
- Add integration tests proving that a researcher cannot cross study scope and that an export omits direct identifiers.

## Definition of research readiness

ZipShift Navigator should be considered research-ready only when a reviewer can answer all of the following without relying on undocumented assumptions:

1. What study and protocol version produced this record?
2. What did the participant consent to, in which language and at what time?
3. Which instrument version produced each response?
4. What does every exported field mean, and how was it derived?
5. Who could access, change, or export the data?
6. Which records were excluded, suppressed, anonymized, or missing?
7. Can the reported result be reproduced from a saved cohort and analysis snapshot?
8. What retention, withdrawal, correction, and deletion rules apply?

## References

[1]: /home/ubuntu/zipshift-navigator-published/server/index.ts "ZipShift Navigator server routes, authorization, data capture, reporting, and audit implementation"
[2]: /home/ubuntu/zipshift-navigator-published/server/workflowRules.ts "ZipShift Navigator workflow validation and export rules"
[3]: /home/ubuntu/zipshift-navigator-published/client/src/components/StaffWorkspace.tsx "ZipShift Navigator staff workspace, analytics, cases, directories, and reports"
[4]: /home/ubuntu/zipshift-navigator-published/client/src/components/YellowBookEncounter.tsx "ZipShift Navigator case-linked encounter workflow"
[5]: /home/ubuntu/zipshift-navigator-published/server/api.integration.test.ts "ZipShift Navigator authenticated API workflow coverage"
[6]: /home/ubuntu/zipshift-navigator-published/server/migrations/20260911_add_admin_control_center.sql "ZipShift Navigator administrative pages and audit schema"
[7]: /home/ubuntu/zipshift-navigator-published/server/migrations/20260904_add_auth_safeguards.sql "ZipShift Navigator authentication safeguard schema"
