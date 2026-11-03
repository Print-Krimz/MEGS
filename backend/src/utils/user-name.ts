type NameUser = {
  role?: string | null;
  displayName?: string | null;
  email?: string | null;
  applicantProfile?: { firstName?: string | null; lastName?: string | null } | null;
} | null | undefined;

/**
 * A person's name for a message other people read. Never falls back to the email address: the account email is a login
 * and contact detail, not who the person is. With no name on record it returns `fallback`.
 */
export const resolvePersonName = (user: NameUser, fallback: string): string => {
  const profile = [user?.applicantProfile?.firstName?.trim(), user?.applicantProfile?.lastName?.trim()].filter(Boolean).join(" ");
  return (user?.role !== "APPLICANT" && user?.displayName?.trim()) || profile || fallback;
};

export const resolveUserName = (user: NameUser, fallback = "Unknown"): string => {
  const profile = [user?.applicantProfile?.firstName?.trim(), user?.applicantProfile?.lastName?.trim()]
    .filter(Boolean).join(" ");
  return (user?.role !== "APPLICANT" && user?.displayName?.trim()) || profile || user?.email?.trim() || fallback;
};
