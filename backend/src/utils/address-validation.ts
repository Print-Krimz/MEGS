import { getNcrLocality, isNcrBarangay, isNcrProvince } from "./ncr-address.js";
import { getNcrPostalZones } from "./ncr-postal-reference.js";
import { isCityInProvince } from "./ph-address.js";

export interface StructuredAddress {
  province?: string | null;
  city?: string | null;
  barangay?: string | null;
  postalCode?: string | null;
  address?: string | null;
  street?: string | null;
}

const ADDRESS_KEYS: (keyof StructuredAddress)[] = ["province", "city", "barangay", "postalCode", "address", "street"];
const hasText = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());

export const validateStructuredAddress = (
  next: StructuredAddress,
  previous?: StructuredAddress | null,
): void => {
  const normalized = (value: unknown) => typeof value === "string" ? value.trim() || null : value ?? null;
  const changed = !previous || ADDRESS_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(next, key) && normalized(next[key]) !== normalized(previous[key])
  );
  if (!changed) return;

  const hasAddress = [next.address, next.street, next.province, next.city, next.barangay, next.postalCode].some(hasText);
  if (!hasAddress) return; // Allow completely empty optional addresses.

  if (!hasText(next.province) || !hasText(next.city)) {
    throw new Error("Choose or enter a province and city for this address.");
  }
  if (!hasText(next.barangay) || next.barangay.trim().length > 100) {
    throw new Error("Enter a barangay (up to 100 characters).");
  }
  if (!hasText(next.postalCode) || !/^\d{4}$/.test(next.postalCode.trim())) {
    throw new Error("Postal code must be exactly 4 digits.");
  }

  if (isNcrProvince(next.province)) {
    if (!getNcrLocality(next.city)) {
      throw new Error("Choose one of the 17 NCR cities or municipalities.");
    }
    if (!isNcrBarangay(next.city, next.barangay)) {
      throw new Error("Choose a barangay listed under the selected NCR city.");
    }
    const zones = getNcrPostalZones(next.city);
    if (!zones.some((zone) => zone.postalCode === next.postalCode!.trim())) {
      throw new Error("Choose a postal code listed for the selected NCR city.");
    }
  } else if (!isCityInProvince(next.province, next.city)) {
    // Outside NCR the city must belong to the chosen province. Postal codes are format-checked only,
    // because several valid codes can exist per city and the bundled dataset is not exhaustive.
    throw new Error("Choose a city or municipality that belongs to the selected province.");
  }
};

