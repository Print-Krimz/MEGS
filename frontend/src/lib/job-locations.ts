import { PHILIPPINE_PROVINCES } from "./geo-data";
import type { ComboBoxOption } from "../components/ui/ComboBox";

/**
 * The MEGS main office. This is where applicants visit the agency, not where a job
 * is worked: every job card shows its own worksite.
 */
export const MEGS_MAIN_OFFICE = {
  label: "Valenzuela City, Metro Manila (NCR)",
  city: "Valenzuela",
};

/** Filter value that matches every NCR worksite. The server resolves it. */
export const NCR_FILTER_VALUE = "Metro Manila (NCR)";

const NCR = PHILIPPINE_PROVINCES.find((province) => province.name === NCR_FILTER_VALUE);

/** Filter values the server matches by whole name; a province's list name can be longer than its filter value. */
const PROVINCE_FILTER_VALUES: Record<string, string> = {
  "Davao del Sur": "Davao",
};

const NCR_GROUP = "Metro Manila (NCR)";
const PROVINCE_GROUP = "Provinces";

/**
 * Worksite filter options: all of NCR, each NCR city, then provinces. Searchable,
 * because the list is longer than a native dropdown handles well.
 */
export const JOB_LOCATION_OPTIONS: ComboBoxOption[] = [
  { value: NCR_FILTER_VALUE, label: "All Metro Manila (NCR)", group: NCR_GROUP },
  ...(NCR?.cities ?? []).map((city) => ({ value: city, label: city, group: NCR_GROUP })),
  ...PHILIPPINE_PROVINCES.filter((province) => province.name !== NCR_FILTER_VALUE).map((province) => {
    const value = PROVINCE_FILTER_VALUES[province.name] ?? province.name;
    return { value, label: value, group: PROVINCE_GROUP };
  }),
];

/** Readable label for the active filter, e.g. in the results summary. */
export const jobLocationLabel = (value: string): string =>
  JOB_LOCATION_OPTIONS.find((option) => option.value === value)?.label ?? value;
