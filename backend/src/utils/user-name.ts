type NameUser = {
  role?: string | null;
  displayName?: string | null;
  email?: string | null;
  applicantProfile?: { firstName?: string | null; lastName?: string | null } | null;
} | null | undefined;

export const resolveUserName = (user: NameUser, fallback = "Unknown"): string => {
  const profile = [user?.applicantProfile?.firstName?.trim(), user?.applicantProfile?.lastName?.trim()]
    .filter(Boolean).join(" ");
  return (user?.role !== "APPLICANT" && user?.displayName?.trim()) || profile || user?.email?.trim() || fallback;
};
