import { describe, it, expect } from "vitest";
import { parseAdminReportSearch, parseTAReportSearch } from "./admin-report-search";

describe("report search tabs", () => {
  it("keeps the Action items tab for a recruiter and drops the Recruiters tab and recruiterId", () => {
    expect(parseTAReportSearch({ tab: "actions", recruiterId: "ta-1" })).toEqual({ tab: "actions" });
    expect(parseTAReportSearch({ tab: "recruiters" })).toEqual({});
  });

  it("treats the Action items tab as no tab on the Admin page", () => {
    expect(parseAdminReportSearch({ tab: "actions", range: "30d" })).toEqual({ range: "30d" });
    expect(parseAdminReportSearch({ tab: "recruiters" })).toEqual({ tab: "recruiters" });
  });
});
