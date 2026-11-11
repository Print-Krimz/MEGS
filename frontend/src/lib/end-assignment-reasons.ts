export const OTHER_END_REASON = "Other";

export const END_ASSIGNMENT_REASONS = [
  "Contract or assignment period ended",
  "Did not pass requirements during deployment (backed out)",
  "Client ended the assignment early",
  "Worker requested to end or transfer",
  "Worker stopped reporting (AWOL)",
  "Performance or conduct issue",
  OTHER_END_REASON,
] as const;

// Room left for the details so the combined text stays under the backend reason limit.
export const END_REASON_DETAILS_MAX = 1_900;

export const endReasonOptions = [
  { value: "", label: "Choose a reason" },
  ...END_ASSIGNMENT_REASONS.map((value) => ({ value, label: value })),
];

/** Details are required only for "Other". */
export const endReasonNeedsDetails = (preset: string) => preset === OTHER_END_REASON;

/** The single reason string the backend stores: the preset, plus details when given. */
export function buildEndReason(preset: string, details: string): string {
  const text = details.trim();
  if (preset === OTHER_END_REASON) return text;
  return text ? `${preset}: ${text}` : preset;
}

/** Message for the disabled submit button, or "" when the reason is complete. */
export function endReasonMissing(preset: string, details: string): string {
  if (!preset) return "Choose a reason.";
  if (endReasonNeedsDetails(preset) && !details.trim()) return "Add details.";
  return "";
}
