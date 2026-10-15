import prisma from '../../utils/prisma.js';

type CheckedField = 'mobileNumber' | 'sss' | 'tin';

const LABELS: Record<CheckedField, string> = {
  mobileNumber: 'mobile number',
  sss: 'SSS number',
  tin: 'TIN',
};

/**
 * Soft, read-only duplicate check for identifiers the database does not enforce as unique.
 * Pass only the values changed by this save; undefined, null and empty values are skipped.
 * Matches the saved string exactly. SSS and TIN also match their digits-only form (spaces and
 * dashes removed). A stored value formatted differently from the saved string is not detected.
 * Only the other applicants' first and last names are returned. Never throws: on any failure
 * it returns no warnings, so the save is never blocked.
 */
export async function findDuplicateIdentifierWarnings(
  applicantProfileId: number,
  changed: Partial<Record<CheckedField, string | null>>,
): Promise<string[]> {
  const warnings: string[] = [];
  try {
    for (const field of Object.keys(LABELS) as CheckedField[]) {
      const value = changed[field];
      if (!value) continue;
      const variants = field === 'mobileNumber'
        ? [value]
        : Array.from(new Set([value, value.replace(/[\s-]/g, '')]));
      const matches = await prisma.applicantProfile.findMany({
        where: { id: { not: applicantProfileId }, [field]: { in: variants } },
        select: { id: true, firstName: true, lastName: true },
        take: 3,
      });
      if (matches.length === 0) continue;
      const names = matches
        .map((match) => [match.firstName, match.lastName].filter(Boolean).join(' ') || 'unnamed applicant')
        .join(', ');
      warnings.push(
        matches.length === 1
          ? `Another applicant (${names}) already uses this ${LABELS[field]}.`
          : `Other applicants (${names}) already use this ${LABELS[field]}.`,
      );
    }
    return warnings;
  } catch (error) {
    console.warn('Duplicate identifier check skipped:', error);
    return [];
  }
}
