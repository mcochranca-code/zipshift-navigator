# Drop-off audit and access outcomes (SDOH)

**Goal.** ZipShift should show whether people experiencing homelessness actually reach the services they are referred to, how long that takes, and what blocks them. Housing status is the social-determinant-of-health exposure. The referral outcome and its barriers are the access outcome.

**Method.** This is a heuristic review of the code on `hark/a11y-ux-motion`, covering every role: client, staff/care team, field ops, and researcher/admin. No production analytics were available. The existing `field_test_events` table now also records `resource_share`, `resource_save`, `before_you_go_open`, `directions_handoff` and `search_no_results`, so these hypotheses can be checked against real funnel counts.

## Ranked drop-off risks

Risks are ordered by how directly they stop someone from reaching a service.

| # | Risk (where) | Why it blocks access | Status |
|---|---|---|---|
| 1 | **False hours and verification** (`Home.tsx` `getStatusLabel`, detail, Before you go). Every listing that wasn't 24/7 showed "Open · Closes 5:00 PM", and every listing showed "Verified". | People make a trip to a closed or unverified place. For someone on foot or on the bus, that trip costs a day. | **Fixed.** `shared/providerAccess.ts` parses only unambiguous schedules. Anything else says "Call to confirm hours". The verified badge follows `verification_status`, and the "Open now" filter only matches confirmed hours. |
| 2 | **Half the directory never appeared in search** (`filteredProviders`). Providers missing from the hard-coded `DISTANCES` map were treated as 999 miles away. | 20 of 40 listings were hidden, including every listing that says no ID is needed. | **Fixed.** Unknown distance no longer hides a listing, and "Any distance" hides nothing. Covered by a test that expects all 40. |
| 3 | **Fabricated directions** (`directions` screen). The same bus route ("Route 6", Sisk Rd, 9:48 AM) and the same times appeared for every provider. | Transit-dependent people were given a wrong route. | **Fixed.** The screen now shows the real address in large type, with copy and call buttons, and hands off to Google Maps for bus, walking, car or bike. The detail-page route panel gained Bus and Walking options. |
| 4 | **No closed loop.** A referral marked "completed" said nothing about whether the person got the service. Nothing recorded barriers or time to connection, and Navigator "advance" could close a case without an outcome. | The core research question can't be answered, and staff never learn why people fall out. | **Fixed.** There is now a `referral_access_outcomes` ledger (connected / not connected / lost contact). Barriers are structured, and at least one is required when someone was not connected. `connected_at` gives time to connection. Moving a case from pending to completed opens the outcome form instead of closing silently. Clients can answer "Did you get the help?" themselves. |
| 5 | **The referral flow assumes a phone.** Get Help asked for a phone and date of birth (the DOB was never sent), never showed the referral ID, and promised a call back. The `IntakeFormFlow` alert dropped the ID too. | People with no phone, or a shared phone, become unreachable after intake. | **Fixed.** There is a contact-preference choice: call, text, shared phone with no details, case manager or shelter, or no phone and check back with a code. A phone is only asked for when it's needed. The referral code is shown and kept on the device unless shared-phone mode is on. DOB was removed from Get Help. |
| 6 | **First open lands on a staff screen.** Visitors who weren't signed in were sent to "Authorized portals" (Researcher, Admin Partner…), and the client Get Help screen showed Admin and Researcher buttons. | Someone looking for help hits a staff screen or a login wall. | **Fixed.** Visitors land on the public navigator. Staff reach the selector through "Staff sign-in" or `?screen=role-portal`. |
| 7 | **Before you go was generic and put ID first.** It said "Photo ID" for every provider and never showed what that provider actually requires or accepts instead. There was also no way to find places that need no ID or accept walk-ins. | People without ID self-select out. | **Fixed.** The checklist now comes from `documents_required`, with a "You can go even if you don't have ID" banner and the provider's own "No ID? Ask about" alternatives. Quick filters for walk-ins OK, no ID needed and open now are backed only by listing data. There is no "no mailing address" filter because the data has no such field. |
| 8 | **Stale referrals go unnoticed.** Nothing prompted staff when a referral went quiet. | The person waits, gives up, and the outcome is never recorded. | **Fixed.** Follow-up windows are set by priority (urgent 1 day, high 2, standard 3, low 7). Dispatch shows a "needs follow-up" banner, filter and column, and the care team gets notifications. |
| 9 | **Field ops tools are prototypes.** The offline queue is cleared on reconnect instead of replayed, the tools use a hard-coded case `ZS-1042`, and nothing reaches the API. | Outreach work done offline with unsheltered clients is lost. | **Not fixed.** This needs a backend design for each tool. See "Not done". |

Other friction fixed along the way:

- Empty search state now offers "Clear filters" and "Call 211". The dead "Sort ›" button is gone.
- Larger tap targets on result cards, with walk-in and no-ID badges.
- A share button sends name, address, phone and hours as plain text that works over SMS.
- Saved places persist without an account and move into the account at sign-in.
- "Pick up where you left off" card on the home screen.
- Language and large-text settings persist between visits.
- Low-data mode hides the promo video and logos. It switches on automatically when the browser's Save-Data setting is on.
- Shared-phone mode keeps saved places, history and the referral code off the device, and there is a "Clear this phone" button.
- In `IntakeFormFlow`, only a first name or nickname is required. Last name, DOB and housing are optional.

## Data model (migration `20261106_add_access_outcomes_and_housing_status.sql`)

- `referral_cases.housing_status`: HUD-aligned values `unsheltered`, `emergency_shelter`, `transitional_housing`, `doubled_up`, `at_risk`, `housed`, `prefer_not_to_say`. Also `housing_status_updated_at` and `sdoh_consent`.
- `referral_cases.contact_preference`.
- `referral_cases.access_outcome` and `connected_at`: the current outcome, denormalized.
- `referral_access_outcomes`: an append-only ledger with columns `outcome`, `barriers_json`, `housing_status_snapshot`, `connected_at`, `source` (staff or client), `recorded_by`, `recorded_by_role` and `created_at`.
- Barrier codes: `no_transport`, `no_id`, `no_phone`, `no_address`, `hours`, `eligibility`, `waitlist`, `cost`, `documentation`, `safety`, `stigma`, `language`, `other`.

## Metrics (`GET /api/research/access-outcomes`, `…/access-outcomes.csv`)

For each housing status, and for the comparison between people experiencing homelessness (unsheltered, shelter, transitional, doubled-up) and people housed or at risk:

- referrals
- connected, not connected, lost contact, no outcome yet
- connection rate (connected ÷ referrals with an outcome)
- median days to connection
- how often each barrier was recorded

Each referral counts once, by its latest outcome. Housing status is taken as it was at the time of the outcome.

## Privacy safeguards

- Housing status is optional, always offers "prefer not to say", and is stored only with a separate SDOH consent. Withdrawing that consent clears the value.
- Writes (outcomes and housing) are limited to admins and staff with a care-team `specialist_role`. Researchers without one cannot record outcomes or read individual outcome history.
- Research output is aggregate only. Cells of 1–10 are suppressed, with complementary suppression across outcome cells and across housing groups. Rates and medians are hidden when any count they depend on is suppressed. The CSV holds aggregate cells only, and each download is logged in `generated_reports`.
- The client-visible timeline note is neutral ("Referral follow-up recorded"), and barrier codes stay in event data.

## Researcher access lockdown

Three access tiers, from `shared/accessPolicy.ts`:

| Tier | Account | Identified referral data and referral writes |
| --- | --- | --- |
| admin | role `admin` | yes |
| care team | role `researcher` with a `specialist_role` | yes |
| researcher | role `researcher` with no `specialist_role` | no |

- **Enforced on the server, before any handler.** `server/researchAccess.ts` holds an allowlist. A research-only session can reach public reference data, its own session and profile, de-identified aggregates (Access outcomes view and CSV, report summary, ZIP demand, field-test counts), and pseudonymous study records for studies it belongs to. Every other `/api` route returns 403, including any route added later, until someone allowlists it on purpose. Handlers keep their own checks as a second layer (`requireIdentifiedStaff`, `requireCareTeam`, `canAccessCase`).
- **Row-level research data is pseudonymous.** The study participant list gives research-only accounts `caseNumber: null` and a `participantKey`, which is HMAC-SHA256 of the case ID under `RESEARCH_PSEUDONYM_SECRET`. Enrolling a case in a study needs the identified referral, so only admins and care-team staff can do it.
- **Every export is audited.** `admin_audit_log` gets a `DATA_EXPORTED` row for each export, with the export type, the actor's role and tier, whether the export holds identifiers, the row count, and the filters, never client data. This covers the case CSV, the aggregate outcomes CSV, the pseudonymous study CSV, the YellowBook PDF, and care-portal PDF downloads.
- **The UI matches the server.** Research-only accounts see Analytics, Access outcomes, Research and Reports. Cases, Navigator, YellowBook, the case CSV button, study enrollment, the case-number column, and the care-workspace shortcuts are hidden.
- **Tests.** `server/researchAccess.test.ts` reads every route from `server/index.ts` and fails if the researcher allowlist changes without the test changing too. `server/researcherLockdown.test.ts` runs the real app against an in-memory database. It checks that a researcher gets 403 on every non-allowlisted route, that the aggregate and study exports contain no names, contact details, DOB, addresses, notes, case numbers or case IDs, and that each export writes an audit row.

Set `RESEARCH_PSEUDONYM_SECRET` (32+ random bytes) in production. Without it, a per-process secret is used, so the IDs never reveal a case ID but change on every restart.

## Not done / for the owner

- `getDistanceLabel` still uses hard-coded distances and shows "2.0 mi" when unknown. The "~min drive" estimate assumes 30 mph. Both should be computed from the user's location or hidden.
- No public status lookup by referral code. It would need rate limiting and a privacy review, because a lookup confirms that someone sought help.
- The field-ops offline queue (risk 9).
- The SDOH consent is a checkbox, not a versioned consent document like research participation. Decide whether it should be one. An IRB or data-use agreement may also be needed before publishing.
- HUD mapping is approximate. "Doubled-up" counts as homelessness under McKinney-Vento, not under HUD Category 1.
- Research-only accounts can still record PHQ-9/PRAPARE assessments and set retention or withdrawal on pseudonymous study participants. These are research records, not referral edits. PRAPARE responses are free-form JSON, though, so staff could type identifying text into them. Consider restricting PRAPARE to coded answers.
- The report summary's per-status case counts and the field-test counts are not small-cell suppressed. They are system-wide totals with no demographic breakdown.
- The migration has not been applied anywhere. The DB integration tests are skipped without a database.
