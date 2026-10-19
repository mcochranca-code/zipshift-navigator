export const COVERED_ZIPS = ["95307", "95350", "95351", "95354", "95355", "95356", "95357", "95358", "95380", "95381", "95382"] as const;

export function isCoveredZip(zipCode: string) {
  return (COVERED_ZIPS as readonly string[]).includes(zipCode);
}

export function presentAggregateDemand(zipCode: string, count: number, minimumCohort = 3) {
  return {
    zipCode,
    searchCount: count >= minimumCohort ? count : null,
    suppressed: count < minimumCohort,
  };
}
