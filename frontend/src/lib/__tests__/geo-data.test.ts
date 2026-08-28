import { describe, it, expect } from "vitest";
import {
  PHILIPPINE_PROVINCES,
  getCitiesForProvince,
  searchLocations,
} from "../geo-data";

describe("Philippine Geographic Dataset (geo-data)", () => {
  it("exports a non-empty list of Philippine provinces and regions", () => {
    expect(PHILIPPINE_PROVINCES.length).toBeGreaterThan(15);
    const names = PHILIPPINE_PROVINCES.map((p) => p.name);
    expect(names).toContain("Metro Manila (NCR)");
    expect(names).toContain("Laguna");
    expect(names).toContain("Cavite");
    expect(names).toContain("Batangas");
    expect(names).toContain("Cebu");
  });

  it("returns appropriate cities for a given province", () => {
    const lagunaCities = getCitiesForProvince("Laguna");
    expect(lagunaCities).toContain("Calamba");
    expect(lagunaCities).toContain("Santa Rosa");
    expect(lagunaCities).toContain("Biñan");
    expect(lagunaCities).toContain("Cabuyao");

    const ncrCities = getCitiesForProvince("Metro Manila (NCR)");
    expect(ncrCities).toContain("Quezon City");
    expect(ncrCities).toContain("Makati");
    expect(ncrCities).toContain("Taguig");
    expect(ncrCities).toContain("Pasig");
    expect(ncrCities).toContain("Valenzuela");
  });

  it("handles unknown or empty province gracefully", () => {
    const unknown = getCitiesForProvince("NonExistentProvince");
    expect(unknown).toEqual([]);

    const empty = getCitiesForProvince("");
    expect(empty).toEqual([]);
  });

  it("searches locations matching a query string across provinces and cities", () => {
    const results = searchLocations("Calamba");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]).toEqual({
      province: "Laguna",
      city: "Calamba",
      formatted: "Calamba, Laguna",
    });
  });
});
