# Referral and AOR Flow Audit

## Verified existing states

The referral destination component already renders destination list/search, map/list switching, no-results, selected detail, confirm/change selection, save-for-later, unavailable-resource, service-not-offered, and a handoff review screen. The client AOR shell already supports needs selection, contact information, destination selection, consent, referral review, submission, and structured client access feedback.

## Gaps found

The saved referral draft is written only to local storage and is never restored into the flow. A saved or blocked referral has no explicit resume/discard recovery path. Handoff outcomes use an older taxonomy (`confirmed`, `needs-review`, `not-reached`, `service-unavailable`) rather than the documented AOR access outcomes (`access-achieved`, `partial-access`, `alternative-provided`, `no-access`). Failure reason, requested documents, and referral eligibility are not structured by outcome. The submission error surface has no draft-preserving recovery action, and referral destination selection can proceed without making the intended service match visible in the confirmation/review state.

## Implementation contract

Keep client referral drafts separate from submitted cases. A draft may be saved, restored, discarded, or changed without creating a case. AOR outcome branches must preserve the selected destination, use explicit access outcome labels, require a reason for partial/no access, capture document burden and transit feasibility, and make the next referral action visible before review submission. Submitted referrals continue to use the existing `/api/intake` endpoint and case event ledger. No public reviews or ratings are introduced.
