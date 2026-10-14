import ncrReference from "./ncr-psgc-reference.json";

export interface NcrBarangay {
  psgc_code: string;
  name: string;
}

export interface NcrLocality {
  psgc_code: string;
  name: string;
  type: "city" | "municipality";
  barangays: NcrBarangay[];
}

export const NCR_LOCALITIES = ncrReference.localities as NcrLocality[];
export const isNcrProvince = (province?: string | null): boolean => {
  if (!province) return false;
  return ["metro manila (ncr)", "national capital region (ncr)", "metro manila", "ncr"]
    .includes(province.trim().toLocaleLowerCase("en"));
};

export const normalizeNcrCity = (city?: string | null): string | undefined => {
  if (!city?.trim()) return undefined;
  const input = city.trim().toLocaleLowerCase("en").replace(/^(city of )/, "").replace(/ city$/, "");
  return NCR_LOCALITIES.find((item) =>
    item.name.toLocaleLowerCase("en").replace(/^(city of )/, "").replace(/ city$/, "") === input
  )?.psgc_code;
};

export const getNcrLocality = (city?: string | null): NcrLocality | undefined => {
  const code = normalizeNcrCity(city);
  return code ? NCR_LOCALITIES.find((item) => item.psgc_code === code) : undefined;
};

export const ncrCityOptions = NCR_LOCALITIES.map((locality) => {
  if (locality.name === "Quezon City") return "Quezon City";
  if (locality.name === "Pasay City") return "Pasay";
  return locality.name.replace(/^City of /, "").replace(/ City$/, "");
});

export const normalizeBarangayKey = (name?: string | null): string => {
  if (!name) return "";
  let str = String(name).trim().toLowerCase();
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  str = str.replace(/\b(brgy|bgy)\.?\s*/gi, "barangay ");
  if (/^\d+$/.test(str)) {
    return "barangay " + parseInt(str, 10);
  }
  str = str.replace(/\bbarangay\s+0*(\d+)\b/gi, (_m, num) => "barangay " + parseInt(num, 10));
  str = str.replace(/[^a-z0-9]+/g, " ").trim();
  return str;
};

export const matchNcrBarangay = (a?: string | null, b?: string | null): boolean => {
  if (!a || !b) return false;
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const kA = normalizeBarangayKey(a);
  const kB = normalizeBarangayKey(b);
  if (kA && kA === kB) return true;
  const strip = (k: string) => k.replace(/^barangay\s+(?!\d+$)/, "");
  if (strip(kA) === strip(kB)) return true;
  return kA.startsWith(kB + " ") || kB.startsWith(kA + " ");
};

export const findNcrBarangay = (city?: string | null, barangay?: string | null): NcrBarangay | undefined => {
  if (!barangay?.trim()) return undefined;
  const locality = getNcrLocality(city);
  if (!locality) return undefined;

  const trimmed = barangay.trim().toLowerCase();
  const direct = locality.barangays.find((b) => b.name.toLowerCase() === trimmed);
  if (direct) return direct;

  const targetKey = normalizeBarangayKey(barangay);
  const targetStripped = targetKey.replace(/^barangay\s+(?!\d+$)/, "");

  const exactNormalized = locality.barangays.find((b) => {
    const k = normalizeBarangayKey(b.name);
    if (k === targetKey) return true;
    const stripped = k.replace(/^barangay\s+(?!\d+$)/, "");
    return stripped === targetStripped;
  });
  if (exactNormalized) return exactNormalized;

  // Fallback for subdivided barangays (e.g. Caloocan Barangay 176 -> Barangay 176-A)
  return locality.barangays.find((b) => {
    const k = normalizeBarangayKey(b.name);
    return k.startsWith(targetKey + " ");
  });
};

export const isNcrBarangay = (city?: string | null, barangay?: string | null): boolean => {
  return Boolean(findNcrBarangay(city, barangay));
};
