import postalReference from "./ncr-postal-reference.json";
import barangayPostal from "./ncr-barangay-postal.json";
import { findNcrBarangay, normalizeNcrCity } from "./ncr-address";

export interface NcrPostalZone {
  locality: string;
  postalCode: string;
}

export const getNcrPostalZones = (city?: string | null): NcrPostalZone[] => {
  const code = normalizeNcrCity(city);
  if (!code) return [];
  const locality = postalReference.localities.find((item) => item.psgc_code === code);
  return locality?.postalZones ?? [];
};

export interface NcrBarangayPostal {
  /** codes[0] is autofilled; any others are the other codes that can apply to this barangay. */
  codes: string[];
  /**
   * No verified barangay-level mapping (PHLPost assigns these by street/area, e.g. Caloocan, Pasay, Tondo),
   * so codes[0] is a default the user should confirm.
   */
  fallback?: boolean;
}

/** Postal codes for an NCR barangay (built by backend/scripts/build-ncr-barangay-postal.mjs). */
export const getNcrBarangayPostal = (city?: string | null, barangay?: string | null): NcrBarangayPostal | null => {
  if (!barangay?.trim()) return null;
  const match = findNcrBarangay(city, barangay);
  return match ? ((barangayPostal as Record<string, NcrBarangayPostal>)[match.psgc_code] ?? null) : null;
};

