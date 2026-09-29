import { describe, it, expect } from "vitest";
import { MRF_ROLE_PRESETS, getMRFPresetById, MRFRolePreset } from "../mrf-presets";

describe("MRF Standard Role Presets (mrf-presets)", () => {
  const EXPECTED_PRESET_IDS = [
    "forklift-operator",
    "warehouse-associate",
    "production-worker",
    "logistics-clerk",
    "qa-inspector",
    "delivery-driver",
    "customer-service",
    "admin-assistant",
  ];

  it("contains exactly the 8 standard vetted role presets", () => {
    expect(MRF_ROLE_PRESETS).toHaveLength(8);
    const presetIds = MRF_ROLE_PRESETS.map((p) => p.id);
    expect(presetIds).toEqual(EXPECTED_PRESET_IDS);
  });

  it("ensures each preset has complete and valid required fields", () => {
    MRF_ROLE_PRESETS.forEach((preset: MRFRolePreset) => {
      // Identity & Classification
      expect(preset.id).toBeTruthy();
      expect(typeof preset.id).toBe("string");
      expect(preset.label.trim().length).toBeGreaterThan(0);
      expect(preset.category.trim().length).toBeGreaterThan(0);
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

    it("returns undefined for non-existent preset IDs", () => {
      expect(getMRFPresetById("non-existent-id")).toBeUndefined();
      expect(getMRFPresetById("")).toBeUndefined();
      expect(getMRFPresetById("unknown-role")).toBeUndefined();
    });
  });
});
