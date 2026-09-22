import type { ApplicantProfile } from "./types/applicant.types";

const KNOWN_SKILL_CASING: Record<string, string> = {
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  typescript: "TypeScript",
  react: "React",
  python: "Python",
  fastapi: "FastAPI",
  sqlmodel: "SQLModel",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  "restful api development": "RESTful API Development",
  "restful apt development": "RESTful API Development",
  "git and github": "Git & GitHub",
  "database management": "Database Management",
  "frontend and backend integration": "Frontend & Backend Integration",
  "data validation": "Data Validation",
  "debugging and troubleshooting": "Debugging & Troubleshooting",
  "responsive web development": "Responsive Web Development",
  "technical documentation": "Technical Documentation",
  "microsoft office": "Microsoft Office",
  "google workspace": "Google Workspace",
  "cctv monitoring": "CCTV Monitoring",
  "forklift operation": "Forklift Operation",
  "customer care": "Customer Care",
  "docker": "Docker",
  "node.js": "Node.js",
  "nodejs": "Node.js",
};

export function formatSkillName(rawSkill: string): string {
  if (!rawSkill) return "";
  const trimmed = rawSkill.trim();
  const lower = trimmed.toLowerCase();

  if (KNOWN_SKILL_CASING[lower]) {
    return KNOWN_SKILL_CASING[lower];
  }

  // Capitalize words properly
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export interface TabStatus {
  id: string;
  isComplete: boolean;
  badgeText?: string;
  itemCount: number;
}

export interface ProfileHealthResult {
  score: number;
  tier: "Incomplete" | "Basic" | "Good" | "Job Ready";
  missingItems: string[];
  nextActionTip: string;
  tabStatuses: Record<string, TabStatus>;
}

export function computeProfileHealth(profile?: ApplicantProfile | null): ProfileHealthResult {
  if (!profile) {
    return {
      score: 0,
      tier: "Incomplete",
      missingItems: [
        "Complete Personal Information",
        "Upload PDF Resume",
        "Add at least 1 Work Experience",
        "Add Educational Attainment",
        "Add at least 3 Technical or Practical Skills",
        "Add at least 1 Character Reference",
        "Upload Profile Photo",
        "Add at least 1 Training or Certification",
      ],
      nextActionTip: "Start by filling out your legal name and contact details.",
      tabStatuses: {
        personal: { id: "personal", isComplete: false, itemCount: 0 },
        documents: { id: "documents", isComplete: false, itemCount: 0 },
        experience: { id: "experience", isComplete: false, itemCount: 0 },
        education: { id: "education", isComplete: false, itemCount: 0 },
        skills: { id: "skills", isComplete: false, itemCount: 0 },
        trainings: { id: "trainings", isComplete: false, itemCount: 0 },
        references: { id: "references", isComplete: false, itemCount: 0 },
      },
    };
  }

  let earnedPoints = 0;
  const missingItems: string[] = [];

  // 1. Personal Info (25 points)
  const hasPersonal = Boolean(
    profile.firstName &&
    profile.lastName &&
    profile.mobileNumber &&
    (profile.dateOfBirth || profile.address)
  );
  if (hasPersonal) earnedPoints += 25;
  else missingItems.push("Complete Personal Information");

  // 2. Resume Upload (20 points)
  const hasResume = Boolean(profile.resumeUrl);
  if (hasResume) earnedPoints += 20;
  else missingItems.push("Upload PDF Resume");

  // 3. Work Experience (15 points)
  const expCount = profile.workExperiences?.length || 0;
  if (expCount > 0) earnedPoints += 15;
  else missingItems.push("Add at least 1 Work Experience");

  // 4. Education (15 points)
  const eduCount = profile.educations?.length || 0;
  if (eduCount > 0) earnedPoints += 15;
  else missingItems.push("Add Educational Attainment");

  // 5. Skills (10 points)
  const skillsCount = profile.skills?.length || 0;
  if (skillsCount >= 3) earnedPoints += 10;
  else if (skillsCount > 0) {
    earnedPoints += 5;
    missingItems.push("Add at least 3 Technical or Practical Skills");
  } else {
    missingItems.push("Add at least 3 Technical or Practical Skills");
  }

  // 6. Character References (5 points)
  const refCount = profile.characterReferences?.length || 0;
  if (refCount > 0) earnedPoints += 5;
  else missingItems.push("Add at least 1 Character Reference");

  // 7. Profile Photo (5 points)
  const hasPhoto = Boolean(profile.photoUrl);
  if (hasPhoto) earnedPoints += 5;
  else missingItems.push("Upload Profile Photo");

  // 8. Trainings & Certifications (5 points)
  const trainingCount = profile.trainings?.length || 0;
  if (trainingCount > 0) earnedPoints += 5;
  else missingItems.push("Add at least 1 Training or Certification");

  const score = Math.min(100, earnedPoints);

  let tier: ProfileHealthResult["tier"] = "Incomplete";
  if (score >= 85) tier = "Job Ready";
  else if (score >= 60) tier = "Good";
  else if (score >= 35) tier = "Basic";

  let nextActionTip = "Your profile is in top shape! You are ready to apply for matching job openings.";
  if (missingItems.length > 0) {
    nextActionTip = `Recommended next step: ${missingItems[0]}.`;
  }

  const tabStatuses: Record<string, TabStatus> = {
    personal: {
      id: "personal",
      isComplete: hasPersonal,
      badgeText: hasPersonal ? "Complete" : "Incomplete",
      itemCount: hasPersonal ? 1 : 0,
    },
    documents: {
      id: "documents",
      isComplete: hasResume && hasPhoto,
      badgeText: hasResume && hasPhoto ? "Complete" : hasResume ? "Resume on file" : "Missing",
      itemCount: (hasResume ? 1 : 0) + (hasPhoto ? 1 : 0),
    },
    experience: {
      id: "experience",
      isComplete: expCount > 0,
      badgeText: `${expCount} ${expCount === 1 ? "role" : "roles"}`,
      itemCount: expCount,
    },
    education: {
      id: "education",
      isComplete: eduCount > 0,
      badgeText: `${eduCount} ${eduCount === 1 ? "degree" : "degrees"}`,
      itemCount: eduCount,
    },
    skills: {
      id: "skills",
      isComplete: skillsCount >= 3,
      badgeText: `${skillsCount} skills`,
      itemCount: skillsCount,
    },
    trainings: {
      id: "trainings",
      isComplete: trainingCount > 0,
      badgeText: `${trainingCount} certs`,
      itemCount: trainingCount,
    },
    references: {
      id: "references",
      isComplete: refCount > 0,
      badgeText: `${refCount} contacts`,
      itemCount: refCount,
    },
  };

  return {
    score,
    tier,
    missingItems,
    nextActionTip,
    tabStatuses,
  };
}
