export interface RecruiterLabel {
  /** What to show in a list or chart. */
  label: string;
  /** Extra text for a hover tooltip, when the label is not already the full value. */
  full?: string;
}

const NO_OWNER = /^(no recruiter assigned|unassigned)$/i;

/**
 * What to show for a recruiter. A real name is shown as is. A recruiter with no profile name is stored by email, and
 * the email is shown in full: shortening it made different accounts look identical. Only a missing owner is reworded.
 */
export const formatRecruiterName = (name: string | null | undefined): RecruiterLabel => {
  const raw = (name ?? "").trim();
  if (!raw) return { label: "Unknown" };
  if (NO_OWNER.test(raw)) return { label: "No owner" };
  return { label: raw };
};
