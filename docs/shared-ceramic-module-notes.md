# Shared Ceramic Module Notes

Source: [shared ChatGPT session](https://chatgpt.com/share/6a8f0020-1440-83e8-b29c-263d18c598dc), reviewed Aug. 26, 2026.

The requested new module is a **Ceramic-record-style YellowBook encounter workspace**. The shared session describes a post-search intervention record rather than a standalone generic intake dashboard.

## Verified module requirements

| Area | Required behavior |
|---|---|
| Clinical shell | Compact icon rail, secondary left navigation, calendar/date strip, central patient-record workspace, right-side patient-details panel with tabs, bottom encounter action bar |
| Record sections | Chief Complaint, HSAI Progress, Encounter, and Plan |
| Intake | Full-screen focus intake modal and adaptive UI behavior |
| HSAI | Live scoring, HSAI domain bars, alternate practitioner wording, adaptive narrative analysis, suggested branch forms |
| Persistence and safety | Pause/discontinue report, privacy mode, downloadable pause-safe report, save/export all demo state |
| Data/content | Search Stanislaus County intake forms and digitize them into reusable, PDF-exportable forms |
| Visual direction | Mirror the Ceramic demo’s typeface, colors, compact clinical cards, minimal white/gray clinical interface, and synthetic appointment context while keeping ZipShift’s product architecture and navy/teal system consistent where appropriate |

## Integration interpretation

The module should be introduced as a protected staff/research workflow linked to a case or referral after search/intake. It should not replace the public client discovery flow. The first implementation should provide a live encounter workspace with persisted state, explicit privacy mode, HSAI progress, branch-form navigation, pause-safe export, and clear escape routes back to Cases and Reports.

## Source limitation

The shared page exposed the summarized requirements above, but not the uploaded demo video files or a complete technical specification. Exact video-level typography, spacing, and all form fields require the user to provide the demo files or a more detailed export before claiming pixel-level parity.
