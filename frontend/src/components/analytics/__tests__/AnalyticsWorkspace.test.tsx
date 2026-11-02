// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

import { formatRecruiterName } from "../../../lib/recruiter-label";

afterEach(cleanup);

describe("formatRecruiterName", () => {
  it("shows a plain name as stored", () => {
    expect(formatRecruiterName("Alice Recruiter")).toEqual({ label: "Alice Recruiter" });
    expect(formatRecruiterName("  Alice Recruiter  ")).toEqual({ label: "Alice Recruiter" });
    expect(formatRecruiterName("not an @ address").label).toBe("not an @ address");
  });

  it("splits an email into the name before the @ and the full email, so distinct accounts stay distinct", () => {
    expect(formatRecruiterName("ta-201-1790159306112@megs.com")).toEqual({
      label: "ta-201-1790159306112",
      email: "ta-201-1790159306112@megs.com",
      full: "ta-201-1790159306112@megs.com",
    });
    const emails = ["ta-201-1790119570618@megs.com", "ta-201-1790116860612@megs.com"];
    expect(new Set(emails.map((e) => formatRecruiterName(e).label)).size).toBe(2);
    expect(new Set(emails.map((e) => formatRecruiterName(e).email)).size).toBe(2);
  });

  it("labels the missing owner plainly", () => {
    expect(formatRecruiterName("No recruiter assigned").label).toBe("No owner");
    expect(formatRecruiterName(undefined).label).toBe("Unknown");
  });
});
