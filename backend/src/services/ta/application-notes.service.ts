import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { displayEmail } from '../../utils/display-email.js';

const NOTE_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
} as const;

type NoteRow = {
  id: number;
  body: string;
  createdAt: Date;
  author: { id: string; email: string; applicantProfile: { firstName: string | null; lastName: string | null } | null } | null;
};

const toNote = (row: NoteRow) => {
  const profile = row.author?.applicantProfile;
  const name = profile ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() : "";
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    authorName: name || displayEmail(row.author?.email) || "Recruiter",
  };
};

/** Newest first. Ownership is checked by the route (requireOwned("application")). */
export const listApplicationNotes = async (applicationId: number) => {
  const rows = await prisma.applicationNote.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
    select: NOTE_SELECT,
  });
  return rows.map((row) => toNote(row as NoteRow));
};

export const addApplicationNote = async (applicationId: number, authorId: string, body: string) => {
  const application = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!application) throw new Error("Application not found");
  const row = await prisma.applicationNote.create({
    data: { applicationId, authorId, body },
    select: NOTE_SELECT,
  });
  void logAudit(authorId, "ADD_APPLICATION_NOTE", "Application", applicationId, { noteId: row.id });
  return toNote(row as NoteRow);
};
