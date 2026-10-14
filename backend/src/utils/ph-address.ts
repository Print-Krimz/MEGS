/**
 * Server-side mirror of frontend/src/lib/ph-address.ts (PSGC geography + postal codes).
 * Metro Manila (NCR) keeps its dedicated dataset (ncr-address.ts / ncr-postal-reference.ts).
 */
import geo from "../data/ph-geo.json";
import { isNcrProvince } from "./ncr-address.js";

interface GeoCity {
  code: string;
  name: string;
  provinceCode: string | null;
  regionCode: string;
  zip?: string[];
}
interface GeoProvince {
  code: string;
  name: string;
}

const PROVINCES = geo.provinces as GeoProvince[];
const CITIES = geo.cities as GeoCity[];

export const normalizeLocationKey = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\bcity of\b|\bmunicipality of\b|\bprovince of\b|\bprovince\b|\bcity\b/g, " ")
    .replace(/\bsto\.?\b/g, "santo")
    .replace(/\bsta\.?\b/g, "santa")
    .replace(/\bdel\b|\bde\b/g, "d")
    .replace(/[^a-z0-9]+/g, "");

export const displayCityName = (name: string): string => {
  const match = /^City of (.+)$/.exec(name);
  return match ? `${match[1]} City` : name;
};

const citiesByProvince = new Map<string, GeoCity[]>();
for (const city of CITIES) {
  if (!city.provinceCode) continue;
  const list = citiesByProvince.get(city.provinceCode) ?? [];
  list.push(city);
  citiesByProvince.set(city.provinceCode, list);
}

const provinceByKey = new Map<string, GeoCity[]>([
  ...PROVINCES.map((p): [string, GeoCity[]] => [normalizeLocationKey(p.name), citiesByProvince.get(p.code) ?? []]),
  // Independent cities without a province (Isabela City, Cotabato City) act as their own province.
  ...CITIES.filter((c) => !c.provinceCode).map((c): [string, GeoCity[]] => [normalizeLocationKey(displayCityName(c.name)), [c]]),
]);

/** True for NCR or any PSGC province we hold city data for. */
export const isKnownProvince = (province: unknown): boolean =>
  isNcrProvince(province) || (typeof province === "string" && provinceByKey.has(normalizeLocationKey(province)));

/** Resolves a city/municipality inside a province outside NCR. */
export const findCity = (province: unknown, city: unknown): GeoCity | undefined => {
  if (typeof province !== "string" || typeof city !== "string" || !city.trim()) return undefined;
  const cities = provinceByKey.get(normalizeLocationKey(province));
  if (!cities) return undefined;
  const lowered = city.trim().toLowerCase();
  const exact = cities.find((c) => displayCityName(c.name).toLowerCase() === lowered || c.name.toLowerCase() === lowered);
  if (exact) return exact;
  const key = normalizeLocationKey(city);
  return key ? cities.find((c) => normalizeLocationKey(c.name) === key) : undefined;
};

/** A city must belong to its province when the province is one we know; unknown provinces are not checked. */
export const isCityInProvince = (province: unknown, city: unknown): boolean => {
  if (isNcrProvince(province)) return true; // NCR cities are validated against the NCR dataset
  if (typeof province !== "string" || !provinceByKey.has(normalizeLocationKey(province))) return true;
  return Boolean(findCity(province, city));
};

/** Postal codes on file for a city outside NCR (informational; never used to reject a valid 4-digit code). */
export const getCityPostalCodes = (province: unknown, city: unknown): string[] =>
  findCity(province, city)?.zip ?? [];
