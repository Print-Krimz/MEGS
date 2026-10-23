// Reads a paper bio-data for the walk-in dialogs. Writes nothing: it only returns what Gemini found
// and a job suggestion; the TA still confirms every field.
import { createHash } from "node:crypto";
import prisma from "../../utils/prisma.js";
import { processResumeExtractionService } from "../applicant/applicant.service.js";
import { ownedWhere, type Actor } from "./ownership.js";
import { cacheWalkInRead } from "./walk-in-read-cache.js";

export interface WalkInReadResult {
  status: "read" | "unreadable";
  firstName?: string;
  middleName?: string;
  lastName?: string;
  mobileNumber?: string;
  birthDate?: string;
  gender?: "Male" | "Female" | "Non-Binary" | "Prefer not to say";
  positionApplied?: string;
  suggestedJobId: number | null;
}

const STOPWORDS = new Set(["and", "of", "the", "staff", "for", "a", "an", "in", "at", "to"]);

const tokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !STOPWORDS.has(word));

// 2 = same words, 1 = one title holds all words of the other, otherwise shared share of words (0.5 or more), else 0.
const titleScore = (position: string[], title: string[]): number => {
  if (!position.length || !title.length) return 0;
  const p = new Set(position);
  const t = new Set(title);
  const shared = [...p].filter((word) => t.has(word)).length;
  if (shared === p.size && shared === t.size) return 2;
  if (shared === p.size || shared === t.size) return 1;
  const overlap = shared / Math.max(p.size, t.size);
  return overlap >= 0.5 ? overlap : 0;
};

/** The TA's own OPEN job whose title clearly best matches the position on the form, or null when none or several tie. */
export const suggestJobId = async (actor: Actor, positionApplied: string | undefined): Promise<number | null> => {
  const position = tokens(positionApplied ?? "");
  if (!position.length) return null;
  const jobs = await prisma.jobPosting.findMany({
    where: { AND: [ownedWhere.job(actor), { status: "OPEN" }] } as any,
    select: { id: true, title: true },
  });
  const scored = jobs
    .map((job) => ({ id: job.id, score: titleScore(position, tokens(job.title)) }))
    .filter((job) => job.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[1].score === scored[0].score) return null;
  return scored[0].id;
};

export const readWalkInBiodata = async (actor: Actor, file: Express.Multer.File): Promise<WalkInReadResult> => {
  const { extractedData } = await processResumeExtractionService(file.buffer, file.mimetype, file.originalname);
  if (!extractedData) return { status: "unreadable", suggestedJobId: null };

  cacheWalkInRead(actor.id, createHash("sha256").update(file.buffer).digest("hex"), extractedData);

  const suggestedJobId = await suggestJobId(actor, extractedData.positionApplied).catch(() => null);
  return {
    status: "read",
    firstName: extractedData.firstName,
    middleName: extractedData.middleName,
    lastName: extractedData.lastName,
    mobileNumber: extractedData.mobileNumber,
    birthDate: extractedData.dateOfBirth,
    gender: extractedData.gender as WalkInReadResult["gender"],
    positionApplied: extractedData.positionApplied,
    suggestedJobId,
  };
};
