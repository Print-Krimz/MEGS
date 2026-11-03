export interface RecruiterLabel {
  /** What to show in a list or chart. For an email, the part before the @. */
  label: string;
  /** The full email, shown as a muted second line under the label so distinct accounts stay distinct. */
  email?: string;
  /** Extra text for a hover tooltip. */
  full?: string;
}

const NO_OWNER = /^(no recruiter assigned|unassigned)$/i;
// A simple check only: something@something.tld with no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * What to show for a recruiter. A real name is shown as is. A recruiter with no profile name is stored by email: the part
 * before the @ is shown as the name and the full email under it, so different accounts stay distinct. Only a missing owner is reworded.
 */
export const formatRecruiterName = (name: string | null | undefined): RecruiterLabel => {
  const raw = (name ?? "").trim();
  if (!raw) return { label: "Unknown" };
  if (NO_OWNER.test(raw)) return { label: "No owner" };
  if (EMAIL.test(raw)) return { label: raw.slice(0, raw.indexOf("@")), email: raw, full: raw };
  return { label: raw };
};

/**
 * One clean name for tight rows: a real name as is, an email as its title-cased local part
 * ("sales_food_001@x.com" reads "Sales Food 001"). The full email stays in `full` for a tooltip; there is no second line.
 */
export const recruiterDisplayName = (name: string | null | undefined): RecruiterLabel => {
  const base = formatRecruiterName(name);
  if (!base.email) return base;
  const words = base.label.split(/[._-]+/).filter(Boolean);
  const label = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || base.label;
  return { label, full: base.email };
};
