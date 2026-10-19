# ZipShift Figma Screen Map

**Source:** the supplied Figma prototype at `https://www.figma.com/proto/MAY2ZK7kfBZaNWZSll4KQI?node-id=0-1&t=BfhNTDFCB9LLaYEn-6`.

## Prototype inventory

| Prototype frame | Observed content | ZipShift representation |
|---|---|---|
| 1 of 5 | Client workspace entry card with direct help, route finding, verified directory, and Access Workspace | Home, Full Directory, Map, Get Help, and the client view selector |
| 2 of 5 | Connect to ZipShift workflow summary with need, barrier, priority, client consent, destination, Back, and Next | Get Help/AOR intake flow and live `/api/intake` case creation |
| 3 of 5 | Blank/loading phone state | Explicit loading and empty states in the application; no fabricated destination is added |
| 4 of 5 | Blank/light transition state | Explicit loading/transition treatment; no fabricated destination is added |
| 5 of 5 | Partial white/black transition state | Explicit loading/transition treatment; no fabricated destination is added |

## ZipShift client views

The client view selector and responsive navigation expose Home, Map Search, Favorites, Intake/Get Help, Full Directory, Notifications, Profile, and More. Detail destinations remain reachable from the provider directory and Home flows: Search Results, Resource Detail, Before You Go, Directions, Filters, Referral History, Feedback, Settings, About, Privacy, and Terms.

The ten primary client pages represented as live ZipShift destinations are Home/Search, Search Results, Map Search, Resource Detail, Before You Go, Directions, Get Help, Favorites, Client Profile, and Referral History. Supporting destinations include Full Directory, Intake, Notifications, Feedback, About, Privacy, Terms, Settings, and More.

The public Home uses the Figma-derived hierarchy: ZipShift wordmark, compact greeting, service search with covered-ZIP selection, privacy notice, category grid, nearby resources, and persistent mobile navigation. The desktop shell uses the shared navy sidebar and teal active state; the mobile shell retains the bottom navigation and hamburger view selector.

## Protected workspaces

Admin and Super Admin users receive Cases, Provider Workspace, Verification Queue, Reports, Team Access, Notifications, Integrations, Role Governance, and Audit destinations according to the least-privilege policy. Researchers receive Analytics, Cases, Research Sessions, Adjudication, and Reports. Every action is backed by an API endpoint or an explicit navigation/empty state.

## Ceramic YellowBook module mapping

The shared Ceramic demo requirements map to a protected post-search encounter workspace rather than a public client destination. The planned route is **YellowBook Encounter**, linked from staff Cases and referrals, with live sections for Chief Complaint, HSAI Progress, Encounter, Plan, patient details, adaptive branch forms, privacy mode, pause/discontinue, and pause-safe export. It will preserve ZipShift’s existing case and HSAI data model while adopting the compact clinical record layout described in the shared session.

## Fidelity boundary

The supplied prototype now redirects to a Figma sign-in page in the accessible browser session, so I cannot truthfully confirm that every original frame or interaction has been imported pixel-for-pixel. The current ZipShift implementation covers the previously captured actionable client flows, the ten primary Figma client pages plus supporting client destinations, and explicit loading/empty states without fabricating inaccessible source screens. A full Figma export, screenshots, or an authenticated prototype session is still required for complete page-by-page parity verification.
