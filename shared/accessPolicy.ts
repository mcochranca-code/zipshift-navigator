/**
 * Least-privilege access tiers, shared by the API and the client UI.
 *
 * Account roles are stored as `client`, `admin`, or `researcher`. A
 * `researcher` account that also carries a specialist role is a care-team
 * member (intake, peer support, SUD, and so on) and works with identified
 * referrals. A `researcher` account with no specialist role is research-only:
 * it may read de-identified, aggregate data and pseudonymous study records,
 * and nothing that identifies a client or edits a referral.
 *
 * The server enforces this; the client only uses it to hide controls the
 * account could not use anyway.
 */
export type AccessTier = "client" | "researcher" | "care_team" | "admin";

export type AccessSubject = { role: string; specialistRole?: string | null } | null | undefined;

/** Resolves an account to its access tier, or `null` when signed out or unknown. */
export function accessTier(user: AccessSubject): AccessTier | null {
  if (!user) return null;
  if (user.role === "admin") return "admin";
  if (user.role === "researcher") return user.specialistRole ? "care_team" : "researcher";
  if (user.role === "client") return "client";
  return null;
}

/** Administrators and care-team staff may see client-identifying referral data and edit referrals. */
export function canAccessIdentifiedData(user: AccessSubject) {
  const tier = accessTier(user);
  return tier === "admin" || tier === "care_team";
}

/** Research-only staff: de-identified and aggregate data only. */
export function isResearchOnly(user: AccessSubject) {
  return accessTier(user) === "researcher";
}
