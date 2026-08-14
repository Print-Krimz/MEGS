import type { CandidateFeatureInput, JobFeatureInput, ScoringDimension } from "./scoring.types.js";

const tokenize = (text: string): string[] =>
  text
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9+#.]{2,}/g) ?? [];

type DimensionResult = {
  dimension: ScoringDimension;
  score: number;
  explanation: {
    basis: string;
    missingMandatory: boolean;
  };
};

type DimensionCalculator = (candidate: CandidateFeatureInput, job: JobFeatureInput) => DimensionResult;

export const clampScore = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;

const normalizedSet = (values: string[]) => new Set(values.flatMap(tokenize));

const overlapPercent = (candidate: Set<string>, target: Set<string>, unknownScore = 50) => {
  if (!target.size) return unknownScore;
  if (!candidate.size) return 0;
  let matches = 0;
  for (const term of target) if (candidate.has(term)) matches += 1;
  return clampScore((matches / target.size) * 100);
};

// ─── COMPLIANCE HELPER & DIMENSION ───────────────────────────────────

const protectedDocumentPattern = /\b(?:birth|marriage|pregnan|disabil|gender|nationality|passport|religion|race|ethnic)\b/i;

const knownDocumentTypes = new Set([
  "NBI_CLEARANCE",
  "POLICE_CLEARANCE",
  "BARANGAY_CLEARANCE",
  "MEDICAL_CERTIFICATE",
  "PROFESSIONAL_LICENSE",
  "DRIVERS_LICENSE",
  "TRAINING_CERTIFICATE",
  "EMPLOYMENT_CERTIFICATE",
]);

/** Returns a non-sensitive compliance category without changing the legacy asset label. */
export const normalizeComplianceDocumentType = (label: string, documentType?: string | null): string | null => {
  const source = `${documentType ?? ""} ${label}`.trim();
  if (!source || protectedDocumentPattern.test(source)) return null;
  const normalizedExisting = documentType?.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (normalizedExisting && knownDocumentTypes.has(normalizedExisting)) return normalizedExisting;
  if (/(nbi|national bureau.*investigation)/i.test(source)) return "NBI_CLEARANCE";
  if (/police.*clearance/i.test(source)) return "POLICE_CLEARANCE";
  if (/barangay.*clearance/i.test(source)) return "BARANGAY_CLEARANCE";
  if (/(medical|fit.*work|health).*cert/i.test(source)) return "MEDICAL_CERTIFICATE";
  if (/(professional|prc).*licen[sc]e/i.test(source)) return "PROFESSIONAL_LICENSE";
  if (/(driver|driving).*licen[sc]e/i.test(source)) return "DRIVERS_LICENSE";
  if (/(certificate.*employment|employment.*certificate)/i.test(source)) return "EMPLOYMENT_CERTIFICATE";
  if (/(certificate|certification|training)/i.test(source)) return "TRAINING_CERTIFICATE";
  return null;
};

const isProtectedComplianceDocument = (label: string, documentType?: string | null) =>
  protectedDocumentPattern.test(`${documentType ?? ""} ${label}`);

const requiredDocuments = (job: { requirements: string; requiredComplianceDocuments?: string[] }) => {
  if (job.requiredComplianceDocuments?.length) return normalizedSet(job.requiredComplianceDocuments);
  const inferred = job.requirements.match(/\b(?:nbi|clearance|license|valid id|medical|certificate)\b/gi) ?? [];
  return normalizedSet(inferred);
};

const calculateComplianceDimension: DimensionCalculator = (candidate, job) => {
  const target = requiredDocuments(job);
  const documents = normalizedSet(candidate.complianceDocuments);
  return {
    dimension: "COMPLIANCE",
    score: overlapPercent(documents, target),
    explanation: { basis: target.size ? "permitted compliance-document match" : "no structured compliance requirement; neutral-to-low score", missingMandatory: documents.size === 0 && target.size > 0 },
  };
};

// ─── INDIVIDUAL DIMENSION CALCULATORS ─────────────────────────────────

const calculateSkillsDimension: DimensionCalculator = (candidate, job) => {
  const requiredSkills = normalizedSet(job.requiredSkills?.length ? job.requiredSkills : [job.title, job.requirements]);
  const candidateSkills = normalizedSet(candidate.skills);
  return {
    dimension: "SKILLS",
    score: overlapPercent(candidateSkills, requiredSkills),
    explanation: { basis: "normalized candidate skills against job requirements", missingMandatory: candidateSkills.size === 0 && requiredSkills.size > 0 },
  };
};

const requiredYearsFromText = (requirements: string) => {
  const match = requirements.match(/\b(\d{1,2})\s*\+?\s*years?\b/i);
  return match ? Number(match[1]) : null;
};

const calculateExperienceDimension: DimensionCalculator = (candidate, job) => {
  const requiredYears = job.requiredYearsExperience ?? requiredYearsFromText(job.requirements);
  const missingMandatory = requiredYears !== null && candidate.yearsExperience === null;
  return {
    dimension: "EXPERIENCE",
    score: requiredYears === null ? 50 : candidate.yearsExperience === null ? 0 : clampScore((Math.min(candidate.yearsExperience, requiredYears) / requiredYears) * 100),
    explanation: { basis: requiredYears === null ? "no structured experience requirement; neutral-to-low score" : "capped years of experience match", missingMandatory },
  };
};

const normalizeLocation = (value: string | null | undefined) =>
  value?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim() || "";

const calculateLocationDimension: DimensionCalculator = (candidate, job) => {
  const target = normalizeLocation(job.location);
  const locations = new Set([candidate.city, candidate.province, ...candidate.preferredAreas].filter((value): value is string => Boolean(value)));
  const missingMandatory = Boolean(target) && locations.size === 0;
  return {
    dimension: "LOCATION",
    score: !target ? 50 : !locations.size ? 0 : [...locations].some((location) => target.includes(location) || location.includes(target)) ? 100 : 0,
    explanation: { basis: target ? "normalized city, province, and preferred-area match" : "job location unspecified; neutral-to-low score", missingMandatory },
  };
};

const calculateEducationCertificationsDimension: DimensionCalculator = (candidate, job) => {
  const target = normalizedSet([...(job.requiredEducation ?? []), ...(job.requiredCertifications ?? [])]);
  const credentials = normalizedSet([...candidate.education, ...candidate.certifications]);
  return {
    dimension: "EDUCATION_CERTIFICATIONS",
    score: overlapPercent(credentials, target),
    explanation: { basis: target.size ? "education and certification match" : "no structured education or certification requirement; neutral-to-low score", missingMandatory: credentials.size === 0 && target.size > 0 },
  };
};

const calculators = [
  calculateSkillsDimension,
  calculateExperienceDimension,
  calculateLocationDimension,
  calculateComplianceDimension,
  calculateEducationCertificationsDimension,
] as const;

export const calculateFitDimensions = (candidate: CandidateFeatureInput, job: JobFeatureInput) => {
  const results = calculators.map((calculator) => calculator(candidate, job));
  return {
    scores: Object.fromEntries(results.map((result) => [result.dimension, result.score])) as Record<ScoringDimension, number>,
    explanations: Object.fromEntries(results.map((result) => [result.dimension, result.explanation])),
    missingMandatory: results.filter((result) => result.explanation.missingMandatory).map((result) => result.dimension),
  };
};
