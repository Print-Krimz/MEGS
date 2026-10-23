// Section edits from the TA "Review bio-data" screen.
// A submitted list replaces that section: rows with an id are updated, rows without are created,
// and rows the TA left out are deleted. A section that is not submitted is never touched.
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export class ProfileSectionError extends Error {}

export interface WorkExperienceInput {
  id?: number;
  company: string;
  roleTitle: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  summary?: string | null;
}

export interface EducationInput {
  id?: number;
  school: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export interface SectionCount {
  added: number;
  updated: number;
  removed: number;
}

const blank = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);
const toDate = (value: string | null | undefined) => (value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null);

const assertOwnIds = (submitted: Array<{ id?: number }>, existing: Set<number>) => {
  for (const row of submitted) {
    if (row.id !== undefined && !existing.has(row.id)) {
      throw new ProfileSectionError("One of the entries does not belong to this candidate. Reload and try again.");
    }
  }
};

export const replaceWorkExperiences = async (tx: Tx, profileId: number, rows: WorkExperienceInput[]): Promise<SectionCount> => {
  const existing = await tx.workExperience.findMany({ where: { applicantProfileId: profileId }, select: { id: true } });
  const existingIds = new Set(existing.map((row) => row.id));
  assertOwnIds(rows, existingIds);

  const keepIds = new Set(rows.filter((r) => r.id !== undefined).map((r) => r.id as number));
  const removeIds = [...existingIds].filter((id) => !keepIds.has(id));
  if (removeIds.length) await tx.workExperience.deleteMany({ where: { id: { in: removeIds }, applicantProfileId: profileId } });

  let added = 0;
  let updated = 0;
  for (const row of rows) {
    const data = {
      company: row.company.trim(),
      roleTitle: row.roleTitle.trim(),
      location: blank(row.location),
      startDate: toDate(row.startDate) as Date,
      endDate: row.isCurrent ? null : toDate(row.endDate),
      isCurrent: Boolean(row.isCurrent),
      summary: blank(row.summary),
    };
    if (row.id !== undefined) {
      await tx.workExperience.update({ where: { id: row.id }, data });
      updated += 1;
    } else {
      await tx.workExperience.create({ data: { ...data, applicantProfileId: profileId } });
      added += 1;
    }
  }
  return { added, updated, removed: removeIds.length };
};

export const replaceEducations = async (tx: Tx, profileId: number, rows: EducationInput[]): Promise<SectionCount> => {
  const existing = await tx.education.findMany({ where: { applicantProfileId: profileId }, select: { id: true } });
  const existingIds = new Set(existing.map((row) => row.id));
  assertOwnIds(rows, existingIds);

  const keepIds = new Set(rows.filter((r) => r.id !== undefined).map((r) => r.id as number));
  const removeIds = [...existingIds].filter((id) => !keepIds.has(id));
  if (removeIds.length) await tx.education.deleteMany({ where: { id: { in: removeIds }, applicantProfileId: profileId } });

  let added = 0;
  let updated = 0;
  for (const row of rows) {
    const data = {
      school: row.school.trim(),
      degree: blank(row.degree),
      fieldOfStudy: blank(row.fieldOfStudy),
      startDate: toDate(row.startDate),
      endDate: toDate(row.endDate),
      notes: blank(row.notes),
    };
    if (row.id !== undefined) {
      await tx.education.update({ where: { id: row.id }, data });
      updated += 1;
    } else {
      await tx.education.create({ data: { ...data, applicantProfileId: profileId } });
      added += 1;
    }
  }
  return { added, updated, removed: removeIds.length };
};

export const replaceSkills = async (tx: Tx, profileId: number, names: string[]): Promise<SectionCount> => {
  // Skills match case-insensitively but keep the casing they were typed with ("JavaScript", not "javascript").
  const wantedByKey = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name && !wantedByKey.has(name.toLowerCase())) wantedByKey.set(name.toLowerCase(), name);
  }
  const current = await tx.applicantSkill.findMany({ where: { applicantProfileId: profileId }, include: { skill: true } });
  const currentKeys = new Set(current.map((row) => row.skill.name.toLowerCase()));

  const removeSkillIds = current.filter((row) => !wantedByKey.has(row.skill.name.toLowerCase())).map((row) => row.skillId);
  if (removeSkillIds.length) {
    await tx.applicantSkill.deleteMany({ where: { applicantProfileId: profileId, skillId: { in: removeSkillIds } } });
  }

  let added = 0;
  for (const [key, name] of wantedByKey) {
    if (currentKeys.has(key)) continue;
    let skill = await tx.skill.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (!skill) skill = await tx.skill.create({ data: { name } });
    await tx.applicantSkill.create({ data: { applicantProfileId: profileId, skillId: skill.id } });
    added += 1;
  }
  return { added, updated: 0, removed: removeSkillIds.length };
};
