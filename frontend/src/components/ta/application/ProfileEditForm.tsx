import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Input, PhoneInput, Select } from "../../ui";
import { PhilippineAddressFields } from "../../common/PhilippineAddressFields";
import { notify } from "../../../lib/feedback";
import { getManilaToday } from "../../../lib/field-limits";
import type { UpdateCandidateProfileDto } from "../../../lib/types/ta.types";
import {
  formatSSSNumber,
  formatPhilHealthNumber,
  formatPagIbigNumber,
  formatTINNumber,
  validateSSSNumber,
  validatePhilHealthNumber,
  validatePagIbigNumber,
  validateTINNumber,
  validateDateOfBirth,
  validatePhilippineContactPhone,
  validateEmergencyPhone,
  validatePersonName,
  validateAddressText,
} from "../../../lib/statutory-validation";

export interface ProfileEditFormProps {
  /** The applicant profile being verified. */
  profile: any;
  candidateInitials: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (dto: UpdateCandidateProfileDto) => void;
}

const startingForm = (profile: any) => ({
  firstName: profile.firstName || "",
  lastName: profile.lastName || "",
  middleName: profile.middleName || "",
  mobileNumber: profile.mobileNumber || "",
  dateOfBirth: profile.dateOfBirth ? String(profile.dateOfBirth).split("T")[0] : "",
  gender: profile.gender
    ? (profile.gender.toUpperCase() === "MALE" ? "Male" : profile.gender.toUpperCase() === "FEMALE" ? "Female" : profile.gender)
    : "",
  address: profile.address || "",
  city: profile.city || "",
  province: profile.province || "",
  barangay: profile.barangay || "",
  postalCode: profile.postalCode || "",
  tattooStatus: profile.tattooStatus || "NONE",
  sss: profile.sss ? formatSSSNumber(profile.sss) : "",
  philhealth: profile.philhealth ? formatPhilHealthNumber(profile.philhealth) : "",
  pagibig: profile.pagibig ? formatPagIbigNumber(profile.pagibig) : "",
  tin: profile.tin ? formatTINNumber(profile.tin) : "",
  emergencyContactName: profile.emergencyContactName || "",
  emergencyContactPhone: profile.emergencyContactPhone || "",
});

/** Side-by-side verification: the recruiter checks the resume and corrects the profile fields. Rules moved unchanged from the page. */
export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ profile, candidateInitials, isSaving, onCancel, onSave }) => {
  const [profileForm, setProfileForm] = useState(() => startingForm(profile));
  const [profileFormErrors, setProfileFormErrors] = useState<Record<string, string>>({});
  const [photoImgError, setPhotoImgError] = useState(false);

  const handleSaveCandidateProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errors: Record<string, string> = {};

    const firstErr = validatePersonName(profileForm.firstName, "First Name", { required: true });
    if (firstErr) errors.firstName = firstErr;

    if (profileForm.middleName.trim()) {
      const midErr = validatePersonName(profileForm.middleName, "Middle Name");
      if (midErr) errors.middleName = midErr;
    }

    const lastErr = validatePersonName(profileForm.lastName, "Last Name", { required: true });
    if (lastErr) errors.lastName = lastErr;

    if (profileForm.address.trim()) {
      const addrErr = validateAddressText(profileForm.address, "Residential Address");
      if (addrErr) errors.address = addrErr;
    }

    if (profileForm.emergencyContactName.trim()) {
      const emergNameErr = validatePersonName(profileForm.emergencyContactName, "Emergency Contact Name");
      if (emergNameErr) errors.emergencyContactName = emergNameErr;
    }

    if (profileForm.mobileNumber.trim()) {
      const phoneErr = validatePhilippineContactPhone(profileForm.mobileNumber);
      if (phoneErr) errors.mobileNumber = phoneErr;
    }

    if (profileForm.dateOfBirth) {
      const dobErr = validateDateOfBirth(profileForm.dateOfBirth, { minAge: 18, maxAge: 100 });
      if (dobErr) errors.dateOfBirth = dobErr;
    }

    if (profileForm.sss.trim()) {
      const sssErr = validateSSSNumber(profileForm.sss);
      if (sssErr) errors.sss = sssErr;
    }

    if (profileForm.philhealth.trim()) {
      const phErr = validatePhilHealthNumber(profileForm.philhealth);
      if (phErr) errors.philhealth = phErr;
    }

    if (profileForm.pagibig.trim()) {
      const pagibigErr = validatePagIbigNumber(profileForm.pagibig);
      if (pagibigErr) errors.pagibig = pagibigErr;
    }

    if (profileForm.tin.trim()) {
      const tinErr = validateTINNumber(profileForm.tin);
      if (tinErr) errors.tin = tinErr;
    }

    if (profileForm.emergencyContactPhone.trim()) {
      const emergPhoneErr = validateEmergencyPhone(profileForm.emergencyContactPhone);
      if (emergPhoneErr) errors.emergencyContactPhone = emergPhoneErr;
    }

    const addressChanged = ["address", "city", "province", "barangay", "postalCode"].some((field) => {
      const key = field as keyof typeof profileForm;
      const original = profile?.[key as keyof typeof profile];
      return String(profileForm[key] || "").trim() !== String(original || "").trim();
    });
    const hasAddress = [profileForm.address, profileForm.city, profileForm.province, profileForm.barangay, profileForm.postalCode].some((value) => value.trim());
    if (addressChanged && hasAddress && (!profileForm.city.trim() || !profileForm.province.trim() || !profileForm.barangay.trim() || !profileForm.postalCode.trim())) {
      errors.address = "Enter the province, city, barangay, and postal code.";
    }

    if (Object.keys(errors).length > 0) {
      setProfileFormErrors(errors);
      const firstError = Object.values(errors)[0];
      notify.error("Validation Error", firstError || "Please correct the highlighted fields before saving.");
      return;
    }

    setProfileFormErrors({});

    let cleanedPhone = profileForm.mobileNumber.trim();
    if (cleanedPhone) {
      const digits = cleanedPhone.replace(/\D/g, "");
      if (digits.startsWith("09") && digits.length === 11) {
        cleanedPhone = digits;
      } else if (digits.startsWith("9") && digits.length === 10) {
        cleanedPhone = "0" + digits;
      }
    }

    let cleanedEmergencyPhone = profileForm.emergencyContactPhone.trim();
    if (cleanedEmergencyPhone) {
      const digits = cleanedEmergencyPhone.replace(/\D/g, "");
      if (digits.startsWith("09") && digits.length === 11) {
        cleanedEmergencyPhone = digits;
      } else if (digits.startsWith("9") && digits.length === 10) {
        cleanedEmergencyPhone = "0" + digits;
      }
    }

    onSave({
      firstName: profileForm.firstName.trim(),
      lastName: profileForm.lastName.trim(),
      middleName: profileForm.middleName.trim() || null,
      mobileNumber: cleanedPhone || null,
      dateOfBirth: profileForm.dateOfBirth || null,
      gender: profileForm.gender || null,
      address: profileForm.address.trim() || null,
      city: profileForm.city.trim() || null,
      province: profileForm.province.trim() || null,
      barangay: profileForm.barangay.trim() || null,
      postalCode: profileForm.postalCode.trim() || null,
      tattooStatus: (profileForm.tattooStatus as "NONE" | "NON_VISIBLE" | "VISIBLE") || null,
      sss: profileForm.sss.trim() || null,
      philhealth: profileForm.philhealth.trim() || null,
      pagibig: profileForm.pagibig.trim() || null,
      tin: profileForm.tin.trim() || null,
      emergencyContactName: profileForm.emergencyContactName.trim() || null,
      emergencyContactPhone: cleanedEmergencyPhone || null,
    });
  };

  return (
    <form onSubmit={handleSaveCandidateProfile} className="space-y-3 pt-2">
      <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
        <div className="shrink-0">
          {profile?.photoUrl && !photoImgError ? (
            <img
              src={profile.photoUrl}
              alt="Profile"
              className="w-12 h-12 rounded-md object-cover border border-slate-300 shadow-xs"
              onError={() => setPhotoImgError(true)}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-navy-soft text-xs font-semibold text-navy ring-1 ring-inset ring-navy-line">
              {candidateInitials}
            </div>
          )}
        </div>
        <div className="text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Check against the resume</p>
          <p className="text-xs text-slate-600">Correct any field that differs from the resume, then save.</p>
        </div>
      </div>
    
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="First Name"
          nameInput
          maxLength={100}
          required
          value={profileForm.firstName}
          error={profileFormErrors.firstName}
          onChange={(e) => {
            setProfileForm((f) => ({ ...f, firstName: e.target.value }));
            if (profileFormErrors.firstName) setProfileFormErrors((prev) => ({ ...prev, firstName: "" }));
          }}
          placeholder="First name"
        />
        <Input
          label="Last Name"
          nameInput
          maxLength={100}
          required
          value={profileForm.lastName}
          error={profileFormErrors.lastName}
          onChange={(e) => {
            setProfileForm((f) => ({ ...f, lastName: e.target.value }));
            if (profileFormErrors.lastName) setProfileFormErrors((prev) => ({ ...prev, lastName: "" }));
          }}
          placeholder="Last name"
        />
      </div>
    
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Middle Name"
          nameInput
          maxLength={100}
          value={profileForm.middleName}
          onChange={(e) => setProfileForm((f) => ({ ...f, middleName: e.target.value }))}
          placeholder="Middle name (optional)"
        />
        <PhoneInput
          label="Contact Phone"
          value={profileForm.mobileNumber}
          mobileOnly
          error={profileFormErrors.mobileNumber}
          onChange={(val) => {
            setProfileForm((f) => ({ ...f, mobileNumber: val }));
            if (profileFormErrors.mobileNumber) setProfileFormErrors((prev) => ({ ...prev, mobileNumber: "" }));
          }}
          placeholder="0917 123 4567"
          helperText="Format: 09XX-XXX-XXXX"
        />
      </div>
    
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Date of Birth"
          type="date"
          value={profileForm.dateOfBirth}
          min="1900-01-01"
          max={getManilaToday()}
          error={profileFormErrors.dateOfBirth}
          helperText={profileFormErrors.dateOfBirth ? undefined : "Candidate must be at least 18 years old"}
          onChange={(e) => {
            setProfileForm((f) => ({ ...f, dateOfBirth: e.target.value }));
            if (profileFormErrors.dateOfBirth) setProfileFormErrors((prev) => ({ ...prev, dateOfBirth: "" }));
          }}
        />
        <Select
          label="Gender"
          value={profileForm.gender}
          onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}
        >
          <option value="">Any / Unspecified</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </Select>
      </div>
    
      <div>
        <Input
          label="Address"
          maxLength={500}
          value={profileForm.address}
          onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="House/Unit, Street, Barangay"
        />
      </div>
    
      <PhilippineAddressFields
        province={profileForm.province}
        city={profileForm.city}
        barangay={profileForm.barangay}
        postalCode={profileForm.postalCode}
        onChange={(patch) => setProfileForm((previous) => ({ ...previous, ...patch }))}
      />
    
      <div>
        <Select
          label="Tattoo Status"
          value={profileForm.tattooStatus}
          onChange={(e) => setProfileForm((f) => ({ ...f, tattooStatus: e.target.value }))}
          helperText="Confirm tattoo policy compliance with client MRF specifications."
        >
          <option value="NONE">None / No tattoos</option>
          <option value="NON_VISIBLE">Non-visible / Covered</option>
          <option value="VISIBLE">Visible tattoos</option>
        </Select>
      </div>
    
      <div className="pt-2 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-700 mb-2">Statutory Identifiers</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="SSS Number"
            value={profileForm.sss}
            maxLength={12}
            inputMode="numeric"
            error={profileFormErrors.sss}
            helperText="e.g. 01-2345678-9 (10 digits)"
            onChange={(e) => {
              const val = formatSSSNumber(e.target.value);
              setProfileForm((f) => ({ ...f, sss: val }));
              if (profileFormErrors.sss) setProfileFormErrors((prev) => ({ ...prev, sss: "" }));
            }}
            placeholder="01-2345678-9"
          />
          <Input
            label="PhilHealth PIN"
            value={profileForm.philhealth}
            maxLength={14}
            inputMode="numeric"
            error={profileFormErrors.philhealth}
            helperText="e.g. 01-234567890-1 (12 digits)"
            onChange={(e) => {
              const val = formatPhilHealthNumber(e.target.value);
              setProfileForm((f) => ({ ...f, philhealth: val }));
              if (profileFormErrors.philhealth) setProfileFormErrors((prev) => ({ ...prev, philhealth: "" }));
            }}
            placeholder="01-234567890-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Input
            label="Pag-IBIG MID"
            value={profileForm.pagibig}
            maxLength={14}
            inputMode="numeric"
            error={profileFormErrors.pagibig}
            helperText="e.g. 1234-5678-9012 (12 digits)"
            onChange={(e) => {
              const val = formatPagIbigNumber(e.target.value);
              setProfileForm((f) => ({ ...f, pagibig: val }));
              if (profileFormErrors.pagibig) setProfileFormErrors((prev) => ({ ...prev, pagibig: "" }));
            }}
            placeholder="1234-5678-9012"
          />
          <Input
            label="TIN Number"
            value={profileForm.tin}
            maxLength={15}
            inputMode="numeric"
            error={profileFormErrors.tin}
            helperText="e.g. 123-456-789-000 (9 or 12 digits)"
            onChange={(e) => {
              const val = formatTINNumber(e.target.value);
              setProfileForm((f) => ({ ...f, tin: val }));
              if (profileFormErrors.tin) setProfileFormErrors((prev) => ({ ...prev, tin: "" }));
            }}
            placeholder="123-456-789-000"
          />
        </div>
      </div>
    
      <div className="pt-2 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-700 mb-2">Emergency Contact</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Emergency Contact Name"
            nameInput
            value={profileForm.emergencyContactName}
            onChange={(e) => setProfileForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
            placeholder="Full name"
          />
          <PhoneInput
            label="Emergency Contact Phone"
            value={profileForm.emergencyContactPhone}
            mobileOnly
            error={profileFormErrors.emergencyContactPhone}
            onChange={(val) => {
              setProfileForm((f) => ({ ...f, emergencyContactPhone: val }));
              if (profileFormErrors.emergencyContactPhone) setProfileFormErrors((prev) => ({ ...prev, emergencyContactPhone: "" }));
            }}
            placeholder="0917-123-4567"
            helperText="e.g. 0917-123-4567"
          />
        </div>
      </div>
    
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={isSaving}
          onClick={() => onCancel()}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="submit"
          loading={isSaving}
          leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
        >
          Verify & Save Changes
        </Button>
      </div>
    </form>
  );
};
