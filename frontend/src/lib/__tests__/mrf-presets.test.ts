import { describe, it, expect } from "vitest";
import {
  MRF_ROLE_PRESETS,
  MRF_PARTNER_INDUSTRIES,
  getMRFPresetById,
  getPresetsByIndustry,
  MRFRolePreset,
  parseSkillsArray,
  formatSkillsList,
} from "../mrf-presets";

describe("MRF Standard Role Presets (mrf-presets)", () => {
  const EXPECTED_PRESET_IDS = [
    "sales-promo-merchandiser",
    "cashier-bagger",
    "brand-ambassador",
    "food-server",
    "delivery-driver",
    "messenger",
    "logistics-clerk",
    "forklift-operator",
    "warehouse-associate",
    "inventory-encoder",
    "production-worker",
    "production-supervisor",
    "machine-operator",
    "qa-inspector",
    "welder",
    "utility-helper",
    "casino-floor-attendant",
    "admin-assistant",
    "customer-service",
  ];

  it("exports MRF_PARTNER_INDUSTRIES with all required partner industries", () => {
    expect(MRF_PARTNER_INDUSTRIES).toBeDefined();
    expect(Array.isArray(MRF_PARTNER_INDUSTRIES)).toBe(true);
    expect(MRF_PARTNER_INDUSTRIES).toContain("Retail, Sales and Distribution");
    expect(MRF_PARTNER_INDUSTRIES).toContain("Hotel and Restaurant");
    expect(MRF_PARTNER_INDUSTRIES).toContain("Logistics");
    expect(MRF_PARTNER_INDUSTRIES).toContain("Warehousing");
    expect(MRF_PARTNER_INDUSTRIES).toContain("Manufacturing");
    expect(MRF_PARTNER_INDUSTRIES).toContain("Gaming and Casino");
    expect(MRF_PARTNER_INDUSTRIES).toContain("Corporate & Administration");
  });

  it("contains all 19 standard vetted role presets (>= 17 presets)", () => {
    expect(MRF_ROLE_PRESETS.length).toBeGreaterThanOrEqual(17);
    expect(MRF_ROLE_PRESETS).toHaveLength(19);
    const presetIds = MRF_ROLE_PRESETS.map((p) => p.id);
    EXPECTED_PRESET_IDS.forEach((id) => {
      expect(presetIds).toContain(id);
    });
  });

  it("ensures each preset has complete and valid required fields", () => {
    MRF_ROLE_PRESETS.forEach((preset: MRFRolePreset) => {
      // Identity & Classification
      expect(preset.id).toBeTruthy();
      expect(typeof preset.id).toBe("string");
      expect(preset.label.trim().length).toBeGreaterThan(0);
      expect(preset.category.trim().length).toBeGreaterThan(0);
      expect((MRF_PARTNER_INDUSTRIES as readonly string[])).toContain(preset.category);
      expect(preset.title.trim().length).toBeGreaterThan(0);

      // Requirements
      expect(preset.requiredSkills.trim().length).toBeGreaterThan(0);
      expect(preset.requiredExperience.trim().length).toBeGreaterThan(0);
      expect(preset.requiredEducation.trim().length).toBeGreaterThan(0);
      expect(preset.requiredCertifications.trim().length).toBeGreaterThan(0);

      // Compensation & Arrangements
      expect(preset.salaryMin).toBeGreaterThan(0);
      expect(preset.salaryMax).toBeGreaterThan(preset.salaryMin);
      expect(preset.employmentType.trim().length).toBeGreaterThan(0);
      expect(preset.workArrangement.trim().length).toBeGreaterThan(0);

      // Overview
      expect(preset.description.trim().length).toBeGreaterThan(20);
    });
  });

  it("has unique IDs for every preset", () => {
    const ids = MRF_ROLE_PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(MRF_ROLE_PRESETS.length);
  });

  describe("getMRFPresetById", () => {
    it("returns the corresponding preset when a valid ID is passed", () => {
      EXPECTED_PRESET_IDS.forEach((id) => {
        const found = getMRFPresetById(id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(id);
      });
    });

    it("returns specific known presets with expected attributes", () => {
      const forklift = getMRFPresetById("forklift-operator");
      expect(forklift).toBeDefined();
      expect(forklift?.category).toBe("Warehousing");
      expect(forklift?.title).toBe("Forklift Operator (Heavy Equipment)");
      expect(forklift?.salaryMin).toBe(18000);
      expect(forklift?.salaryMax).toBe(26000);

      const welder = getMRFPresetById("welder");
      expect(welder).toBeDefined();
      expect(welder?.category).toBe("Manufacturing");
      expect(welder?.salaryMin).toBe(20000);
      expect(welder?.salaryMax).toBe(32000);
    });

    it("returns undefined for non-existent preset IDs", () => {
      expect(getMRFPresetById("non-existent-id")).toBeUndefined();
      expect(getMRFPresetById("")).toBeUndefined();
      expect(getMRFPresetById("unknown-role")).toBeUndefined();
    });
  });

  describe("getPresetsByIndustry", () => {
    it("groups presets by industry matching MRF_PARTNER_INDUSTRIES", () => {
      const grouped = getPresetsByIndustry();
      expect(grouped).toBeDefined();

      // Check all industries exist as keys
      for (const industry of MRF_PARTNER_INDUSTRIES) {
        expect(grouped[industry]).toBeDefined();
        expect(Array.isArray(grouped[industry])).toBe(true);
        expect(grouped[industry].length).toBeGreaterThan(0);
      }

      // Check specific industries contain expected role IDs
      const retailIds = grouped["Retail, Sales and Distribution"].map((p) => p.id);
      expect(retailIds).toEqual(["sales-promo-merchandiser", "cashier-bagger", "brand-ambassador"]);

      const hotelIds = grouped["Hotel and Restaurant"].map((p) => p.id);
      expect(hotelIds).toEqual(["food-server"]);

      const logisticsIds = grouped["Logistics"].map((p) => p.id);
      expect(logisticsIds).toEqual(["delivery-driver", "messenger", "logistics-clerk"]);

      const warehousingIds = grouped["Warehousing"].map((p) => p.id);
      expect(warehousingIds).toEqual(["forklift-operator", "warehouse-associate", "inventory-encoder"]);

      const manufacturingIds = grouped["Manufacturing"].map((p) => p.id);
      expect(manufacturingIds).toEqual([
        "production-worker",
        "production-supervisor",
        "machine-operator",
        "qa-inspector",
        "welder",
      ]);

      const gamingIds = grouped["Gaming and Casino"].map((p) => p.id);
      expect(gamingIds).toEqual(["utility-helper", "casino-floor-attendant"]);

      const corporateIds = grouped["Corporate & Administration"].map((p) => p.id);
      expect(corporateIds).toEqual(["admin-assistant", "customer-service"]);

      // Verify total grouped presets equals total MRF_ROLE_PRESETS
      const totalGrouped = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
      expect(totalGrouped).toBe(MRF_ROLE_PRESETS.length);
    });
  });

  describe("parseSkillsArray & formatSkillsList", () => {
    it("parses stringified JSON array into clean skills array and formatted string", () => {
      const rawJson = '["Machinery Operation","Preventive Maintenance","Mechanical Troubleshooting"]';
      const array = parseSkillsArray(rawJson);
      expect(array).toEqual([
        "Machinery Operation",
        "Preventive Maintenance",
        "Mechanical Troubleshooting",
      ]);
      expect(formatSkillsList(rawJson)).toBe(
        "Machinery Operation, Preventive Maintenance, Mechanical Troubleshooting"
      );
    });

    it("handles plain comma-separated strings without modification", () => {
      const plain = "Forklift Operation, 5S Methodology, Safety Compliance";
      expect(parseSkillsArray(plain)).toEqual([
        "Forklift Operation",
        "5S Methodology",
        "Safety Compliance",
      ]);
      expect(formatSkillsList(plain)).toBe(
        "Forklift Operation, 5S Methodology, Safety Compliance"
      );
    });

    it("handles null, undefined, and empty inputs gracefully", () => {
      expect(parseSkillsArray(null)).toEqual([]);
      expect(parseSkillsArray(undefined)).toEqual([]);
      expect(parseSkillsArray("")).toEqual([]);
      expect(formatSkillsList(null)).toBe("");
      expect(formatSkillsList(undefined)).toBe("");
      expect(formatSkillsList("")).toBe("");
    });
  });
});
