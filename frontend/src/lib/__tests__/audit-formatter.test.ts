import { describe, it, expect } from "vitest";
import {
  formatAction,
  getActionCategory,
  formatIpAddress,
  formatTargetEntity,
  extractDisplayDetails,
} from "../utils/audit-formatter";
import type { AuditLog } from "../types/admin.types";

describe("Audit Formatter Utility Suite", () => {
  describe("formatAction", () => {
    it("converts developer-style action keys into clean human-readable labels", () => {
      expect(formatAction("USER_LOGGED_IN")).toBe("User Logged In");
      expect(formatAction("PASSWORD_RESET_REQUESTED")).toBe("Password Reset Requested");
      expect(formatAction("TALENT_POOL_REACTIVATION")).toBe("Talent Pool Candidate Reactivated");
      expect(formatAction("KNN_TALENT_POOL_SEARCH")).toBe("Talent Pool Search Performed");
      expect(formatAction("CANDIDATE_SCORING_CONFIGURATION_ACTIVATED")).toBe("Scoring Configuration Activated");
      expect(formatAction("DEPLOYMENT_CREATED")).toBe("Candidate Deployed to Client");
    });

    it("gracefully formats unknown action codes into Title Case", () => {
      expect(formatAction("CUSTOM_SECURITY_CHECK")).toBe("Custom Security Check");
      expect(formatAction("")).toBe("System Action");
    });
  });

  describe("getActionCategory", () => {
    it("maps actions to the 8 standard audit categories", () => {
      expect(getActionCategory("USER_LOGGED_IN")).toBe("Authentication");
      expect(getActionCategory("FAILED_LOGIN_ATTEMPT")).toBe("Authentication");
      expect(getActionCategory("USER_ROLE_UPDATED")).toBe("User Management");
      expect(getActionCategory("APPLICATION_STATUS_UPDATED")).toBe("Recruitment");
      expect(getActionCategory("KNN_TALENT_POOL_SEARCH")).toBe("Talent Pool");
      expect(getActionCategory("SCORING_CONFIG_ACTIVATED")).toBe("Configuration");
      expect(getActionCategory("COMPLIANCE_REQUIREMENT_REVIEWED")).toBe("Compliance");
      expect(getActionCategory("DEPLOYMENT_CREATED")).toBe("Deployment");
    });
  });

  describe("formatIpAddress", () => {
    it("translates localhost IP addresses into clear label", () => {
      expect(formatIpAddress("::1")).toBe("Localhost (::1)");
      expect(formatIpAddress("127.0.0.1")).toBe("Localhost (127.0.0.1)");
      expect(formatIpAddress("::ffff:127.0.0.1")).toBe("Localhost (127.0.0.1)");
      expect(formatIpAddress("192.168.1.100")).toBe("192.168.1.100");
      expect(formatIpAddress(null)).toBe("—");
      expect(formatIpAddress(undefined)).toBe("—");
    });
  });

  describe("formatTargetEntity", () => {
    it("formats User entity without raw User # artifact", () => {
      const logWithEmail: AuditLog = {
        id: 1,
        action: "USER_LOGGED_IN",
        entity: "User",
        entityId: null,
        details: JSON.stringify({ email: "admin@megs-recruitment.com" }),
        createdAt: "2026-08-21T00:00:00Z",
      };
      const result = formatTargetEntity(logWithEmail);
      expect(result.type).toBe("User Account");
      expect(result.label).toBe("admin@megs-recruitment.com");
    });

    it("formats Application entity with job title and applicant", () => {
      const log: AuditLog = {
        id: 2,
        action: "APPLICATION_STATUS_UPDATED",
        entity: "Application",
        entityId: 560,
        details: JSON.stringify({
          jobTitle: "Senior Full Stack Engineer",
          applicantName: "Carlos Mendoza",
        }),
        createdAt: "2026-08-21T00:00:00Z",
      };
      const result = formatTargetEntity(log);
      expect(result.type).toBe("Application");
      expect(result.label).toBe("App #560 • Senior Full Stack Engineer");
      expect(result.secondary).toBe("Carlos Mendoza");
    });

    it("formats Talent Pool entity without raw TalentPool # artifact", () => {
      const log: AuditLog = {
        id: 3,
        action: "KNN_TALENT_POOL_SEARCH",
        entity: "TalentPool",
        entityId: null,
        details: JSON.stringify({}),
        createdAt: "2026-08-21T00:00:00Z",
      };
      const result = formatTargetEntity(log);
      expect(result.type).toBe("Talent Pool");
      expect(result.label).toBe("Talent Pool Candidate");
    });

    it("formats Scoring Configuration entity", () => {
      const log: AuditLog = {
        id: 4,
        action: "CANDIDATE_SCORING_CONFIGURATION_ACTIVATED",
        entity: "CandidateScoringConfiguration",
        entityId: 2,
        details: JSON.stringify({ version: 2 }),
        createdAt: "2026-08-21T00:00:00Z",
      };
      const result = formatTargetEntity(log);
      expect(result.type).toBe("Configuration");
      expect(result.label).toBe("Candidate Scoring v2 (Global)");
    });
  });

  describe("extractDisplayDetails", () => {
    it("extracts structured metadata items from details payload", () => {
      const log: AuditLog = {
        id: 5,
        action: "USER_ROLE_UPDATED",
        entity: "User",
        entityId: null,
        details: JSON.stringify({
          targetEmail: "recruiter@megs-recruitment.com",
          previousRole: "APPLICANT",
          newRole: "TALENT_ACQUISITION",
        }),
        createdAt: "2026-08-21T00:00:00Z",
      };
      const items = extractDisplayDetails(log);
      expect(items).toContainEqual({
        label: "Target Account Email",
        value: "recruiter@megs-recruitment.com",
      });
      expect(items).toContainEqual({
        label: "Role Transition",
        value: "APPLICANT → TALENT_ACQUISITION",
      });
    });
  });
});
