// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

import { formatRecruiterName } from "../../../lib/recruiter-label";

afterEach(cleanup);

describe("formatRecruiterName", () => {
  it("shows a real name or the full email as stored, never a shortened form", () => {
    expect(formatRecruiterName("Alice Recruiter")).toEqual({ label: "Alice Recruiter" });
    expect(formatRecruiterName("ta-201-1790159306112@megs.com")).toEqual({ label: "ta-201-1790159306112@megs.com" });
    const labels = ["ta-201-1790119570618@megs.com", "ta-201-1790116860612@megs.com"].map((e) => formatRecruiterName(e).label);
    expect(new Set(labels).size).toBe(2);
  });

  it("labels the missing owner plainly", () => {
    expect(formatRecruiterName("No recruiter assigned").label).toBe("No owner");
    expect(formatRecruiterName(undefined).label).toBe("Unknown");
  });
});
