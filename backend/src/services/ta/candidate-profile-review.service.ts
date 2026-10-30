// Section edits from the TA "Verify details" screen.
// Work and education send only the rows that changed: a row with an id is updated, a row without is created,
// and a row is deleted only when its id is listed for removal. Rows that are not mentioned are never touched.
// Skills are the one full list: the submitted names become the candidate's skills.
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

const OWN_ROWS_MESSAGE = "One of the entries does not belong to this candidate. Reload and try again.";

// Every id the TA touches (update or remove) must be a row of this profile, and a row cannot be both.
const assertOwnIds = (rows: Array<{ id?: number }>, removeIds: number[], existing: Set<number>) => {
  const updateIds = rows.filter((row) => row.id !== undefined).map((row) => row.id as number);
  if ([...updateIds, ...removeIds].some((id) => !existing.has(id))) throw new ProfileSectionError(OWN_ROWS_MESSAGE);
  if (updateIds.some((id) => removeIds.includes(id))) throw new ProfileSectionError("An entry cannot be edited and removed in the same save.");
};

export const applyWorkExperiences = async (
  tx: Tx,
  profileId: number,
  rows: WorkExperienceInput[],
  removeIds: number[],
): Promise<SectionCount> => {
  const existing = await tx.workExperience.findMany({ where: { applicantProfileId: profileId }, select: { id: true } });
  assertOwnIds(rows, removeIds, new Set(existing.map((row) => row.id)));

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

export const applyEducations = async (
  tx: Tx,
  profileId: number,
  rows: EducationInput[],
  removeIds: number[],
): Promise<SectionCount> => {
  const existing = await tx.education.findMany({ where: { applicantProfileId: profileId }, select: { id: true } });
  assertOwnIds(rows, removeIds, new Set(existing.map((row) => row.id)));

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
  // Skills match case-insensitively. Skill rows are shared by every candidate, so an existing row keeps its casing
  // even when the TA types it differently; a skill that does not exist yet is created with the typed casing.
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

  const toAdd = [...wantedByKey].filter(([key]) => !currentKeys.has(key));
  if (toAdd.length) {
    const typed = toAdd.map(([, name]) => name);
    const findExisting = () => tx.skill.findMany({ where: { name: { in: typed, mode: "insensitive" } } });
    let skills = await findExisting();
    const knownKeys = new Set(skills.map((skill) => skill.name.toLowerCase()));
    const missing = toAdd.filter(([key]) => !knownKeys.has(key)).map(([, name]) => ({ name }));
    if (missing.length) {
      await tx.skill.createMany({ data: missing, skipDuplicates: true });
      skills = await findExisting();
    }
    const skillIdByKey = new Map<string, number>();
    for (const skill of skills) if (!skillIdByKey.has(skill.name.toLowerCase())) skillIdByKey.set(skill.name.toLowerCase(), skill.id);
    await tx.applicantSkill.createMany({
      data: toAdd.map(([key]) => ({ applicantProfileId: profileId, skillId: skillIdByKey.get(key)! })),
    });
  }
  return { added: toAdd.length, updated: 0, removed: removeSkillIds.length };
};
