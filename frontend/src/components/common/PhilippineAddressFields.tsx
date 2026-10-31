import React from "react";
import { ComboBox, type ComboBoxOption } from "../ui/ComboBox";
import { PROVINCE_OPTIONS, getCityOptions, getCityPostalCodes, isKnownProvince, loadBarangays } from "../../lib/ph-address";
import { findNcrBarangay, getNcrLocality, isNcrProvince, matchNcrBarangay, ncrCityOptions } from "../../lib/ncr-address";
import { getNcrBarangayPostal, getNcrPostalZones } from "../../lib/ncr-postal-reference";
import { FIELD_LIMITS } from "../../lib/field-limits";

export interface PhilippineAddressValue {
  province: string;
  city: string;
  barangay: string;
  postalCode: string;
}

export interface PhilippineAddressFieldsProps extends PhilippineAddressValue {
  onChange: (patch: Partial<PhilippineAddressValue>) => void;
  prefix?: string;
  disabled?: boolean;
}

export const PhilippineAddressFields: React.FC<PhilippineAddressFieldsProps> = ({
  province,
  city,
  barangay,
  postalCode,
  onChange,
  prefix = "",
  disabled,
}) => {
  const inNcr = isNcrProvince(province);
  const locality = inNcr ? getNcrLocality(city) : undefined;
  const provinceKnown = isKnownProvince(province);
  const baseCityOptions = inNcr ? ncrCityOptions : getCityOptions(province);
  // Keep a previously saved city visible (but not re-selectable) when it is not in the province's list.
  const cityOptions: Array<string | ComboBoxOption> = React.useMemo(() => {
    const list: Array<string | ComboBoxOption> = [...baseCityOptions];
    if (provinceKnown && city && !baseCityOptions.some((option) => option.toLowerCase() === city.toLowerCase())) {
      list.unshift({ value: city, label: `${city} — previously saved`, disabled: true });
    }
    return list;
  }, [baseCityOptions, provinceKnown, city]);

  // Barangays outside NCR come from PSGC and load lazily per region.
  const [psgcBarangays, setPsgcBarangays] = React.useState<string[]>([]);
  const [barangaysLoading, setBarangaysLoading] = React.useState(false);
  React.useEffect(() => {
    if (inNcr || !province || !city) {
      setPsgcBarangays([]);
      setBarangaysLoading(false);
      return;
    }
    let cancelled = false;
    setBarangaysLoading(true);
    loadBarangays(province, city)
      .then((list) => { if (!cancelled) setPsgcBarangays(list); })
      .catch(() => { if (!cancelled) setPsgcBarangays([]); })
      .finally(() => { if (!cancelled) setBarangaysLoading(false); });
    return () => { cancelled = true; };
  }, [inNcr, province, city]);

  const cityPostalCodes = React.useMemo(() => (inNcr ? [] : getCityPostalCodes(province, city)), [inNcr, province, city]);
  const ncrBarangayPostal = inNcr ? getNcrBarangayPostal(city, barangay) : null;
  const isDefaultNcrPostal = Boolean(ncrBarangayPostal?.fallback && postalCode && postalCode === ncrBarangayPostal.codes[0]);
  const postalZones = React.useMemo(() => (inNcr ? getNcrPostalZones(city) : []), [inNcr, city]);

  const barangayOptions: ComboBoxOption[] = React.useMemo(() => {
    const list: ComboBoxOption[] = locality?.barangays.map((item) => {
      const isNumbered = /^Barangay\s+\d+$/i.test(item.name);
      return {
        value: item.name,
        label: item.name,
        subtitle: isNumbered ? item.name.replace(/^Barangay\s+/i, "Brgy. ") : undefined,
      };
    }) ?? [];
    if (barangay && locality && !list.some((option) => matchNcrBarangay(option.value, barangay))) {
      list.unshift({ value: barangay, label: `${barangay} — previously saved`, disabled: true });
    }
    return list;
  }, [locality, barangay]);

  const postalOptions: ComboBoxOption[] = React.useMemo(() => {
    const seen = new Set<string>();
    const list: ComboBoxOption[] = [];

    // Zones whose code belongs to the selected barangay come first, then name matches.
    const barangayCodes = new Set(getNcrBarangayPostal(city, barangay)?.codes ?? []);
    const normBarangay = barangay?.toLowerCase().trim() || "";
    const sortedZones = [...postalZones].sort((a, b) => {
      const aMapped = barangayCodes.has(a.postalCode);
      const bMapped = barangayCodes.has(b.postalCode);
      if (aMapped !== bMapped) return aMapped ? -1 : 1;
      if (!normBarangay) return 0;
      const aMatches = a.locality.toLowerCase().includes(normBarangay) || normBarangay.includes(a.locality.toLowerCase());
      const bMatches = b.locality.toLowerCase().includes(normBarangay) || normBarangay.includes(b.locality.toLowerCase());
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });

    for (const zone of sortedZones) {
      const key = `${zone.postalCode}__${zone.locality}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          value: zone.postalCode,
          label: `${zone.postalCode} — ${zone.locality}`,
        });
      }
    }

    if (postalCode && locality && !list.some((option) => option.value === postalCode)) {
      list.unshift({ value: postalCode, label: `${postalCode} — previously saved`, disabled: true });
    }

    return list;
  }, [postalZones, postalCode, locality, barangay, city]);

  const handleBarangayChange = (selectedBarangay: string) => {
    const canonical = inNcr ? findNcrBarangay(city, selectedBarangay)?.name ?? selectedBarangay : selectedBarangay;
    const patch: Partial<PhilippineAddressValue> = { barangay: canonical };
    if (inNcr) {
      // Autofill the barangay's postal code (or the area default when only street-level data exists);
      // always replace the previous barangay's code so it is never stale.
      patch.postalCode = getNcrBarangayPostal(city, canonical)?.codes[0] ?? "";
    }
    onChange(patch);
  };

  const handlePostalCodeChange = (selectedPostal: string, opt: ComboBoxOption | null) => {
    const patch: Partial<PhilippineAddressValue> = { postalCode: selectedPostal };
    if (inNcr && !barangay && opt?.label && locality) {
      const parts = opt.label.split("—").map((s) => s.trim());
      const zoneLocality = (parts[1] || "").toLowerCase();
      const match = locality.barangays.find((b) => b.name.toLowerCase() === zoneLocality);
      if (match) {
        patch.barangay = match.name;
      }
    }
    onChange(patch);
  };

  const fieldLabel = (label: string) => prefix ? `${prefix} ${label}` : label;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ComboBox
          label={fieldLabel("Province or region")}
          placeholder="Select or enter province..."
          value={province}
          maxLength={FIELD_LIMITS.name}
          onChange={(value) => {
            // A different province invalidates every dependent field, including the postal code.
            if (value !== province) onChange({ province: value, city: "", barangay: "", postalCode: "" });
          }}
          options={PROVINCE_OPTIONS}
          allowCustom
          disabled={disabled}
        />
        <ComboBox
          label={fieldLabel("City or municipality")}
          placeholder={province ? "Select or enter city..." : "Select province first"}
          value={city}
          maxLength={FIELD_LIMITS.name}
          onChange={(value) => {
            if (value === city) return;
            onChange({ city: value, barangay: "", postalCode: "" });
          }}
          options={cityOptions}
          allowCustom={!inNcr && !provinceKnown}
          required={Boolean(province)}
          disabled={disabled || !province}
          emptyText={
            inNcr
              ? "Choose an NCR locality"
              : provinceKnown
              ? "No matching city or municipality in this province"
              : "No matching city; enter it manually"
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {inNcr ? (
          <ComboBox
            label={fieldLabel("Barangay")}
            placeholder={locality ? "Search NCR barangays..." : "Select an NCR city first"}
            value={barangay}
            onChange={(value) => handleBarangayChange(value)}
            options={barangayOptions}
            windowed
            required={Boolean(province || city || barangay || postalCode)}
            disabled={disabled || !locality}
            emptyText="No barangay in this city matches your search"
          />
        ) : (
          <ComboBox
            label={fieldLabel("Barangay")}
            placeholder={!city ? "Select a city first" : barangaysLoading ? "Loading barangays..." : "Select or enter barangay..."}
            value={barangay}
            maxLength={FIELD_LIMITS.barangay}
            onChange={(value) => {
              // The postal code is filled once a barangay is chosen (city-level code when it is the only one).
              const codes = value ? getCityPostalCodes(province, city) : [];
              onChange({ barangay: value, postalCode: codes.length === 1 ? codes[0] : "" });
            }}
            options={psgcBarangays}
            allowCustom
            loading={barangaysLoading}
            required={Boolean(province || city || barangay || postalCode)}
            disabled={disabled || !city}
            emptyText="No listed barangay matches; enter it manually"
          />
        )}

        {inNcr ? (
          <ComboBox
            label={fieldLabel("Postal code")}
            placeholder={locality ? "Search postal locality or code..." : "Select an NCR city first"}
            value={postalCode}
            onChange={(value, option) => handlePostalCodeChange(value, option)}
            options={postalOptions}
            required={Boolean(province || city || barangay || postalCode)}
            disabled={disabled || !locality}
            emptyText="No postal locality listed for this NCR city"
            helperText={
              isDefaultNcrPostal
                ? "Default for this area. Postal codes here follow the street, so check it matches your address."
                : undefined
            }
          />
        ) : (
          <ComboBox
            label={fieldLabel("Postal code")}
            placeholder={cityPostalCodes.length ? "Select postal code..." : "4 digits"}
            value={postalCode}
            maxLength={4}
            digitsOnly
            onChange={(value) => onChange({ postalCode: value.replace(/\D/g, "").slice(0, 4) })}
            options={cityPostalCodes}
            allowCustom
            error={postalCode && !/^\d{4}$/.test(postalCode) ? "Postal code must be exactly 4 digits." : undefined}
            helperText={
              city && cityPostalCodes.length === 0
                ? "No postal code on file for this city; enter it manually."
                : cityPostalCodes.length > 1
                ? "This city has several postal codes; choose the right one or type it."
                : undefined
            }
            required={Boolean(province || city || barangay || postalCode)}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
};

