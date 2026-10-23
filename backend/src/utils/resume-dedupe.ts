// Dedupe keys shared by the apply step and the resume merge proposal, so both agree on what "same entry" means.
const keyText = (value: unknown) => String(value ?? "").trim().toLowerCase();
export const resumeDedupe = {
  workKey: (company: string, roleTitle: string) => `${keyText(company)}|${keyText(roleTitle)}`,
  educationKey: (school: string, degree?: string | null) => `${keyText(school)}|${keyText(degree)}`,
  skillKey: (name: string) => keyText(name),
  trainingKey: (title: string) => keyText(title),
  referenceMatches: (
    a: { name: string; phone?: string | null; email?: string | null },
    b: { name: string; phone?: string | null; email?: string | null }
  ) => {
    if (keyText(a.name) !== keyText(b.name)) return false;
    const phoneA = keyText(a.phone);
    const phoneB = keyText(b.phone);
    const emailA = keyText(a.email);
    const emailB = keyText(b.email);
    if (phoneA && phoneB && phoneA === phoneB) return true;
    if (emailA && emailB && emailA === emailB) return true;
    return !phoneA && !emailA && !phoneB && !emailB;
  },
};
