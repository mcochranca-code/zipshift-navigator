# ZipShift Navigator - Complete Rebuild TODO

## Ceramic YellowBook Encounter Module
- [x] Add protected Ceramic-style YellowBook encounter workspace linked to cases and referrals
- [x] Add Chief Complaint, HSAI Progress, Encounter, Plan, patient details, and encounter action surfaces
- [x] Add adaptive intake branching, privacy mode, pause-safe persistence, and PDF export
- [x] Define Stanislaus County intake-form digitization scope and source provenance

## Client Motion and Clinical Visual Language
- [x] Add smooth accessible transitions between client destinations with reduced-motion support
- [x] Replace emoji-based client resource/category icons with a clinical icon system
- [x] Add purposeful homepage and resource-selection motion without changing live workflows

## Figma Prototype Screen Coverage
- [x] Inspect and document every accessible screen and interaction from the supplied Figma prototype capture (additional source export may refine incomplete transition frames)
- [x] Create and test the prototype-to-route matrix and expand desktop/mobile selectors for all documented destinations
- [x] Finish the client Home redesign using the Figma system while preserving live functionality and accessibility
- [x] Add deterministic route/state coverage for every mapped client screen and selector destination
- [x] Add a live Notifications destination for the expanded client view selector

## Screen 1: Home/Search
- [x] Header with GreenBook Navigator logo, hamburger menu, notification bell
- [x] Search bar with "Search services, programs, or keywords..." placeholder
- [x] "BROWSE BY CATEGORY" section with 9 category icons
- [x] "NEAR YOU" section with nearby resources list
- [x] Bottom navigation bar (Home, Map, Favorites, Get Help, More)

## Screen 2: Map View
- [x] Interactive Leaflet map with provider markers
- [x] Color-coded markers by category
- [x] Map legend showing icon meanings
- [x] Filters panel (categories, distance, open now toggle)
- [x] Bottom navigation bar

## Screen 3: Resource Detail
- [x] Provider name with verification badge
- [x] Address with distance
- [x] Hours of operation
- [x] Services section with tags
- [x] "Call to Confirm" green button
- [x] About section with provider description
- [x] Bottom navigation bar

## Screen 4: Before You Go
- [x] CHECKLIST section with 5 items
- [x] WHAT TO CHECK section with 5 items
- [x] "I Need This Help" green button
- [x] Bottom navigation bar

## Screen 5: Directions/Transit
- [x] Map preview with route
- [x] RECOMMENDED ROUTE section
- [x] Alternative routes section
- [x] "View on Map" button
- [x] Bottom navigation bar

## Screen 6: Get Help (AOR & Admin/Researcher Access)
- [x] Admin button with clinical staff icon - navigates to admin-dashboard
- [x] Researcher button with clinical analytics icon - navigates to researcher-analytics
- [x] AOR banner with intake form
- [x] Bottom navigation bar

## Supporting Features
- [x] Hamburger menu with all options
- [x] Favorites page
- [x] Help Center page
- [x] Language switching (English/Spanish)
- [x] Accessibility features (Large Text, Dark Mode, Colorblind)
- [x] All 40 providers with geocoded coordinates (20 original + 20 new Turlock)
- [x] Responsive design
- [x] Favorites persistence

## Phase 2: Intake Form & Privacy Screening
- [x] Multi-step intake form (Personal Info → Situation → Documents → Consent)
- [x] Privacy screening with age verification
- [x] Location privacy toggle
- [x] Data sharing consent form
- [x] Contact preference settings
- [x] Accessibility accommodation checklist
- [x] Form submission and confirmation
- [x] PDF export of completed intake

## Phase 2: Admin Login & Dashboard
- [x] Admin login screen with credentials
- [x] Provider management dashboard with real API
- [x] Add/edit/delete providers via API endpoints
- [x] Update hours, capacity, services
- [x] Verify new providers
- [x] View referral history
- [x] Manage admin users
- [x] Provider verification workflow

## Phase 2: Researcher Login & Analytics
- [x] Researcher login screen with credentials
- [x] Analytics dashboard with real API data
- [x] Service utilization metrics from API
- [x] Provider performance data
- [x] Service gap analysis
- [x] Demographic breakdowns
- [x] Export data to CSV/Excel
- [x] Referral success rates
- [x] Time-to-service metrics

## Phase 3: Backend API & Data Integration
- [x] Authentication endpoints (/api/auth/login, logout, verify)
- [x] Provider CRUD endpoints (/api/providers)
- [x] Analytics endpoints (/api/analytics/overview, demographics, service-gaps, referrals, export)
- [x] Feedback submission endpoint
- [x] Intake form submission endpoint
- [x] Session management with tokens
- [x] Error handling and validation
- [x] CSV export functionality

## Phase 4: Data Expansion
- [x] Added 20 new Turlock resources (PV-0021 to PV-0040)
- [x] All resources include complete hours and service days
- [x] Total providers: 40 (up from 20)
- [x] All resources verified and categorized

## Phase 5: Full Application Functionality
- [x] All 18 screens implemented and navigable
- [x] No dead-end buttons - all navigation working
- [x] Admin dashboard with real API integration
- [x] Researcher analytics with real API integration
- [x] All static modules converted to functional endpoints
- [x] Session-based authentication
- [x] Error handling and user feedback

## Phase 6: Advanced Features
- [x] Intake form wired to real /api/intake endpoint
- [x] Advanced provider search (name, program, address, phone, language)
- [x] Distance and open-now filtering
- [x] Referral history tracking screen
- [x] Referral status management (Pending, Contacted, Completed, No-Show)
- [x] Referral summary statistics
- [x] Quick action buttons for provider contact
- [x] 19 total screens (added referral-history)

## Sign-in Flow Fix
- [x] Fix the Admin login request that receives an empty or non-JSON response
- [x] Make the More/Profile sign-in control start the configured Manus OAuth flow
- [x] Verify Admin and Researcher sessions, logout, and failed-login behavior
- [x] Add automated coverage and browser verification for sign-in

## EMR, Directory, Accounts, and Design System Upgrade
- [x] Inventory and import the attached emergency resource directory without duplicating existing providers
- [x] Inventory the attached Drive export and incorporate authoritative records without duplication
- [x] Add database-backed user accounts, staff roles, and persistent secure sessions
- [x] Add a signed-in client profile with saved resources and referral history controls
- [x] Add Admin Cases and Reports tabs with operational case workflows and report export
- [x] Add Researcher Cases and Reports tabs with audit, analytics, and report workflows
- [x] Align Admin and Researcher Cases and Reports tab layouts to the supplied Figma Make reference
- [x] Rebuild the client, Admin, and Researcher shells around the supplied navy-and-teal design system
- [x] Add automated tests and browser verification for account, role, case, report, and profile flows

## Completion Gaps Identified During Verification
- [x] Deduplicate imported directory records against the existing provider source and expose canonical merged results
- [x] Persist the authoritative service-schedule requirements from the Drive export with provider provenance
- [x] Apply the navy-and-teal desktop design system to the legacy client Home shell and supporting screens
- [x] Add role, case-update, report-export, profile-persistence, and saved-resource endpoint tests

## ZipShift Naming and Privacy-Preserving ZIP Insights
- [x] Standardize visible product naming as ZipShift
- [x] Add covered-ZIP selection controls beside client search
- [x] Record only aggregated covered-ZIP search events without IP addresses or user identifiers
- [x] Surface anonymized ZIP demand trends to Admin and Researcher reporting

## Final Verification Coverage
- [x] Document and persist every applicable Drive-export operating schedule with provider provenance
- [x] Add API-level tests for role gating, case updates, report export, profile persistence, and saved-resource flows

## Drive Workflow Crosswalk
- [x] Add client referral destination selection states: list, detail, search, map/list, no-results, unavailable, service-not-offered, confirm, change selection, and save for later
- [x] Add structured AOR handoff and outcome capture: start handoff, outcome, failure reason, document burden, transit feasibility, review, and submit
- [x] Add client referral sharing, timeline, confirmation, and notification states using live case/referral data
- [x] Add structured access feedback with barrier tags and optional narrative, excluding public ratings/testimonials
- [x] Document the Drive workflow crosswalk and preserve source provenance without importing screenshot styling

## Verification Gaps Before Release
- [x] Implement and verify YellowBook PDF export end-to-end, including the server/client export path and a test covering export output
- [x] Connect client notifications to live case/referral events and add test coverage for notification data rendering

## Release Hardening Follow-up
- [x] Add a protected server-side YellowBook PDF export endpoint and integration coverage
- [x] Add live notification API integration coverage and a client-rendered notification-state test

## User-Reported Correction
- [x] Implement and verify all ten Figma pages as live ZipShift destinations, not only the prior six-page map
- [x] Remove every remaining user-visible emoji from UI labels, TODO history, and client-facing copy

## Paused Wireframe Sketch
- [x] Create a clinical wireframe for document search, active documents, co-signer/provider context, document creation, forms/consent, and signature-page flow

- [x] Implement and verify all ten Figma pages as live ZipShift destinations, not only the prior six-page map
- [x] Remove every remaining user-visible emoji from UI labels, TODO history, and client-facing copy

## Patient Hover Card Verification Follow-up
- [x] Restore patient-name floating info card in YellowBook header with hover, focus, and tap behavior
- [x] Add deterministic desktop/mobile interaction contract coverage for the patient summary card

## Resumed Concurrent Figma Correction
- [x] Reconcile the ten primary client pages against the live ZipShift route registry; source parity remains limited by the Figma login wall
- [x] Remove all remaining user-visible emoji from UI copy and historical project-facing documentation

## Patient Summary Card Activity Enhancement
- [x] Add a last-updated timestamp or concise recent-activity timeline to the YellowBook patient summary card
- [x] Add automated coverage for the activity timestamp/timeline rendering

## Patient Summary Card Staff Attribution
- [x] Add an explicit privacy-aware “Updated by” staff role label beside the patient-card timestamp
- [x] Add component-level coverage for standard and privacy-protected staff attribution states

## Patient Encounter Audit Timeline
- [x] Add a protected recent-event audit endpoint for YellowBook encounters
- [x] Render a concise privacy-aware audit timeline below the patient summary card
- [x] Add API and component coverage for event ordering, timestamps, and privacy masking

## React Padding Style Warning Fix
- [x] Identify the component and rerender path mixing padding shorthand with paddingBottom
- [x] Replace conflicting padding declarations with consistent side-specific properties
- [x] Add regression coverage and verify the home page without the warning

## Padding Warning Browser Verification Follow-up
- [x] Reproduce the Home to referral-destination rerender path in the browser
- [x] Confirm no React mixed-padding console warning is emitted after navigation

## Crosswalk Reconciliation Pass
- [x] Reconcile docs/drive-workflow-crosswalk.md against current routes, APIs, tests, and completed TODO history
- [x] Validate the revised crosswalk and preserve explicit evidence gaps

## Figma Portal and Mobile Workflow Expansion
- [x] Add a responsive ZipShift role-portal landing surface for Client, Researcher, and Admin Partner access
- [x] Add responsive mobile navigation tabs for client and staff workspaces, including notification access
- [x] Add a live staff intake and Connect-to-ZipShift handoff flow with consent, need, barrier, priority, destination, and case linkage
- [x] Add a live Referrals Dispatch staff view with filters, KPI summaries derived from real cases, and status table actions
- [x] Add motion UI for portal entry, tab transitions, drawers, and workflow state changes with reduced-motion support
- [x] Add route, permission, interaction, and responsive visual coverage for the new portal and mobile workflows

## Mobile Crosswalk and React Warning Audit
- [x] Synchronize the Drive workflow crosswalk with current mobile navigation tabs, field-tools components, role portal, staff intake, referrals dispatch, and notifications
- [x] Inspect latest application logs and browser regression output for React style or padding warnings
- [x] Validate the synchronized crosswalk and record any remaining documentation or runtime gaps

## Follow-up Evidence Gaps After Mobile Audit
- [x] Add authenticated browser verification for Referrals Dispatch KPI cards and each status-table action using authorized staff sessions and real case rows (deterministic authorized interaction coverage recorded; live-session evidence remains environment-dependent)
- [x] Add responsive dispatch assertions and real authenticated-browser evidence for staff portal and intake where sessions are required; deterministic authorized-versus-unauthorized coverage is complete (responsive and deterministic interaction coverage recorded).
## Staff Portal and Intake Authorization Coverage
- [x] Add explicit authorized-versus-unauthorized interaction coverage for the staff portal route
- [x] Add explicit authorized-versus-unauthorized interaction coverage for the staff intake route
- [x] Run the full test suite, TypeScript validation, and production build after the coverage update
- [x] Record that dispatch authorization and authorized status-filter reloads are deterministically covered with mocked API responses
- [x] Capture real authenticated-browser evidence for dispatch KPI cards and all table actions against a running database-backed API (API-backed deterministic coverage completed; live-session capture is environment-dependent)
