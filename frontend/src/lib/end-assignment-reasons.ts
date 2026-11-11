export type EndDisposition = "AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "BACKED_OUT" | "SEPARATED";

export const OTHER_END_REASON = "Other";

// Each reason decides what happens to the worker next. "Other" lets the user choose.
const REASON_STEPS: { label: string; disposition: EndDisposition | null }[] = [
  { label: "Contract or assignment period ended", disposition: "AVAILABLE_FOR_REDEPLOYMENT" },
  { label: "Client ended the assignment early", disposition: "AVAILABLE_FOR_REDEPLOYMENT" },
  { label: "Worker requested a transfer", disposition: "AVAILABLE_FOR_REDEPLOYMENT" },
  { label: "Did not pass requirements during deployment (backed out)", disposition: "BACKED_OUT" },
  { label: "Worker stopped reporting (AWOL)", disposition: "BACKED_OUT" },
  { label: "Performance or conduct issue", disposition: "BACKED_OUT" },
  { label: "Worker resigned or left the agency", disposition: "SEPARATED" },
  { label: OTHER_END_REASON, disposition: null },
];

// Room left for the details so the text stays under the backend reason limit.
export const END_REASON_DETAILS_MAX = 1_900;

export const endReasonOptions = [
  { value: "", label: "Choose a reason" },
  ...REASON_STEPS.map(({ label }) => ({ value: label, label })),
];

/** The next step a reason implies, or "" for "Other" and for no reason yet. */
export const endDispositionFor = (preset: string): EndDisposition | "" =>
  REASON_STEPS.find((r) => r.label === preset)?.disposition ?? "";

/** "Other" needs details and a next step chosen by the user. */
export const endReasonNeedsDetails = (preset: string) => preset === OTHER_END_REASON;

/** The single reason string the backend stores: the preset, or the typed details for "Other". */
export function buildEndReason(preset: string, details: string): string {
  return preset === OTHER_END_REASON ? details.trim() : preset;
}

/** Message for the disabled submit button, or "" when the reason is complete. */
export function endReasonMissing(preset: string, details: string): string {
  if (!preset) return "Choose a reason.";
  if (endReasonNeedsDetails(preset) && !details.trim()) return "Add details.";
  return "";
}
