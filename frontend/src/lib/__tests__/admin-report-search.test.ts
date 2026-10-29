import { describe, it, expect } from "vitest";
import { filtersToSearch, parseAdminReportSearch, readReportReturnState, reportReturnState, searchToFilters } from "../admin-report-search";

describe("admin report search", () => {
  it("round-trips filters, dates and tab through search and return state", () => {
    const search = parseAdminReportSearch({ ...filtersToSearch({ range: "custom", startDate: "2026-09-01", endDate: "2026-09-30", clientId: 3 }), tab: "requests", health: "LATE" });
    expect(readReportReturnState(reportReturnState(search))).toEqual(search);
    expect(searchToFilters(search)).toEqual({ range: "custom", startDate: "2026-09-01", endDate: "2026-09-30", clientId: 3 });
  });

  it("falls back to the default report for invalid or foreign state", () => {
    expect(parseAdminReportSearch({ range: "x", tab: "y", clientId: "-1", startDate: "nope" })).toEqual({});
    expect(searchToFilters({})).toEqual({ range: "7d" });
    expect(readReportReturnState("https://evil.example")).toEqual({});
    expect(readReportReturnState({ adminReport: { redirect: "https://evil.example", tab: "waiting" } })).toEqual({ tab: "waiting" });
  });
});
