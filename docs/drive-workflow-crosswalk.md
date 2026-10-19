# Drive Workflow Crosswalk

## Reconciliation scope

This crosswalk was reconciled against the current ZipShift source tree, the live client destination registry, the Express API routes, the automated test suite, and the completed project TODO history. It records **implementation evidence**, not visual pixel parity with the supplied Drive or Figma assets. The Drive screenshots remain workflow references; their iOS visual treatment is not imported. ZipShift continues to use the navy-and-teal clinical design system, role-based sessions, MySQL-backed records, responsive client/staff shells, and a non-emoji clinical interface.

Status meanings are intentionally strict: **Verified** means the workflow is represented in source and supported by a live route, API, or automated contract; **Partial** means the principal state exists but one or more persistence, browser, or end-to-end assertions remain; **Not evidenced** means the current source review did not establish the required behavior; **Excluded** means the workflow is intentionally not part of ZipShift.

## Reconciled crosswalk

| Drive workflow state | Current ZipShift destination or API | Evidence reviewed | Status | Reconciliation decision |
|---|---|---|---|---|
| Splash and onboarding | Home splash state and client shell | `Home.tsx` splash branch; screen coverage registry | Verified | Preserve the existing splash/loading state and accessibility-aware client shell. |
| Search, categories, and covered-ZIP filters | Home, Search Results, Map, covered-ZIP selector | `Home.tsx`; `ZipShiftMap.tsx`; screen coverage tests | Verified | Keep canonical resource taxonomy and privacy-preserving aggregate ZIP demand collection. |
| Resource list and selected detail | Search Results, Resource Detail, Client Directory | Provider data, route branches, live provider API/data integration | Verified | Use canonical provider records, verified status, hours, service days, directions, and provenance. |
| Before You Go checklist | Before You Go | `Home.tsx` live checklist branch | Verified | Retain checklist persistence and route escape paths. |
| Transit directions | Directions and Map | Directions/Map branches and provider coordinates | Verified | Preserve exact provider coordinates and route actions. |
| Saved/Favorites | Favorites, Client Profile, saved-resource API | `ClientProfile.tsx`; saved-resource persistence tests and API | Verified | Continue using database-backed saved resources for signed-in clients. |
| Profile and Help | Client Profile, Get Help, Notifications | `ClientProfile.tsx`; `NotificationCenter.tsx`; `/api/notifications` | Verified | Keep client history, notification read states, and profile escape routes functional. |
| Referral destination list | `referral-destination` and `ReferralDestinationFlow` select state | `ReferralDestinationFlow.tsx` states `select`, list rendering, canonical providers | Verified | Use the canonical directory and the current AOR service context. |
| Selected destination detail | `ReferralDestinationFlow` detail state | Detail branch with address, phone, hours, service categories, and change-selection action | Verified | Keep destination summary and referral context together. |
| Referral search and map/list hybrid | `ReferralDestinationFlow` search plus list/map toggle | `query`, `filteredProviders`, `view`, `ZipShiftMap` integration | Verified | Reuse provider search and map state rather than duplicating directory data. |
| No results | Empty provider-list branch in referral flow | `ReferralDestinationFlow.tsx` filtered-list empty state | Partial | The state exists; add dedicated automated assertions for recovery copy and actions if release evidence requires it. |
| Resource unavailable / service not offered | `unavailable` and `mismatch` states | `isUnavailable`, `serviceMatches`, recovery and save-for-later actions | Verified | Preserve the referral draft while offering another-resource, save, and back paths. |
| Confirm and continue | `confirm` state and AOR handoff transition | Confirm branch; explicit Continue/Start AOR handoff actions | Verified | Confirmation precedes handoff; final case creation remains behind consent and submission. |
| Change selection | Detail/confirmation `Change selection` actions | `setState("select")` and `setState("detail")` transitions | Verified | Permit replacement before final submission. |
| Save for later | `saved` state and local referral draft | `saveForLater`; `localStorage` draft; saved-state branch | Partial | The interaction is live and preserves a local draft; it is not yet proven as server/database-backed referral-draft persistence. |
| Referral detail and timeline | Referral History, notifications, case-event ledger | `ReferralHistory.tsx`; `/api/cases/mine`; `/api/notifications`; event writes | Verified | Use live case events and notification data for client history. |
| Share referral / email / copy link | No dedicated share endpoint or verified route identified | Current source review and crosswalk history | Not evidenced | Do not claim this as implemented. Add a minimum-necessary share flow only after defining authorization and redaction rules. |
| Service initiated / client contacted | Case events and notifications | `case_events` writes; `/api/notifications` event labels | Partial | Core live events exist; a complete user-facing taxonomy for every service-contact state is not separately evidenced. |
| AOR outcome picker | Get Help handoff and YellowBook/staff workflow | `HandoffData.outcome`; structured handoff persistence; staff workspace | Verified | Preserve confirmed, needs-review, not-reached, and service-unavailable outcomes. |
| Failure reason picker | AOR handoff failure/follow-up field | `HandoffData.failureReason`; API handoff payload | Partial | Structured capture exists, but the current UI uses free text rather than a controlled taxonomy. |
| Document burden capture | AOR handoff document burden field | `HandoffData.documentBurden` with none/light/high values | Verified | Retain structured burden values in the handoff payload and case context. |
| Transit feasibility capture | AOR handoff transit feasibility field | `HandoffData.transitFeasibility` with not-assessed/feasible/limited values | Verified | Keep encounter-level feasibility separate from directory transit metadata. |
| Review and submit | AOR handoff review and `/api/intake` case creation | Review confirmation checkbox; intake endpoint; case-event writes | Verified | Require explicit review and consent before final case creation. |
| Easy / Not Easy feedback | Feedback screen and `/api/feedback` | `Home.tsx` feedback flow; `access_feedback`; `ACCESS_FEEDBACK_SUBMITTED` event | Verified | Preserve structured barrier tags and optional narrative; feedback is research data, not public review content. |
| Public ratings/testimonials | Not applicable | Content policy and feedback data model | Excluded | Do not add fabricated or public-review content. |
| Ceramic YellowBook encounter | Protected staff workspace, case events, PDF export, audit timeline | `YellowBookEncounter.tsx`; `/api/staff/yellowbook*`; PDF and audit tests | Verified | The current implementation includes Chief Complaint, HSAI progress, encounter/plan fields, privacy mode, pause-safe persistence, client-safe export, updated timestamp, role-only attribution, and recent event history. |
| Figma role portal | `role-portal` destination with Client, Researcher, and Admin Partner workspace cards | `RolePortal.tsx`; `Home.tsx` screen union and route query handling; screen coverage contracts | Verified | The landing surface is live, responsive, accessible, and routes users into the existing client and staff workspaces without inventing role metrics or records. |
| Staff mobile navigation tabs | Portal, Intake, Referrals, and Notifications tabs on staff destinations | `RolePortal.tsx`; `StaffIntakeFlow.tsx`; `ReferralsDispatch.tsx`; `Home.tsx` transitions | Verified | The tabs are functional navigation controls with explicit back/portal paths and reduced-motion route transitions. They are documented as supporting staff destinations, not replacements for the ten primary client pages. |
| Connect to ZipShift staff intake | Staff intake, consent, need, barrier, priority, destination, and case-linkage handoff | `StaffIntakeFlow.tsx`; existing `/api/intake` and case/event APIs; screen coverage contracts | Verified | The Figma-inspired handoff is live and uses the existing intake/case workflow. It preserves consent and destination context rather than creating a parallel referral model. |
| Referrals Dispatch | Staff referral list, search/filter controls, KPI summaries, status badges, refresh, and new-referral action | `ReferralsDispatch.tsx`; `staffAuthorization.interaction.test.tsx`; role-gated server responses; responsive visual coverage | Partial | Deterministic interaction coverage now verifies the 403 authorization alert, authorized case/KPI rendering, and a protected status-filter reload. KPI-card behavior and every table action still require authenticated browser evidence against real rows. |
| Notifications and field tools | Notification access plus before-you-go, transit, capacity, share, SOAP, and shift-handoff panels | `FieldOperationsDock.tsx`; field panel components; `NotificationPanel.tsx`; `/api/notifications` | Partial | The dock, privacy toggle, language switch, online/offline state, local mutation queue, and field panels are implemented. The client NotificationCenter remains the source of truth for live persisted notifications; the compact dock notification preview must not be treated as an independent notification ledger. |
| Motion and accessibility | Portal entry, route/tab transitions, drawers, reduced-motion handling, language/accessibility controls | `Home.tsx` route transition effect; `index.css`; field dock responsive styles; screen coverage tests | Verified | Motion is limited to route and workflow transitions, and `prefers-reduced-motion` disables nonessential animation. Clinical no-emoji styling and responsive layout remain the canonical design constraints. |

## Role and privacy handling

Client users can search providers, select and review a destination, save a local referral draft, confirm a destination, submit an intake/referral with consent, view referral history, and receive client-safe notifications. The Connect-to-ZipShift intake endpoint remains intentionally session-permissive but requires a client name, requested service, and documented consent; it does not itself grant access to staff data. Administrators and researchers can access authorized staff workflows, cases, reports, provider verification, and YellowBook encounters according to server-side role checks. Super Admin controls remain restricted to role governance, integrations, and audit operations.

Client-facing outputs use minimum-necessary information. Internal notes, research scores, staff assignments, and direct staff identities must not appear in client share or notification content. YellowBook staff attribution is role-only, and protected encounters mask event notes and actor roles server-side. Small-cohort ZIP demand suppression remains unchanged.

## Evidence and limitations

The route registry establishes the ten primary client destinations: Home/Search, Search Results, Map Search, Resource Detail, Before You Go, Directions, Get Help, Favorites, Client Profile, and Referral History. Supporting destinations include the referral destination flow, notifications, directory, intake, settings, privacy, terms, feedback, and staff workspaces. The prototype/Figma source could not be re-opened for a full authenticated visual walkthrough because of the source login boundary; this crosswalk therefore verifies functional source coverage rather than pixel-perfect visual parity.

The most important remaining evidence gaps are the absence of a dedicated minimum-necessary referral sharing flow, controlled failure-reason taxonomy, database-backed save-for-later draft persistence, browser-level assertions for every referral recovery branch, responsive dispatch assertions, and authenticated browser evidence for every Referrals Dispatch table action. Deterministic DOM coverage now verifies portal navigation, wrong-role workspace blocking without staff-data fetches, authorized workspace loading, dispatch authorization messaging, authorized status-filter reloads, and consent-gated staff intake submission. The dispatch KPI and action claims remain intentionally Partial until an authenticated end-to-end walkthrough against real case rows is captured. These are documentation-correctness findings, not claims that the existing implemented flows are broken.

The latest log review found one historical React warning on **2026-09-01 20:40:27 PDT** for a transition from `padding` to `paddingBottom`. No additional padding/style warning appears after the subsequent fix and the later live portal/browser sessions on **2026-09-05**, **2026-09-07**, or **2026-09-09**. The same later log window does contain repeated `/api/auth/me` proxy failures with `ECONNREFUSED 127.0.0.1:3001`; those are development-server availability errors, not React style warnings, and should be resolved by restarting the local API process before authenticated browser verification.

## Source references

| Reference | Purpose |
|---|---|
| `client/src/pages/Home.tsx` | Primary destination branches, client intake, referral integration, feedback, notifications, and settings. |
| `client/src/components/ReferralDestinationFlow.tsx` | Referral selection state machine, search, map/list toggle, confirmation, handoff, mismatch, unavailable, and save-for-later states. |
| `client/src/components/YellowBookEncounter.tsx` | Protected staff encounter workspace and patient summary/audit timeline integration. |
| `client/src/components/RolePortal.tsx` | Responsive Figma-inspired role portal and staff mobile navigation tabs. |
| `client/src/components/StaffIntakeFlow.tsx` | Staff Connect-to-ZipShift intake and handoff workflow. |
| `client/src/components/ReferralsDispatch.tsx` | Staff referrals dispatch search, filters, KPI summaries, and case actions. |
| `client/src/components/field/FieldOperationsDock.tsx` | Responsive field-tools dock, privacy/language/online state, queue semantics, and operational panels. |
| `server/index.ts` | Authenticated case, intake, notification, feedback, YellowBook, export, and event-ledger APIs. |
| `client/src/lib/screenCoverage.test.tsx` | Deterministic destination and component contract coverage. |
| `client/src/lib/staffAuthorization.interaction.test.tsx` | Deterministic DOM interactions for portal navigation, staff-session role gates, dispatch authorization and filtering, and consent-gated intake submission. |
| `server/api.integration.test.ts` | Role gating, case workflows, YellowBook persistence, export, and trusted attribution coverage. |
| `todo.md` | Project history of completed workflow and release-hardening items. |
| `docs/drive-final-asset-notes.md` | Provenance notes for the supplied Drive workflow references. |
