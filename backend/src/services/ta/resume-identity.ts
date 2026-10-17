// Compares the name and contact details printed on a resume with the applicant's
// profile so TA can be warned when a resume may belong to someone else. Advisory only:
// the result never changes an application's status.

export type ResumeIdentityResult = "MATCH" | "MISMATCH" | "UNCLEAR";

export interface ResumeIdentityCheck {
  result: ResumeIdentityResult;
  /** Plain-language reasons shown to TA when result is MISMATCH. */
  differences: string[];
}

interface ResumeIdentityInput {
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface ProfileIdentityInput {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
}

const nameTokens = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length > 1);

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

// Philippine national number: drop the country code (63) or trunk prefix (0).
const phoneDigits = (value: string) => value.replace(/\D/g, "").replace(/^(?:63|0)/, "");

/** true = same, false = different, null = cannot tell (a side is missing). */
const compareName = (resumeName: string | null, profile: ProfileIdentityInput): boolean | null => {
  const first = nameTokens(profile.firstName ?? "")[0];
  const last = nameTokens(profile.lastName ?? "").filter((token) => !NAME_SUFFIXES.has(token)).at(-1);
  if (!resumeName || !first || !last) return null;
  const tokens = new Set(nameTokens(resumeName));
  if (tokens.size === 0) return null;
  return tokens.has(first) && tokens.has(last);
};

const compareEmail = (resumeEmail: string | null, profileEmail?: string | null): boolean | null => {
  if (!resumeEmail || !profileEmail) return null;
  return resumeEmail.trim().toLowerCase() === profileEmail.trim().toLowerCase();
};

const comparePhone = (resumePhone: string | null, profilePhone?: string | null): boolean | null => {
  if (!resumePhone || !profilePhone) return null;
  const a = phoneDigits(resumePhone);
  const b = phoneDigits(profilePhone);
  if (a.length < 7 || b.length < 7) return null;
  return a === b;
};

/**
 * MISMATCH only when the name differs AND at least one contact detail also differs,
 * so nicknames or a changed email alone do not raise a false alarm.
 */
export const checkResumeIdentity = (
  resume: ResumeIdentityInput | null,
  profile: ProfileIdentityInput
): ResumeIdentityCheck => {
  if (!resume) return { result: "UNCLEAR", differences: [] };

  const name = compareName(resume.name, profile);
  const email = compareEmail(resume.email, profile.email);
  const phone = comparePhone(resume.phone, profile.mobileNumber);

  if (name === true) return { result: "MATCH", differences: [] };
  if (name === false && (email === false || phone === false)) {
    const differences = [`Name on resume: ${resume.name}`];
    if (email === false) differences.push("Email on resume differs from the account email");
    if (phone === false) differences.push("Phone on resume differs from the profile phone");
    return { result: "MISMATCH", differences };
  }
  return { result: "UNCLEAR", differences: [] };
};
