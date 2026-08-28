import { describe, it, expect } from "vitest";
import {
  COMPLIANCE_201_PRESETS,
  EMPLOYMENT_TYPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  RELATIONSHIP_PRESETS,
  EDUCATION_DEGREE_PRESETS,
  formatPresetOption,
} from "../hr-constants";

describe("HR Standard Constants & Presets (hr-constants)", () => {
  it("provides standard Philippine 201 compliance document templates", () => {
    expect(COMPLIANCE_201_PRESETS.length).toBeGreaterThanOrEqual(10);
    const labels = COMPLIANCE_201_PRESETS.map((p) => p.label);
    expect(labels).toContain("NBI Clearance");
    expect(labels).toContain("Police Clearance");
    expect(labels).toContain("SSS Static / E-1 Form");
    expect(labels).toContain("PhilHealth Member Data Record (MDR)");
    expect(labels).toContain("Pag-IBIG Member ID (MID) Form");
    expect(labels).toContain("BIR Form 1902 / 2316");
    expect(labels).toContain("5-Panel Drug Test Certificate");
    expect(labels).toContain("Fit-to-Work Medical Certificate");
    expect(labels).toContain("Transcript of Records (TOR)");
    expect(labels).toContain("Certificate of Employment (COE)");
  });

  it("provides standard employment types and work arrangements", () => {
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("Full-Time");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("Contractual");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("Project-Based");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("Part-Time");

    expect(WORK_ARRANGEMENT_OPTIONS).toContain("On-site");
    expect(WORK_ARRANGEMENT_OPTIONS).toContain("Remote");
    expect(WORK_ARRANGEMENT_OPTIONS).toContain("Hybrid");
  });

  it("provides relationship and educational degree presets", () => {
    expect(RELATIONSHIP_PRESETS).toContain("Spouse");
    expect(RELATIONSHIP_PRESETS).toContain("Parent");
    expect(RELATIONSHIP_PRESETS).toContain("Sibling");
    expect(RELATIONSHIP_PRESETS).toContain("Former Supervisor");

    expect(EDUCATION_DEGREE_PRESETS).toContain("Bachelor's Degree");
    expect(EDUCATION_DEGREE_PRESETS).toContain("High School Diploma");
    expect(EDUCATION_DEGREE_PRESETS).toContain("Vocational / TESDA NC II");
  });

  it("formats string arrays to ComboBox Option objects", () => {
    const formatted = formatPresetOption("Full-Time");
    expect(formatted).toEqual({ value: "Full-Time", label: "Full-Time" });
  });
});
