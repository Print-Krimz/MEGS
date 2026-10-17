import type {
  CandidateFeatureInput,
  JobFeatureInput,
  ScoringDimension,
  DimensionResult,
  DimensionExplanation,
  DimensionStatus,
} from "./scoring.types.js";

const NC_LEVELS: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", "1": "1", "2": "2", "3": "3", "4": "4" };

const tokenize = (text: string): string[] =>
  (
    text
      .toLocaleLowerCase("en-US")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      // TESDA levels: "NC II", "NC 2", "NC-II" and "NCII" all become one token ("nc2").
      .replace(/\bnc\s*-?\s*(iv|iii|ii|i|[1-4])\b/g, (_, level: string) => ` nc${NC_LEVELS[level]} `)
      .match(/[a-z0-9+#.]+/g) ?? []
  )
    // Sentence punctuation is not part of a word: "safety." matches "safety"; "node.js" keeps its dot.
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length >= 2);

/**
 * Word forms and common job-title variants that mean the same thing in recruitment text.
 * Applied to skills and experience matching only (credential matching keeps exact words).
 */
const JOB_TERM_CANONICAL: Record<string, string> = {
  driver: "operator", drivers: "operator", driving: "operator",
  operator: "operator", operators: "operator", operating: "operator", operate: "operator", operation: "operator",
  helper: "assistant", helpers: "assistant", assistants: "assistant", assisting: "assistant",
  warehouseman: "warehouse", warehousemen: "warehouse", warehousing: "warehouse",
  welder: "welding", welders: "welding", weld: "welding",
  cashier: "cashiering", cashiers: "cashiering",
  packer: "packing", packers: "packing", pack: "packing",
  cleaner: "cleaning", cleaners: "cleaning", janitor: "cleaning", janitorial: "cleaning",
  cook: "cooking", cooks: "cooking",
  encoder: "encoding", encoders: "encoding",
  mechanic: "mechanical", mechanics: "mechanical",
  electrician: "electrical", electricians: "electrical",
  carpenter: "carpentry", carpenters: "carpentry",
  guard: "security", guards: "security",
  salesman: "sales", saleslady: "sales", salesperson: "sales",
};

const canonicalTerm = (token: string) => JOB_TERM_CANONICAL[token] ?? token;

/** Tokens for skills/experience comparison, with job-term variants unified. */
// Variants are unified before the skip list applies, so "operation" (a skipped generic word)
// still counts once it means "operator".
const termSet = (values: string[], skip?: Set<string>) =>
  new Set(values.flatMap(tokenize).map(canonicalTerm).filter((token) => !skip?.has(token)));

// Filler words in free-text requirements that are not qualifications (English and Filipino).
const REQUIREMENT_FILLER = new Set([
  "and", "or", "the", "to", "in", "for", "of", "with", "at", "by", "from", "on", "as", "is", "are", "be",
  "must", "should", "can", "will", "may", "able", "ability", "least", "have", "has", "having", "good", "knowledge",
  "preferred", "required", "requirement", "requirements", "willing", "year", "years", "yrs", "experience",
  "experienced", "plus", "advantage", "applicant", "applicants", "candidate", "candidates", "minimum", "etc",
  "also", "who", "that", "this", "any", "related", "field", "work", "working", "job", "position", "role",
  "na", "ng", "sa", "mga", "ang", "taon",
]);

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
  "CONTRACT_SIGNING",
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

  // Compare on unified job terms; requirement free text loses filler words so a fully
  // qualified candidate is not capped by words like "must" or "at least".
  const exactTargets = job.requiredSkills?.length
    ? termSet(job.requiredSkills)
    : termSet([job.title, job.requirements], REQUIREMENT_FILLER);
  const contextTargets = new Set([
    ...termSet([job.title, job.requirements], REQUIREMENT_FILLER),
    ...termSet(job.requiredSkills ?? []),
  ]);
  const candidateSkills = termSet(candidate.skills);
  const candidateContext = termSet([...candidate.skills, ...candidate.roleExperience]);

  const exactScore = overlapPercent(candidateSkills, exactTargets, 0);
  const contextualScore = overlapPercent(candidateContext, contextTargets, 0);
  let hybridScore = clampScore(0.5 * exactScore + 0.5 * contextualScore);

  // Semantic similarity (Gemini embeddings) adds partial credit for meaning. It never lowers
  // the word-based score and never replaces it outright.
  if (typeof knnSimilarity === "number" && Number.isFinite(knnSimilarity) && knnSimilarity > 0) {
    const semanticScore = clampScore(knnSimilarity * 100);
    hybridScore = Math.max(hybridScore, clampScore(0.5 * hybridScore + 0.5 * semanticScore));
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

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  isa: 1, isang: 1, dalawa: 2, dalawang: 2, tatlo: 3, tatlong: 3, apat: 4, lima: 5, limang: 5,
  anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10, sampung: 10,
};

const COUNT = String.raw`(\d{1,2}(?:\.\d)?|one|two|three|four|five|six|seven|eight|nine|ten|isang?|dalawang?|tatlong?|apat|limang?|anim|pito|walo|siyam|sampung?)`;
const RANGE_TAIL = String.raw`\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?\+?\s*`;
const YEARS_PATTERN = new RegExp(String.raw`\b${COUNT}${RANGE_TAIL}(?:years?|yrs?|taong?)\b`);
const MONTHS_PATTERN = new RegExp(String.raw`\b${COUNT}${RANGE_TAIL}(?:months?|mos?|buwan)\b`);

const parseCount = (value: string): number | null => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return NUMBER_WORDS[value] ?? null;
};

/**
 * Required years of experience from free text, or null when none (or zero) is stated.
 * Handles "2+ years", "2 yrs", "two years", "2 taon", "6 months"; a range ("1-2 years") uses
 * its lower bound. Age limits ("18-35 years old", "Age: 18 to 35") are ignored.
 */
export const requiredYearsFromText = (requirements: string) => {
  const text = requirements
    .toLowerCase()
    // "three (3) years" -> "three 3 years"
    .replace(/\((\d{1,2})\)/g, " $1 ")
    // Age limits end at the next comma or sentence: "Age 21-40, 2 years experience" keeps "2 years".
    .replace(/\b(?:age|aged|edad)\b[^.;,\n]{0,40}/g, " ")
    .replace(/\d{1,2}\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?(?:years?|yrs?|taong?)\s*(?:old|gulang)\b/g, " ");
  const years = text.match(YEARS_PATTERN);
  if (years) {
    const value = parseCount(years[1]);
    return value && value > 0 ? value : null;
  }
  const months = text.match(MONTHS_PATTERN);
  if (months) {
    const value = parseCount(months[1]);
    return value && value > 0 ? Math.round((value / 12) * 100) / 100 : null;
  }
  return null;
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
  // Zero required years is "no requirement" (and would otherwise divide by zero).
  if (requiredYears === null || !(requiredYears > 0)) {
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

  // Unknown years: the profile lacks the data, so leave experience out of the score.
  if (candidate.yearsExperience == null || !Number.isFinite(candidate.yearsExperience)) {
    return {
      dimension: "EXPERIENCE",
      score: 0,
      dimensionStatus: "NOT_ASSESSED",
      isApplicable: false,
      explanation: {
        basis: "no work history in the profile; experience not assessed",
        missingMandatory: true,
        dimensionStatus: "NOT_ASSESSED",
        isApplicable: false,
      },
    };
  }

  // Domain check: does the work history relate to this job? Target terms come from the title
  // and required skills (free-text requirements add filler words), with job-term variants unified.
  const targetDomainSource = job.requiredSkills?.length
    ? [job.title, ...job.requiredSkills]
    : [job.title, job.requirements];
  const domainSkip = new Set([...EXPERIENCE_STOPWORDS, ...REQUIREMENT_FILLER]);
  const targetDomainTokens = termSet(targetDomainSource.filter(Boolean), domainSkip);
  const candidateExpTokens = termSet([...(candidate.roleExperience ?? []), ...candidate.skills], domainSkip);

  let matches = 0;
  for (const term of targetDomainTokens) {
    if (matchesDomainToken(term, candidateExpTokens)) {
      matches += 1;
    }
  }

  const overlapRatio = targetDomainTokens.size > 0 ? matches / targetDomainTokens.size : 1;
  const hasPriorRoles = (candidate.roleExperience ?? []).length > 0;

  // Years exist but the wording doesn't show they are in this field. Don't score it as zero:
  // leave it out of the score and flag it for TA to check with the candidate.
  if (hasPriorRoles && targetDomainTokens.size > 0 && (matches === 0 || overlapRatio < 0.15)) {
    return {
      dimension: "EXPERIENCE",
      score: 0,
      dimensionStatus: "NEEDS_REVIEW",
      isApplicable: false,
      explanation: {
        basis: "work history does not clearly match this role; check with the candidate",
        missingMandatory: false,
        dimensionStatus: "NEEDS_REVIEW",
        isApplicable: false,
      },
    };
  }

  const missingMandatory = false;
  const score = clampScore((Math.min(candidate.yearsExperience, requiredYears) / requiredYears) * 100);
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

/** One place name without generic words: "City of Manila" and "Manila City" -> "manila". */
const placeName = (value: string | null | undefined) =>
  normalizeLocation(value)
    .replace(/\b(?:city|of|municipality|province|prov)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
  const candidateLocations = rawLocations.map(placeName).filter(Boolean);
  if (candidateLocations.length === 0) {
    return {
      dimension: "LOCATION",
      score: 0,
      dimensionStatus: "NOT_ASSESSED",
      isApplicable: false,
      explanation: {
        basis: "no city, province or preferred area in the profile; location not assessed",
        missingMandatory: true,
        dimensionStatus: "NOT_ASSESSED",
        isApplicable: false,
      },
    };
  }

  // Compare whole place names ("Antipolo City, Rizal" -> antipolo, rizal), not substrings,
  // so province "Rizal" does not match a street such as "Rizal Avenue, Manila".
  const jobPlaces = new Set((job.location ?? "").split(/[,/;|]/).map(placeName).filter(Boolean));
  const missingMandatory = false;
  // A place also matches the end of a longer region name ("Manila" in "Metro Manila"),
  // never the start of a street ("Rizal" in "Rizal Avenue").
  const isMatch = candidateLocations.some((location) =>
    [...jobPlaces].some((place) => place === location || place.endsWith(` ${location}`))
  );

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
