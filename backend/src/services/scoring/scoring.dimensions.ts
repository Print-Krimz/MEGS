import type {
  CandidateFeatureInput,
  JobFeatureInput,
  ScoringDimension,
  DimensionResult,
  DimensionExplanation,
  DimensionStatus,
} from "./scoring.types.js";

const tokenize = (text: string): string[] =>
  text
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9+#.]{2,}/g) ?? [];

type DimensionCalculator = (candidate: CandidateFeatureInput, job: JobFeatureInput) => DimensionResult;

export const clampScore = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;

const normalizedSet = (values: string[]) => new Set(values.flatMap(tokenize));

const overlapPercent = (candidate: Set<string>, target: Set<string>, unknownScore = 0) => {
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

const preEmploymentClearanceTerms = new Set([
  "nbi",
  "police",
  "barangay",
  "medical",
  "fit",
  "health",
  "clearance",
  "nbi_clearance",
  "police_clearance",
  "barangay_clearance",
  "medical_certificate",
]);

const COMPLIANCE_AND_LATER_STAGES = new Set([
  "COMPLIANCE",
  "CONTRACT_AND_ORIENTATION",
  "DEPLOYED",
  "HIRED",
  "ONBOARDING",
]);

const calculateComplianceDimension: DimensionCalculator = (candidate, job) => {
  const target = requiredDocuments(job);
  const documents = normalizedSet(candidate.complianceDocuments);
  if (!target.size) {
    return {
      dimension: "COMPLIANCE",
      score: 0,
      dimensionStatus: "PENDING_ONBOARDING_STAGE",
      isApplicable: false,
      explanation: {
        basis: "Compliance and onboarding documents are verified during the Requirements stage (Stage 5)",
        missingMandatory: false,
        dimensionStatus: "PENDING_ONBOARDING_STAGE",
        isApplicable: false,
      },
    };
  }

  const score = overlapPercent(documents, target, 0);
  const hasUploadedAll = target.size > 0 && score === 100;

  const stage = job.applicationStage?.trim().toUpperCase();
  const isComplianceOrLater = Boolean(stage && COMPLIANCE_AND_LATER_STAGES.has(stage));

  // If application is before COMPLIANCE stage and candidate has not uploaded all required compliance documents:
  // mark as PENDING_ONBOARDING_STAGE, isApplicable: false, missingMandatory: false
  if (!isComplianceOrLater) {
    if (hasUploadedAll) {
      return {
        dimension: "COMPLIANCE",
        score: 100,
        dimensionStatus: "EVALUATED",
        isApplicable: true,
        explanation: {
          basis: "permitted compliance-document match",
          missingMandatory: false,
          dimensionStatus: "EVALUATED",
          isApplicable: true,
        },
      };
    }

    return {
      dimension: "COMPLIANCE",
      score: 0,
      dimensionStatus: "PENDING_ONBOARDING_STAGE",
      isApplicable: false,
      explanation: {
        basis: "Compliance and onboarding documents are verified during the Requirements stage (Stage 5)",
        missingMandatory: false,
        dimensionStatus: "PENDING_ONBOARDING_STAGE",
        isApplicable: false,
      },
    };
  }

  // Application is at or after COMPLIANCE stage (Stage 5 Requirements or later)
  const missingMandatory = score < 100;
  return {
    dimension: "COMPLIANCE",
    score,
    dimensionStatus: "EVALUATED",
    isApplicable: true,
    explanation: {
      basis: "permitted compliance-document match",
      missingMandatory,
      dimensionStatus: "EVALUATED",
      isApplicable: true,
    },
  };
};

// ─── INDIVIDUAL DIMENSION CALCULATORS ─────────────────────────────────

const calculateSkillsDimension = (candidate: CandidateFeatureInput, job: JobFeatureInput, knnSimilarity?: number): DimensionResult => {
  const targetSkills = normalizedSet(job.requiredSkills?.length ? job.requiredSkills : [job.title, job.requirements]);
  const targetContext = normalizedSet([job.title, job.requirements, ...(job.requiredSkills ?? [])]);

  if (!targetSkills.size && !targetContext.size) {
    return {
      dimension: "SKILLS",
      score: 0,
      dimensionStatus: "NOT_REQUIRED",
      isApplicable: false,
      explanation: {
        basis: "no skills or job requirements specified",
        missingMandatory: false,
        dimensionStatus: "NOT_REQUIRED",
        isApplicable: false,
      },
    };
  }

  const candidateSkills = normalizedSet(candidate.skills);
  const candidateContext = normalizedSet([...candidate.skills, ...candidate.roleExperience]);

  const exactScore = overlapPercent(candidateSkills, targetSkills, 0);
  const contextualScore = overlapPercent(candidateContext, targetContext, 0);
  let hybridScore = clampScore(0.5 * exactScore + 0.5 * contextualScore);

  // If semantic vector similarity is available from pgvector/Gemini embeddings, blend it
  if (typeof knnSimilarity === "number" && Number.isFinite(knnSimilarity) && knnSimilarity > 0) {
    const semanticScore = clampScore(knnSimilarity * 100);
    hybridScore = exactScore > 0
      ? clampScore(0.5 * exactScore + 0.5 * semanticScore)
      : clampScore(semanticScore);
  }

  const missingMandatory = candidateSkills.size === 0 && candidate.roleExperience.length === 0 && targetSkills.size > 0;

  return {
    dimension: "SKILLS",
    score: hybridScore,
    dimensionStatus: "EVALUATED",
    isApplicable: true,
    explanation: {
      basis: "normalized candidate skills and contextual role experience against job requirements",
      missingMandatory,
      dimensionStatus: "EVALUATED",
      isApplicable: true,
    },
  };
};

export const requiredYearsFromText = (requirements: string) => {
  const match = requirements.match(/\b(\d{1,2})\s*\+?\s*years?\b/i);
  return match ? Number(match[1]) : null;
};

const EXPERIENCE_STOPWORDS = new Set([
  "and",
  "the",
  "to",
  "in",
  "for",
  "of",
  "with",
  "at",
  "by",
  "from",
  "on",
  "as",
  "an",
  "is",
  "are",
  "was",
  "were",
  "using",
  "supporting",
  "responsible",
  "daily",
  "routine",
  "basic",
  "general",
  "work",
  "working",
  "team",
  "assigned",
  "performed",
  "assisted",
  "support",
  "clear",
  "clearly",
  "timely",
  "accurate",
  "attention",
  "skills",
  "able",
  "years",
  "experience",
  "background",
  "operations",
  "operation",
  "system",
  "systems",
  "documentation",
  "document",
  "documented",
  "record",
  "records",
  "management",
  "managing",
  "technical",
  "troubleshooting",
  "process",
  "processes",
  "workflow",
  "workflows",
  "internal",
  "office",
  "data",
  "validation",
  "organize",
  "maintaining",
  "maintain",
]);

const matchesDomainToken = (term: string, tokens: Set<string>): boolean => {
  if (tokens.has(term)) return true;
  if (term.endsWith("s") && tokens.has(term.slice(0, -1))) return true;
  if (tokens.has(term + "s")) return true;
  if (term.endsWith("ing") && tokens.has(term.slice(0, -3))) return true;
  return false;
};

const calculateExperienceDimension: DimensionCalculator = (candidate, job) => {
  const requiredYears = job.requiredYearsExperience ?? (job.requirements ? requiredYearsFromText(job.requirements) : null);
  if (requiredYears === null) {
    return {
      dimension: "EXPERIENCE",
      score: 0,
      dimensionStatus: "NOT_REQUIRED",
      isApplicable: false,
      explanation: {
        basis: "no structured experience requirement; not required",
        missingMandatory: false,
        dimensionStatus: "NOT_REQUIRED",
        isApplicable: false,
      },
    };
  }

  // Extract domain tokens from candidate's roleExperience and target job domain
  const targetDomainSource = [job.title, job.requirements, ...(job.requiredSkills ?? [])].filter(Boolean);
  const targetDomainTokens = new Set(targetDomainSource.flatMap(tokenize).filter((t) => !EXPERIENCE_STOPWORDS.has(t)));
  const candidateExpTokens = new Set((candidate.roleExperience ?? []).flatMap(tokenize).filter((t) => !EXPERIENCE_STOPWORDS.has(t)));

  let matches = 0;
  for (const term of targetDomainTokens) {
    if (matchesDomainToken(term, candidateExpTokens)) {
      matches += 1;
    }
  }

  const overlapRatio = targetDomainTokens.size > 0 ? matches / targetDomainTokens.size : 1;
  const hasPriorRoles = (candidate.roleExperience ?? []).length > 0;

  // If candidate has prior roles but domain overlap is zero or below threshold (< 0.15 or 0 matching meaningful terms)
  if (hasPriorRoles && targetDomainTokens.size > 0 && (matches === 0 || overlapRatio < 0.15)) {
    return {
      dimension: "EXPERIENCE",
      score: 0,
      dimensionStatus: "EVALUATED",
      isApplicable: true,
      explanation: {
        basis: "no domain-relevant work experience found for target role",
        missingMandatory: candidate.yearsExperience === null,
        dimensionStatus: "EVALUATED",
        isApplicable: true,
      },
    };
  }

  const missingMandatory = candidate.yearsExperience === null;
  const score = candidate.yearsExperience === null ? 0 : clampScore((Math.min(candidate.yearsExperience, requiredYears) / requiredYears) * 100);
  return {
    dimension: "EXPERIENCE",
    score,
    dimensionStatus: "EVALUATED",
    isApplicable: true,
    explanation: {
      basis: "capped years of experience match",
      missingMandatory,
      dimensionStatus: "EVALUATED",
      isApplicable: true,
    },
  };
};

const normalizeLocation = (value: string | null | undefined) =>
  value?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim() || "";

const calculateLocationDimension: DimensionCalculator = (candidate, job) => {
  const target = normalizeLocation(job.location);
  if (!target) {
    return {
      dimension: "LOCATION",
      score: 0,
      dimensionStatus: "NOT_REQUIRED",
      isApplicable: false,
      explanation: {
        basis: "job location unspecified; not required",
        missingMandatory: false,
        dimensionStatus: "NOT_REQUIRED",
        isApplicable: false,
      },
    };
  }

  const rawLocations = [candidate.city, candidate.province, ...candidate.preferredAreas].filter((value): value is string => Boolean(value));
  const candidateLocations = rawLocations.map(normalizeLocation).filter(Boolean);
  const missingMandatory = candidateLocations.length === 0;
  const isMatch = candidateLocations.some((location) => target.includes(location) || location.includes(target));

  return {
    dimension: "LOCATION",
    score: isMatch ? 100 : 0,
    dimensionStatus: "EVALUATED",
    isApplicable: true,
    explanation: {
      basis: "normalized city, province, and preferred-area match",
      missingMandatory,
      dimensionStatus: "EVALUATED",
      isApplicable: true,
    },
  };
};

const expandCredentialTokens = (tokens: string[]): string[] => {
  const expanded: string[] = [];
  let hasDriver = false;
  let hasLicense = false;

  for (const token of tokens) {
    expanded.push(token);
    if (token === "drivers" || token === "driver") {
      hasDriver = true;
      expanded.push("driver", "drivers");
    }

    if (token.startsWith("licen")) {
      hasLicense = true;
      expanded.push("license", "licenses");
    }

    if (token === "professional" || token === "prc") {
      expanded.push("prc", "professional");
    }

    if (token.startsWith("cert")) {
      expanded.push("cert", "certificate", "certification", "certifications", "certificates");
    }

    if (token === "nc2" || token === "ncii") {
      expanded.push("nc", "ii", "2");
    } else if (token === "ii" || token === "2") {
      expanded.push("ii", "2");
    } else if (token === "iii" || token === "3") {
      expanded.push("iii", "3");
    }
  }

  // A driver's license credential in Philippine recruitment satisfies Professional Driver's License requirements
  if (hasDriver && hasLicense) {
    expanded.push("professional");
  }

  return expanded;
};

const calculateEducationCertificationsDimension: DimensionCalculator = (candidate, job) => {
  const target = normalizedSet([...(job.requiredEducation ?? []), ...(job.requiredCertifications ?? [])]);
  if (!target.size) {
    return {
      dimension: "EDUCATION_CERTIFICATIONS",
      score: 0,
      dimensionStatus: "NOT_REQUIRED",
      isApplicable: false,
      explanation: {
        basis: "no structured education or certification requirement; not required",
        missingMandatory: false,
        dimensionStatus: "NOT_REQUIRED",
        isApplicable: false,
      },
    };
  }

  // Include credentials from education, trainings/certifications, verified document assets, and skills
  const rawCredentials = [
    ...candidate.education,
    ...candidate.certifications,
    ...candidate.complianceDocuments,
    ...candidate.skills,
  ];
  const credentialTokens = rawCredentials.flatMap(tokenize);
  const credentials = new Set(expandCredentialTokens(credentialTokens));
  const score = overlapPercent(credentials, target, 0);
  const missingMandatory = credentials.size === 0;

  return {
    dimension: "EDUCATION_CERTIFICATIONS",
    score,
    dimensionStatus: "EVALUATED",
    isApplicable: true,
    explanation: {
      basis: "education and certification match",
      missingMandatory,
      dimensionStatus: "EVALUATED",
      isApplicable: true,
    },
  };
};

const calculators = [
  calculateSkillsDimension,
  calculateExperienceDimension,
  calculateLocationDimension,
  calculateComplianceDimension,
  calculateEducationCertificationsDimension,
] as const;

export const calculateFitDimensions = (
  candidate: CandidateFeatureInput,
  job: JobFeatureInput,
  knnSimilarity?: number,
  applicationStage?: string | null
) => {
  const effectiveJob = applicationStage !== undefined ? { ...job, applicationStage } : job;
  const results = calculators.map((calculator) => {
    if (calculator === calculateSkillsDimension) {
      return calculateSkillsDimension(candidate, effectiveJob, knnSimilarity);
    }
    return calculator(candidate, effectiveJob);
  });
  return {
    scores: Object.fromEntries(results.map((result) => [result.dimension, result.score])) as Record<ScoringDimension, number>,
    explanations: Object.fromEntries(results.map((result) => [result.dimension, result.explanation])) as Record<ScoringDimension, DimensionExplanation>,
    dimensionStatuses: Object.fromEntries(results.map((result) => [result.dimension, result.dimensionStatus])) as Record<ScoringDimension, DimensionStatus>,
    dimensionsApplicable: Object.fromEntries(results.map((result) => [result.dimension, result.isApplicable])) as Record<ScoringDimension, boolean>,
    missingMandatory: results.filter((result) => result.explanation.missingMandatory).map((result) => result.dimension),
    results,
  };
};
