import { describe, it, expect } from "vitest";
import {
  computeAutoFillDiff,
  filterDuplicateExperiences,
  filterDuplicateEducations,
  filterDuplicateSkills,
  filterDuplicateTrainings,
  filterDuplicateReferences,
} from "../resume-autofill";

describe("Resume Auto-Fill Frontend Utilities", () => {
  it("computeAutoFillDiff identifies empty fields to fill, conflicts, and unchanged fields", () => {
    const currentForm = {
      firstName: "Maria",
      lastName: "",
      middleName: "",
      mobileNumber: "",
      province: "",
      city: "",
      address: "Old Address",
      professionalSummary: "I am a dev",
    };

    const extracted = {
      firstName: "Maria",
      lastName: "Santos",
      middleName: "Clara",
      mobileNumber: "09181234567",
      province: "Laguna",
      city: "Calamba",
      address: "123 New Street",
      professionalSummary: "I am a senior dev",
    };

    const diff = computeAutoFillDiff(currentForm, extracted);

    // Empty fields that will be filled automatically
    expect(diff.autoFilledFields).toEqual({
      lastName: "Santos",
      middleName: "Clara",
      mobileNumber: "09181234567",
      province: "Laguna",
      city: "Calamba",
    });

    // Fields with existing user data that differ from extracted data
    expect(diff.conflictingFields).toHaveProperty("address");
    expect(diff.conflictingFields.address).toEqual({
      current: "Old Address",
      suggested: "123 New Street",
    });
    expect(diff.conflictingFields).toHaveProperty("professionalSummary");

    // Identical fields
    expect(diff.identicalFields).toContain("firstName");
  });

  it("filterDuplicateExperiences filters out existing experiences by company and role", () => {
    const existing = [
      { id: 1, company: "ABC Logistics", roleTitle: "Warehouse Supervisor" } as any,
    ];

    const extracted = [
      { company: "ABC Logistics", roleTitle: "Warehouse Supervisor" }, // duplicate
      { company: "XYZ Express", roleTitle: "Fleet Manager" }, // new
    ];

    const result = filterDuplicateExperiences(existing, extracted);

    expect(result.newItems).toHaveLength(1);
    expect(result.newItems[0].company).toBe("XYZ Express");
    expect(result.duplicateCount).toBe(1);
  });

  it("filterDuplicateEducations filters out existing education by school and degree", () => {
    const existing = [
      { id: 1, school: "Laguna State Polytechnic University", degree: "BS IT" } as any,
    ];

    const extracted = [
      { school: "Laguna State Polytechnic University", degree: "BS IT" }, // duplicate
      { school: "University of the Philippines", degree: "MS Computer Science" }, // new
    ];

    const result = filterDuplicateEducations(existing, extracted);

    expect(result.newItems).toHaveLength(1);
    expect(result.newItems[0].school).toBe("University of the Philippines");
    expect(result.duplicateCount).toBe(1);
  });

  it("filterDuplicateSkills normalizes and removes already listed skills", () => {
    const existing = ["JavaScript", "React", "Node.js"];
    const extracted = ["react", "TypeScript", "Node.JS", "Tailwind CSS"];

    const result = filterDuplicateSkills(existing, extracted);

    expect(result.newItems).toEqual(["TypeScript", "Tailwind CSS"]);
    expect(result.duplicateCount).toBe(2);
  });

  it("filterDuplicateTrainings removes certifications with matching titles", () => {
    const existing = [
      { id: 1, title: "TESDA NC II Forklift Driving" } as any,
    ];

    const extracted = [
      { title: "TESDA NC II Forklift Driving", provider: "TESDA" }, // duplicate
      { title: "First Aid & CPR Certification", provider: "Red Cross" }, // new
    ];

    const result = filterDuplicateTrainings(existing, extracted);

    expect(result.newItems).toHaveLength(1);
    expect(result.newItems[0].title).toBe("First Aid & CPR Certification");
    expect(result.duplicateCount).toBe(1);
  });

  it("computeAutoFillDiff handles dateOfBirth, birthPlace, gender, nationality, religion, height, weight, and civilStatus", () => {
    const currentForm = {
      firstName: "Pedro",
      lastName: "Penduko",
      dateOfBirth: "",
      birthPlace: "",
      gender: "",
      nationality: "",
      civilStatus: "Single", // already entered matching
      religion: "",
      height: "",
      weight: "75", // already entered conflicting
    };

    const extracted = {
      firstName: "Pedro",
      lastName: "Penduko",
      dateOfBirth: "1994-07-22",
      birthPlace: "Iloilo City",
      gender: "Male",
      nationality: "Filipino",
      civilStatus: "Single",
      religion: "Roman Catholic",
      height: 178,
      weight: 70,
    };

    const diff = computeAutoFillDiff(currentForm, extracted as any);

    expect(diff.autoFilledFields).toEqual({
      dateOfBirth: "1994-07-22",
      birthPlace: "Iloilo City",
      gender: "Male",
      nationality: "Filipino",
      religion: "Roman Catholic",
      height: "178",
    });

    expect(diff.conflictingFields).toHaveProperty("weight");
    expect(diff.conflictingFields.weight).toEqual({
      current: "75",
      suggested: "70",
    });

    expect(diff.identicalFields).toContain("civilStatus");
    expect(diff.identicalFields).toContain("firstName");
  });

  it("filterDuplicateReferences removes existing character references by name and phone/email", () => {
    const existing = [
      {
        id: 1,
        applicantProfileId: 10,
        name: "Engr. Roberto Gomez",
        relationship: "Operations Manager",
        phone: "09181234567",
        email: "roberto@example.com",
        createdAt: "",
        updatedAt: "",
      },
    ];

    const extracted = [
      {
        name: "Engr. Roberto Gomez", // duplicate
        phone: "09181234567",
      },
      {
        name: "Atty. Clara Santos", // new
        relationship: "Legal Counsel",
        company: "Santos & Partners",
        phone: "09179998888",
        email: "clara@santoslaw.ph",
      },
    ];

    const result = filterDuplicateReferences(existing, extracted);

    expect(result.newItems).toHaveLength(1);
    expect(result.newItems[0].name).toBe("Atty. Clara Santos");
    expect(result.duplicateCount).toBe(1);
  });
});
