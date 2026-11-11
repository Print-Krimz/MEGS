import React from "react";
import { z } from "zod";
import { Input, PhoneInput } from "../../ui";
import { ComboBox } from "../../ui/ComboBox";
import { PhilippineAddressFields } from "../../common/PhilippineAddressFields";
import { PHILIPPINE_INDUSTRY_SECTORS } from "../../../lib/industry-data";
import { FIELD_LIMITS } from "../../../lib/field-limits";
import {
  validatePersonName,
  validateStandardText,
  validatePhilippineContactPhone,
} from "../../../lib/statutory-validation";
import type { ClientReadFieldKey, CreateClientDto } from "../../../lib/types/client.types";

export interface ClientDraft {
  name: string;
  tradeName: string;
  industry: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  street: string;
  province: string;
  city: string;
  barangay: string;
  postalCode: string;
}

export const emptyClientDraft: ClientDraft = {
  name: "",
  tradeName: "",
  industry: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactPhone: "",
  street: "",
  province: "",
  city: "",
  barangay: "",
  postalCode: "",
};

// First and last name are joined with a space; capping each part keeps the joined name within the backend limit.
const CONTACT_NAME_PART_MAX = Math.floor((FIELD_LIMITS.name - 1) / 2);
const CONTACT_EMAIL_MESSAGE = "Enter a valid email address.";
const contactEmailSchema = z.string().trim().email(CONTACT_EMAIL_MESSAGE).max(FIELD_LIMITS.email, CONTACT_EMAIL_MESSAGE);
const contactNameLengthError = (first: string, last: string) =>
  [first.trim(), last.trim()].filter(Boolean).join(" ").length > FIELD_LIMITS.name
    ? `Contact name cannot exceed ${FIELD_LIMITS.name} characters.`
    : undefined;

/** Backend fields that have an inline input on this form. Any other field's message goes in the toast. */
export const CLIENT_INLINE_FIELDS = ["name", "tradeName", "industry", "contactName", "contactEmail", "contactPhone", "street"];

/** The error keys a change to these draft fields makes stale. */
export const errorKeysFor = (patch: Partial<ClientDraft>): string[] =>
  Object.keys(patch).flatMap((key) => {
    if (key === "contactFirstName" || key === "contactLastName") return ["contactName"];
    if (["province", "city", "barangay", "postalCode"].includes(key)) return ["address", "postalCode"];
    return [key];
  });

export const withoutErrors = (errors: Record<string, string>, keys: string[]) => {
  if (!keys.some((key) => key in errors)) return errors;
  const next = { ...errors };
  for (const key of keys) delete next[key];
  return next;
};

/** The first problem for each field, keyed by the field that shows it. Empty when the draft can be saved. */
export const validateClientDraft = (draft: ClientDraft): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) {
    errors.name = "Enter the company name.";
    return errors;
  }
  const nameErr = validateStandardText(draft.name, "Legal company name", { maxLength: 200 });
  if (nameErr) errors.name = nameErr;
  if (draft.tradeName.trim()) {
    const tradeErr = validateStandardText(draft.tradeName, "Brand name", { maxLength: 200 });
    if (tradeErr) errors.tradeName = tradeErr;
  }
  const personErr =
    (draft.contactFirstName.trim() && validatePersonName(draft.contactFirstName, "Contact first name")) ||
    (draft.contactLastName.trim() && validatePersonName(draft.contactLastName, "Contact last name")) ||
    contactNameLengthError(draft.contactFirstName, draft.contactLastName);
  if (personErr) errors.contactName = personErr;
  if (draft.contactPhone.trim()) {
    const phoneErr = validatePhilippineContactPhone(draft.contactPhone, { label: "Contact phone" });
    if (phoneErr) errors.contactPhone = phoneErr;
  }
  if (draft.contactEmail.trim() && !contactEmailSchema.safeParse(draft.contactEmail).success) {
    errors.contactEmail = CONTACT_EMAIL_MESSAGE;
  }
  const { street, province, city, barangay, postalCode } = draft;
  const hasAddress = [street, province, city, barangay, postalCode].some((value) => value.trim());
  if (hasAddress && (!province.trim() || !city.trim() || !barangay.trim() || !postalCode.trim())) {
    errors.address = "Enter the province, city, barangay, and postal code.";
  } else if (postalCode.trim() && !/^\d{4}$/.test(postalCode.trim())) {
    errors.postalCode = "Postal code must be exactly 4 digits.";
  }
  return errors;
};

export const toCreateClientDto = (draft: ClientDraft): CreateClientDto => {
  const combinedName = [draft.contactFirstName.trim(), draft.contactLastName.trim()].filter(Boolean).join(" ");
  return {
    name: draft.name.trim(),
    tradeName: draft.tradeName.trim() || undefined,
    industry: draft.industry.trim() || undefined,
    contactName: combinedName || undefined,
    contactEmail: draft.contactEmail.trim() || undefined,
    contactPhone: draft.contactPhone.trim() || undefined,
    street: draft.street.trim() || undefined,
    barangay: draft.barangay.trim() || undefined,
    province: draft.province.trim() || undefined,
    city: draft.city.trim() || undefined,
    postalCode: draft.postalCode.trim() || undefined,
  };
};

export type ClientFieldNotes = Partial<Record<ClientReadFieldKey, string>>;

const Note: React.FC<{ text?: string }> = ({ text }) =>
  text ? <p className="-mt-2 text-xs text-slate-600">{text}</p> : null;

interface ClientFieldsProps {
  value: ClientDraft;
  onChange: (patch: Partial<ClientDraft>) => void;
  errors: Record<string, string>;
  /** Keeps input ids unique when several forms share a screen. */
  idPrefix: string;
  disabled?: boolean;
  /** Short notes shown under a field, such as "Check this — read from the file." */
  notes?: ClientFieldNotes;
  nameRef?: React.Ref<HTMLInputElement>;
}

export const ClientFields: React.FC<ClientFieldsProps> = ({ value, onChange, errors, idPrefix, disabled, notes = {}, nameRef }) => {
  const addressNote = notes.street ?? notes.province ?? notes.city ?? notes.barangay ?? notes.postalCode;
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
      <section aria-labelledby={`${idPrefix}-company`} className="space-y-4">
        <h3 id={`${idPrefix}-company`} className="text-sm font-semibold text-slate-900">Company</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id={`${idPrefix}-name`}
            ref={nameRef}
            label="Legal company name"
            placeholder="e.g. Acme Industrial Services Corp."
            value={value.name}
            error={errors.name}
            helperText={notes.name}
            disabled={disabled}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
          <Input
            id={`${idPrefix}-trade-name`}
            label="Brand name (optional)"
            placeholder="e.g. Acme Logistics"
            value={value.tradeName}
            error={errors.tradeName}
            helperText={notes.tradeName}
            disabled={disabled}
            onChange={(e) => onChange({ tradeName: e.target.value })}
          />
        </div>

        <ComboBox
          id={`${idPrefix}-industry`}
          label="Industry"
          placeholder="Select or enter industry sector..."
          value={value.industry}
          error={errors.industry}
          disabled={disabled}
          onChange={(val) => onChange({ industry: val })}
          options={PHILIPPINE_INDUSTRY_SECTORS.map((s) => ({ value: s, label: s }))}
          allowCustom
        />
        <Note text={notes.industry} />

        <h3 className="pt-1 text-sm font-semibold text-slate-900">Main contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id={`${idPrefix}-contact-first-name`}
            label="Contact first name"
            maxLength={CONTACT_NAME_PART_MAX}
            nameInput
            placeholder="e.g. Roberto"
            value={value.contactFirstName}
            error={errors.contactName}
            helperText={notes.contactFirstName}
            disabled={disabled}
            onChange={(e) => onChange({ contactFirstName: e.target.value })}
          />
          <Input
            id={`${idPrefix}-contact-last-name`}
            label="Contact last name"
            maxLength={CONTACT_NAME_PART_MAX}
            nameInput
            placeholder="e.g. Tan"
            error={contactNameLengthError(value.contactFirstName, value.contactLastName)}
            helperText={notes.contactLastName}
            value={value.contactLastName}
            disabled={disabled}
            onChange={(e) => onChange({ contactLastName: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PhoneInput
            id={`${idPrefix}-contact-phone`}
            label="Contact phone"
            placeholder="0917 123 4567"
            value={value.contactPhone}
            error={errors.contactPhone}
            helperText={notes.contactPhone}
            disabled={disabled}
            onChange={(val) => onChange({ contactPhone: val })}
          />
          <Input
            id={`${idPrefix}-contact-email`}
            label="Contact email"
            type="email"
            placeholder="e.g. hr@acmecorp.com"
            value={value.contactEmail}
            error={errors.contactEmail}
            helperText={notes.contactEmail}
            disabled={disabled}
            onChange={(e) => onChange({ contactEmail: e.target.value })}
          />
        </div>
      </section>

      <section aria-labelledby={`${idPrefix}-address`} className="space-y-4 border-t border-slate-100 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <h3 id={`${idPrefix}-address`} className="text-sm font-semibold text-slate-900">
          Facility address
        </h3>
        <Input
          id={`${idPrefix}-street`}
          label="Street or building address"
          placeholder="e.g. Bldg 4, Light Industry & Science Park II"
          value={value.street}
          error={errors.street}
          disabled={disabled}
          onChange={(e) => onChange({ street: e.target.value })}
        />
        <PhilippineAddressFields
          province={value.province}
          city={value.city}
          barangay={value.barangay}
          postalCode={value.postalCode}
          disabled={disabled}
          onChange={(patch) => onChange(patch)}
        />
        {(errors.address || errors.postalCode) && (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {errors.address ?? errors.postalCode}
          </p>
        )}
        <Note text={addressNote} />
      </section>
    </div>
  );
};
