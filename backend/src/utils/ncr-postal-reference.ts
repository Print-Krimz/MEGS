import postalReference from "../data/ncr-postal-reference.json";
import { normalizeNcrCity } from "./ncr-address.js";

export interface NcrPostalZone {
  locality: string;
  postalCode: string;
}

export const getNcrPostalZones = (city: unknown): NcrPostalZone[] => {
  const code = normalizeNcrCity(city);
  if (!code) return [];
  const locality = postalReference.localities.find((item) => item.psgc_code === code);
  return locality?.postalZones ?? [];
};

