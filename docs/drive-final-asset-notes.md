# Final Drive Asset Notes

Source: [COM-ZS-AOR-MOCK-B03 client referral destination ZIP](https://drive.google.com/file/d/1r9b7OaTAaKNft4alQq5eQuUiTMxGfN0U/view?usp=sharing)

Drive metadata: `application/zip`, 1,281,318 bytes, modified 2026-08-26.

The ZIP contains a client referral-destination workflow package with ten individual PNG states, one gallery PNG, an index CSV, and a README. The screen states are:

1. Referral destination list
2. Selected destination detail
3. Referral search
4. Referral map view
5. No results
6. Resource unavailable
7. Service not offered
8. Referral confirm and continue
9. Change selection
10. Save for later

This asset is a workflow reference, not a replacement visual design. It directly supports ZipShift’s existing directory, provider detail, map, no-results, availability, referral confirmation, change-selection, and save-for-later routes. Exact copy and interaction rules should be read from the included README/CSV during implementation review.

## Verified workflow sequence

The gallery and primary list state confirm a client-first, low-risk Step 8 flow: select a recommended destination, inspect selected destination details, search by keyword/category, switch between map and list, handle no-results, handle unavailable resources, handle service-not-offered, confirm and continue, change selection, or save the referral for later. The screenshots explicitly show Back and Continue controls, disabled Continue when no destination is selected, and recovery actions that return the user to selection rather than creating a dead end.

The screenshots use dummy aliases and sample/public-style details. They do not require admin approval for these client-facing selection states. ZipShift should reuse the workflow behavior but retain its navy/teal clinical design system and live directory/provider data.

## Crosswalk from the first screenshot batch

The first batch contains both flow maps and individual iOS states. The public-user flow shows splash/onboarding, Home, Search, Map, Filters, Resource List, Resource Detail, Before You Go, Transit Directions, Saved/Favorites, and Profile/Help. ZipShift already has live equivalents for these routes, including covered-ZIP search, map, directory/detail, before-you-go, directions, favorites, profile, help, and notifications. The screenshot flow also reinforces a persistent client navigation model and an explicit filter state.

The remaining individual states add client referral operations: share referral details, service initiated confirmation, referral detail, email/share composition, referral timeline, client contacted confirmation, and a destination-focused AOR flow. These should map to live referral history, notifications/read states, client profile, intake, provider detail, and the new YellowBook/case-linked workflow. The screenshots are workflow references only; ZipShift’s navy/teal clinical system remains the implementation style.

## AOR workflow and feedback requirements

The AOR overview adds a structured operational path beyond destination selection: search or start task, resource detail, start handoff, outcome picker, failure-reason picker, document-burden capture, transit-feasibility capture, and review/submit. Outcomes include access achieved, partial access, alternative provided, and no access. The no-access and partial-access paths should make referral eligibility explicit and preserve failure reasons, requested documents, and transit feasibility as structured case events.

The client feedback reference is a three-step outcome feedback flow. It captures an easy/not-easy response, multi-select barriers such as documents, language, transit, hours, and wrong information, plus optional narrative. This aligns with ZipShift’s existing feedback/intake direction but should be backed by the case/referral event ledger and aggregated for researcher reporting. It is not a public review/rating system and should not be presented as a testimonial or star-rating feature.
