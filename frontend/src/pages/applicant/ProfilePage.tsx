import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { applicantApi } from "../../lib/api/applicant.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  ConfirmDialog,
  DocumentPreviewModal,
} from "../../components/common";
import {
  Input,
  Button,
  Textarea,
  Dialog,
  Select,
  PhoneInput,
  ComboBox,
} from "../../components/ui";
import { SkillsSection } from "../../components/applicant/SkillsSection";
import { PhilippineAddressFields } from "../../components/common/PhilippineAddressFields";
import { findNcrBarangay, isNcrProvince } from "../../lib/ncr-address";
import { getNcrBarangayPostal } from "../../lib/ncr-postal-reference";
import { getCityPostalCodes } from "../../lib/ph-address";
import { formatDate, extractDocumentId } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { countActionable, countUndatedWork } from "../../lib/resume-autofill";
import { ResumeReviewDialog } from "../../components/applicant/ResumeReviewDialog";
import type { ResumeAccept, ResumeProposal } from "../../lib/types/applicant.types";
import { normalizeTitleCase, normalizeSentenceCase } from "../../lib/text-case";
import { ProfileApplications } from "./components/profile/ProfileApplications";
import { ProfileDisclosure } from "./components/profile/ProfileDisclosure";
import { computeProfileProgress, PERSONAL_SECTION_ORDER, type PersonalSectionId } from "./components/profile/profile-progress";
import { ProfileOverview } from "./components/profile/ProfileOverview";
import { ProfileSectionNav } from "./components/profile/ProfileSectionNav";
import type { ProfileSection } from "./components/profile/profile-navigation";
import { parseProfileSection } from "./components/profile/profile-navigation";
import { FIELD_LIMITS, getManilaToday, isValidDateOnly } from "../../lib/field-limits";
import { toast } from "sonner";
import { fieldErrorsFrom } from "../../lib/feedback";
import { validatePhilippineMobile } from "../../lib/phone-utils";
import {
  validateDateOfBirth,
  validatePagIbigNumber,
  validatePersonName,
  validatePhilHealthNumber,
  validateSSSNumber,
  validateTINNumber,
} from "../../lib/statutory-validation";
import {
  RELIGION_OPTIONS,
  RELIGION_OTHER,
  joinReligion,
  splitReligion,
} from "../../lib/hr-constants";
import {
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";

const NATIONALITY_OPTIONS = [
  "Filipino",
  "American",
  "Australian",
  "British",
  "Canadian",
  "Chinese",
  "German",
  "Indian",
  "Indonesian",
  "Japanese",
  "Korean",
  "Malaysian",
  "Singaporean",
  "Spanish",
  "Taiwanese",
  "Vietnamese",
];

const PREFERRED_WORK_LOCATION_OPTIONS = [
  "Laguna",
  "Quezon City",
  "Makati City",
  "Taguig City",
  "Pasig City",
  "Manila",
  "Valenzuela City",
  "Caloocan City",
  "Mandaluyong City",
  "Pasay City",
  "Parañaque City",
  "Muntinlupa City",
  "Antipolo City",
  "Rizal",
  "Cavite",
  "Bulacan",
  "Batangas",
  "Pampanga",
  "Remote",
];

export function formatSSSNumber(raw: string): string {
  if (!/^[\d -]*$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 10) return raw;
  if (digits.length <= 2) return digits;
  if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9, 10)}`;
}

export function formatPhilHealthNumber(raw: string): string {
  if (!/^[\d -]*$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 12) return raw;
  if (digits.length <= 2) return digits;
  if (digits.length <= 11) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 11)}-${digits.slice(11, 12)}`;
}

export function formatPagIbigNumber(raw: string): string {
  if (!/^[\d -]*$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 12) return raw;
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
}

export function formatTINNumber(raw: string): string {
  if (!/^[\d -]*$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 12) return raw;
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9, 12)}`;
}

// Non-empty text with no letter (e.g. "12345") is rejected; empty values are left to each field's own required check.
const lettersOnlyErrors = (values: Record<string, FormDataEntryValue | null>): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const text = typeof value === "string" ? value.trim() : "";
    if (text && !/\p{L}/u.test(text)) errors[key] = "Use letters, not only numbers.";
  }
  return errors;
};

const withoutKey = (errors: Record<string, string>, key: string): Record<string, string> => {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
};

const firstFieldError = (errors: Record<string, string>): string | undefined => Object.values(errors)[0];

// Today's date in Manila time minus whole years; a Feb 29 date falls back to Feb 28 in a non-leap year.
const manilaDateYearsAgo = (years: number): string => {
  const [year, month, day] = getManilaToday().split("-").map(Number);
  const monthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const candidate = `${year - years}-${monthDay}`;
  return isValidDateOnly(candidate) ? candidate : `${year - years}-02-28`;
};

const PERSONAL_SECTION_FIELDS: Record<string, string[]> = {
  basic: ["firstName", "middleName", "lastName", "dateOfBirth", "birthPlace", "gender", "civilStatus", "nationality", "religion"],
  contact: ["mobileNumber", "address", "province", "city", "barangay", "postalCode"],
  physical: ["height", "weight"],
  work: ["preferredWorkLocations", "professionalSummary"],
  government: ["sss", "philhealth", "pagibig", "tin"],
  notes: ["additionalNotes"],
};

// Disclosure that holds a personal-info field, so an error inside a collapsed section can be opened.
const personalSectionOf = (field: string): string | undefined =>
  Object.keys(PERSONAL_SECTION_FIELDS).find((section) => PERSONAL_SECTION_FIELDS[section].includes(field));

// Pre-submit checks run before the API call. Empty optional values pass; messages come from the helpers.
const personalFieldErrorsFor = (form: {
  firstName: string;
  middleName: string;
  lastName: string;
  mobileNumber: string;
  dateOfBirth: string;
  sss: string;
  philhealth: string;
  pagibig: string;
  tin: string;
}): Record<string, string> => {
  const errors: Record<string, string> = {};
  const firstName = form.firstName.trim() ? validatePersonName(form.firstName, "First name") : "First name is required.";
  const middleName = validatePersonName(form.middleName, "Middle name");
  const lastName = form.lastName.trim() ? validatePersonName(form.lastName, "Last name") : "Last name is required.";
  if (firstName) errors.firstName = firstName;
  if (middleName) errors.middleName = middleName;
  if (lastName) errors.lastName = lastName;
  const mobile = validatePhilippineMobile(form.mobileNumber);
  if (!form.mobileNumber.trim()) errors.mobileNumber = "Mobile number is required.";
  else if (!mobile.isValid && mobile.message) errors.mobileNumber = mobile.message;
  if (validateDateOfBirth(form.dateOfBirth, { minAge: 18, maxAge: 100 })) {
    errors.dateOfBirth = "Applicant must be between 18 and 100 years old.";
  }
  const sss = validateSSSNumber(form.sss);
  const philhealth = validatePhilHealthNumber(form.philhealth);
  const pagibig = validatePagIbigNumber(form.pagibig);
  const tin = validateTINNumber(form.tin);
  if (sss) errors.sss = sss;
  if (philhealth) errors.philhealth = philhealth;
  if (pagibig) errors.pagibig = pagibig;
  if (tin) errors.tin = tin;
  return errors;
};

export const ProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { refreshUser, user } = useAuth();
  const navigate = useNavigate({ from: "/app/profile" });

  const [activeSection, setActiveSection] = useState<ProfileSection>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return parseProfileSection(params.get("section"), params.get("tab"));
    }
    return "overview";
  });

  const [openPersonalSection, setOpenPersonalSection] = useState("basic");
  const [openQualificationSection, setOpenQualificationSection] = useState("experience");

  const handleSectionChange = (section: ProfileSection) => {
    setActiveSection(section);
    void navigate({
      search: (previous) => ({ ...previous, section, tab: undefined }),
      replace: true,
    });
  };

  const profileQuery = useQuery({
    queryKey: ["applicant", "profile"],
    queryFn: applicantApi.getProfile,
  });

  const profile = profileQuery.data;

  // Document Preview State
  const [previewDocState, setPreviewDocState] = useState<{
    open: boolean;
    documentId?: number | null;
    fileUrl?: string | null;
    title?: string;
  } | null>(null);

  // Candidate Photo Error State
  const [imgError, setImgError] = useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [profile?.photoUrl]);

  const candidateInitials = `${profile?.firstName?.[0] || ""}${profile?.lastName?.[0] || ""}`.toUpperCase() || "AP";

  // Dialog & Editing States
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<any | null>(null);

  const [eduModalOpen, setEduModalOpen] = useState(false);
  const [editingEdu, setEditingEdu] = useState<any | null>(null);

  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<any | null>(null);

  const [refModalOpen, setRefModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<any | null>(null);
  const [refPhone, setRefPhone] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "experience" | "education" | "training" | "reference";
    id: number | string;
    label: string;
  } | null>(null);

  // Inline field errors: pre-submit checks, then backend validation errors. Cleared per field on edit.
  const [personalFieldErrors, setPersonalFieldErrors] = useState<Record<string, string>>({});
  const clearPersonalFieldError = (field: string) => setPersonalFieldErrors((prev) => withoutKey(prev, field));

  const [expErrors, setExpErrors] = useState<Record<string, string>>({});
  const [eduErrors, setEduErrors] = useState<Record<string, string>>({});
  const [trainingErrors, setTrainingErrors] = useState<Record<string, string>>({});
  const [refErrors, setRefErrors] = useState<Record<string, string>>({});
  const clearExpError = (field: string) => setExpErrors((prev) => withoutKey(prev, field));
  const clearEduError = (field: string) => setEduErrors((prev) => withoutKey(prev, field));
  const clearTrainingError = (field: string) => setTrainingErrors((prev) => withoutKey(prev, field));
  const clearRefError = (field: string) => setRefErrors((prev) => withoutKey(prev, field));
  // Errors from one open of a qualification dialog do not carry over to the next open
  React.useEffect(() => {
    if (!expModalOpen) setExpErrors({});
  }, [expModalOpen]);
  React.useEffect(() => {
    if (!eduModalOpen) setEduErrors({});
  }, [eduModalOpen]);
  React.useEffect(() => {
    if (!trainingModalOpen) setTrainingErrors({});
  }, [trainingModalOpen]);
  React.useEffect(() => {
    if (!refModalOpen) setRefErrors({});
  }, [refModalOpen]);

  // Personal Info Form State
  const [personalForm, setPersonalForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    dateOfBirth: "",
    mobileNumber: "",
    gender: "",
    civilStatus: "",
    nationality: "",
    birthPlace: "",
    religion: "",
    height: "",
    weight: "",
    address: "",
    province: "",
    city: "",
    barangay: "",
    postalCode: "",
    preferredWorkLocations: "",
    professionalSummary: "",
    sss: "",
    philhealth: "",
    pagibig: "",
    tin: "",
    additionalNotes: "",
  });

  // Skills state
  const [skillsList, setSkillsList] = useState<string[]>([]);

  // Religion "Please specify" text; combined into personalForm.religion via joinReligion
  const [religionOtherDraft, setReligionOtherDraft] = useState("");
  const religionParts = splitReligion(personalForm.religion);
  // Prefer the draft (keeps typed spaces) only while it still matches the stored value;
  // otherwise show the stored text, e.g. after profile load or resume autofill.
  const religionOtherText =
    joinReligion(RELIGION_OTHER, religionOtherDraft) === personalForm.religion
      ? religionOtherDraft
      : religionParts.other;

  const profileProgress = computeProfileProgress(personalForm, personalFieldErrors, personalSectionOf);
  const goToPersonalSection = (id: PersonalSectionId) => {
    setOpenPersonalSection(id);
    requestAnimationFrame(() =>
      document.getElementById(`profile-personal-${id}`)?.closest("section")?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };
  const stepProps = (id: PersonalSectionId) => {
    const index = PERSONAL_SECTION_ORDER.indexOf(id);
    const previous = PERSONAL_SECTION_ORDER[index - 1];
    const next = PERSONAL_SECTION_ORDER[index + 1];
    return {
      status: profileProgress.sections[id].status,
      missing: profileProgress.sections[id].missing,
      step: `Step ${index + 1} of ${PERSONAL_SECTION_ORDER.length}`,
      onPrevious: previous ? () => goToPersonalSection(previous) : undefined,
      onNext: next ? () => goToPersonalSection(next) : undefined,
    };
  };

  // Auto-Fill & Extraction State
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [reviewProposal, setReviewProposal] = useState<{ parseId: number; proposal: ResumeProposal } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // A proposal can already be waiting, e.g. created when the applicant submitted an application.
  const pendingProposalQuery = useQuery({
    queryKey: ["applicant", "resume-proposal"],
    queryFn: applicantApi.getResumeProposal,
  });
  const pendingProposal = pendingProposalQuery.data;
  React.useEffect(() => {
    if (pendingProposal && countActionable(pendingProposal.proposal) > 0) {
      setReviewProposal((current) =>
        current?.parseId === pendingProposal.parseId
          ? current
          : { parseId: pendingProposal.parseId, proposal: pendingProposal.proposal },
      );
    }
  }, [pendingProposal]);

  // Form values from the last sync with the saved profile. A field that differs from it was edited by
  // the applicant and must survive a refetch (for example after a resume upload).
  const lastSyncedFormRef = React.useRef<typeof personalForm | null>(null);
  const lastSyncedProfileRef = React.useRef<unknown>(null);
  const personalFormRef = React.useRef(personalForm);
  personalFormRef.current = personalForm;

  // Update local form when data arrives
  React.useEffect(() => {
    if (profile) {
      // Effects can run twice for one profile (React strict mode); sync once.
      if (lastSyncedProfileRef.current === profile) return;
      lastSyncedProfileRef.current = profile;
      const current = personalFormRef.current;
      const synced = lastSyncedFormRef.current;
      {
        const next = ((prev: typeof current) => {
        const loadedProvince = normalizeTitleCase(profile.province || prev.province) || profile.province || prev.province || "";
        const loadedCity = normalizeTitleCase(profile.city || prev.city) || profile.city || prev.city || "";
        let loadedBarangay = profile.barangay || prev.barangay || "";
        let loadedPostalCode = profile.postalCode || prev.postalCode || "";
        if (loadedBarangay) {
          if (isNcrProvince(loadedProvince) && loadedCity) {
            const match = findNcrBarangay(loadedCity, loadedBarangay);
            if (match) loadedBarangay = match.name;
            if (!loadedPostalCode) {
              loadedPostalCode = getNcrBarangayPostal(loadedCity, loadedBarangay)?.codes[0] || "";
            }
          } else if (!loadedPostalCode && loadedProvince && loadedCity) {
            const codes = getCityPostalCodes(loadedProvince, loadedCity);
            if (codes.length === 1) loadedPostalCode = codes[0];
          }
        }

        return {
          ...prev,
          firstName: normalizeTitleCase(profile.firstName || prev.firstName) || profile.firstName || prev.firstName || "",
          lastName: normalizeTitleCase(profile.lastName || prev.lastName) || profile.lastName || prev.lastName || "",
          middleName: profile.middleName ? (normalizeTitleCase(profile.middleName) || profile.middleName) : prev.middleName || "",
          dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.substring(0, 10) : prev.dateOfBirth || "",
          mobileNumber: profile.mobileNumber || prev.mobileNumber || "",
          gender: normalizeTitleCase(profile.gender || prev.gender) || profile.gender || prev.gender || "",
          civilStatus: normalizeTitleCase(profile.civilStatus || prev.civilStatus) || profile.civilStatus || prev.civilStatus || "",
          nationality: normalizeTitleCase(profile.nationality || prev.nationality) || profile.nationality || prev.nationality || "",
          birthPlace: normalizeTitleCase(profile.birthPlace || prev.birthPlace) || profile.birthPlace || prev.birthPlace || "",
          religion: normalizeTitleCase(profile.religion || prev.religion) || profile.religion || prev.religion || "",
          height: profile.height !== null && profile.height !== undefined ? String(profile.height) : prev.height || "",
          weight: profile.weight !== null && profile.weight !== undefined ? String(profile.weight) : prev.weight || "",
          address: normalizeTitleCase(profile.address || prev.address) || profile.address || prev.address || "",
          province: loadedProvince,
          city: loadedCity,
          barangay: loadedBarangay,
          postalCode: loadedPostalCode,
          preferredWorkLocations: normalizeTitleCase(profile.preferredWorkLocations || prev.preferredWorkLocations) || profile.preferredWorkLocations || prev.preferredWorkLocations || "",
          professionalSummary: normalizeSentenceCase(profile.professionalSummary || prev.professionalSummary) || profile.professionalSummary || prev.professionalSummary || "",
          sss: profile.sss ? formatSSSNumber(profile.sss) : prev.sss || "",
          philhealth: profile.philhealth ? formatPhilHealthNumber(profile.philhealth) : prev.philhealth || "",
          pagibig: profile.pagibig ? formatPagIbigNumber(profile.pagibig) : prev.pagibig || "",
          tin: profile.tin ? formatTINNumber(profile.tin) : prev.tin || "",
          additionalNotes: profile.additionalNotes || prev.additionalNotes || "",
        };
        })(current);
        const merged = { ...next };
        if (synced) {
          for (const key of Object.keys(next) as Array<keyof typeof next>) {
            if (current[key] !== synced[key]) (merged as any)[key] = current[key];
          }
        }
        lastSyncedFormRef.current = next;
        setPersonalForm(merged);
      }

      if (profile.skills && profile.skills.length > 0) {
        const parsed = profile.skills.map((s: any) =>
          typeof s === "string" ? s : s.name || s.skillName || s.skill?.name || ""
        ).filter(Boolean);
        setSkillsList(parsed);
      }
    }
  }, [profile]);

  const [feedback, setFeedbackState] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // The banner sits at the top of the page, so also toast, centred where the eye is: the result stays visible wherever the applicant scrolled.
  const setFeedback = (next: { type: "success" | "error"; message: string } | null) => {
    setFeedbackState(next);
    if (next) (next.type === "success" ? toast.success : toast.error)(next.message, { position: "top-center" });
  };

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: applicantApi.upsertProfile,
    onSuccess: (savedProfile) => {
      // The saved values are now the baseline: take them in full on the next sync.
      lastSyncedFormRef.current = null;
      queryClient.setQueryData(["applicant", "profile"], savedProfile);
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      void refreshUser();
      setFeedback({ type: "success", message: "Personal information saved successfully." });
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const firstMessage = firstFieldError(fieldErrors);
      setPersonalFieldErrors(fieldErrors);
      const errorSection = Object.keys(fieldErrors).map(personalSectionOf).find(Boolean);
      if (errorSection) setOpenPersonalSection(errorSection);
      setFeedback({ type: "error", message: "Failed to save personal information: " + (firstMessage ?? err.message) });
    },
  });

  const uploadResumeMutation = useMutation({
    mutationFn: applicantApi.uploadResume,
    onSuccess: (data) => {
      // The upload only stores the file. Parsed details wait in a proposal until the applicant confirms,
      // so the form and any unsaved edits are left untouched here.
      if (data?.profile) {
        queryClient.setQueryData(["applicant", "profile"], data.profile);
      }
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      void refreshUser();

      if (data?.extractionStatus === "UNAVAILABLE") {
        setFeedback({
          type: "success",
          message: "Resume saved. We couldn't read its details — you can fill them in below.",
        });
      } else if (data?.proposal && data.parseId != null && countActionable(data.proposal) > 0) {
        setReviewProposal({ parseId: data.parseId, proposal: data.proposal });
        setReviewOpen(true);
        setFeedback(null);
      } else if (countUndatedWork(data?.proposal) > 0) {
        setFeedback({
          type: "success",
          message: "Resume saved. Some jobs had no start date, so they were not added. Add them under Work experience.",
        });
      } else {
        setFeedback({ type: "success", message: "Resume saved. No new details found." });
      }
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to upload resume: " + err.message });
    },
  });

  const applyResumeMutation = useMutation({
    mutationFn: ({ parseId, accept }: { parseId: number; accept: ResumeAccept }) =>
      applicantApi.applyResumeProposal(parseId, accept),
    onSuccess: (result, { accept }) => {
      if (result?.profile) queryClient.setQueryData(["applicant", "profile"], result.profile);
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      void refreshUser();
      const notSaved = new Set(result?.changeSummary?.skippedAddressFields ?? []);
      setAutoFilledFields((prev) => new Set([...prev, ...accept.personal.filter((field) => !notSaved.has(field))]));
      setReviewOpen(false);
      setReviewProposal(null);
      setReviewError(null);
      setFeedback({
        type: "success",
        message: result?.changeSummary?.skippedAddressFields?.length
          ? "Resume details saved. The address was not saved because it was incomplete. Add the province, city, barangay and postal code under Contact and address."
          : "Resume details saved to your profile.",
      });
    },
    onError: (err: any) => {
      if (err?.status === 409) {
        // Already reviewed elsewhere: drop the stale proposal.
        setReviewOpen(false);
        setReviewProposal(null);
        setReviewError(null);
        queryClient.invalidateQueries({ queryKey: ["applicant"] });
        setFeedback({ type: "error", message: "These resume details were already reviewed." });
      } else if (err?.status === 403) {
        setReviewError("Some of these details were verified by MEGS staff and can't be changed. Clear them and try again.");
      } else {
        setReviewError("We couldn't save these details. Please try again.");
      }
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: applicantApi.uploadPhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setFeedback({ type: "success", message: "Photo uploaded successfully." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: "Failed to upload photo: " + err.message });
    },
  });

  const addExpMutation = useMutation({
    mutationFn: async (payload: { roleTitle: string; company: string; startDate: string; endDate?: string; isCurrent: boolean; summary?: string; previousId?: number | string }) => {
      // Save the new entry first; remove the one being edited only after that succeeds
      const saved = await applicantApi.addWorkExperience(payload);
      if (payload.previousId) {
        await applicantApi.deleteWorkExperience(payload.previousId);
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setExpModalOpen(false);
      setEditingExp(null);
      setFeedback({ type: "success", message: "Work experience saved successfully." });
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const firstMessage = firstFieldError(fieldErrors);
      setExpErrors(fieldErrors);
      setFeedback({
        type: "error",
        message: firstMessage ? "Failed to save work experience: " + firstMessage : (err?.message || "Failed to save work experience."),
      });
    },
  });

  const deleteExpMutation = useMutation({
    mutationFn: applicantApi.deleteWorkExperience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Work experience entry removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete work experience." });
    },
  });

  const addEduMutation = useMutation({
    mutationFn: async (payload: { school: string; degree: string; fieldOfStudy?: string; startDate: string; endDate?: string; notes?: string; previousId?: number | string }) => {
      const saved = await applicantApi.addEducation(payload);
      if (payload.previousId) {
        await applicantApi.deleteEducation(payload.previousId);
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setEduModalOpen(false);
      setEditingEdu(null);
      setFeedback({ type: "success", message: "Education record saved successfully." });
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const firstMessage = firstFieldError(fieldErrors);
      setEduErrors(fieldErrors);
      setFeedback({
        type: "error",
        message: firstMessage ? "Failed to save education record: " + firstMessage : (err?.message || "Failed to save education record."),
      });
    },
  });

  const deleteEduMutation = useMutation({
    mutationFn: applicantApi.deleteEducation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Education record removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete education record." });
    },
  });

  const updateSkillsMutation = useMutation({
    mutationFn: applicantApi.updateSkills,
    // The list is updated optimistically; keep the last saved one to restore if the save fails.
    onMutate: () => ({ previousSkills: skillsList }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setFeedback({ type: "success", message: "Skills updated successfully." });
    },
    onError: (err: any, _skills, context) => {
      if (context) setSkillsList(context.previousSkills);
      setFeedback({ type: "error", message: err?.message || "Failed to update skills." });
    },
  });

  const addTrainingMutation = useMutation({
    mutationFn: async (payload: { title: string; provider: string; completionDate?: string; previousId?: number | string }) => {
      const saved = await applicantApi.addTraining(payload);
      if (payload.previousId) {
        await applicantApi.deleteTraining(payload.previousId);
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setTrainingModalOpen(false);
      setEditingTraining(null);
      setFeedback({ type: "success", message: "Training certification saved successfully." });
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const firstMessage = firstFieldError(fieldErrors);
      setTrainingErrors(fieldErrors);
      setFeedback({
        type: "error",
        message: firstMessage ? "Failed to save training certification: " + firstMessage : (err?.message || "Failed to save training certification."),
      });
    },
  });

  const deleteTrainingMutation = useMutation({
    mutationFn: applicantApi.deleteTraining,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Training certification removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete training certification." });
    },
  });

  const addRefMutation = useMutation({
    mutationFn: async (payload: { name: string; relationship: string; company?: string; phone: string; email?: string; previousId?: number | string }) => {
      const saved = await applicantApi.addReference(payload);
      if (payload.previousId) {
        await applicantApi.deleteReference(payload.previousId);
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setRefModalOpen(false);
      setEditingRef(null);
      setFeedback({ type: "success", message: "Character reference saved successfully." });
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      const firstMessage = firstFieldError(fieldErrors);
      setRefErrors(fieldErrors);
      setFeedback({
        type: "error",
        message: firstMessage ? "Failed to save character reference: " + firstMessage : (err?.message || "Failed to save character reference."),
      });
    },
  });

  const deleteRefMutation = useMutation({
    mutationFn: applicantApi.deleteReference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "profile"] });
      setDeleteTarget(null);
      setFeedback({ type: "success", message: "Character reference removed." });
    },
    onError: (err: any) => {
      setFeedback({ type: "error", message: err?.message || "Failed to delete character reference." });
    },
  });


  const isNotFoundError =
    profileQuery.isError &&
    (profileQuery.error?.message?.includes("not found") ||
      profileQuery.error?.message?.includes("404") ||
      Boolean((profileQuery.error as any)?.status === 404));

  const profileFormSnapshot = profile
    ? {
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        middleName: profile.middleName || "",
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.substring(0, 10) : "",
        mobileNumber: profile.mobileNumber || "",
        gender: profile.gender || "",
        civilStatus: profile.civilStatus || "",
        nationality: profile.nationality || "",
        birthPlace: profile.birthPlace || "",
        religion: profile.religion || "",
        height: profile.height !== null && profile.height !== undefined ? String(profile.height) : "",
        weight: profile.weight !== null && profile.weight !== undefined ? String(profile.weight) : "",
        address: profile.address || "",
        province: profile.province || "",
        city: profile.city || "",
        barangay: profile.barangay || "",
        postalCode: profile.postalCode || "",
        preferredWorkLocations: profile.preferredWorkLocations || "",
        professionalSummary: profile.professionalSummary || "",
        sss: profile.sss ? formatSSSNumber(profile.sss) : "",
        philhealth: profile.philhealth ? formatPhilHealthNumber(profile.philhealth) : "",
        pagibig: profile.pagibig ? formatPagIbigNumber(profile.pagibig) : "",
        tin: profile.tin ? formatTINNumber(profile.tin) : "",
        additionalNotes: profile.additionalNotes || "",
      }
    : null;
  const personalFormDirty = Boolean(profileFormSnapshot && JSON.stringify(personalForm) !== JSON.stringify(profileFormSnapshot));
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => personalFormDirty && current.pathname !== next.pathname,
    enableBeforeUnload: personalFormDirty,
    withResolver: true,
  });

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Profile" description="Loading profile..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (profileQuery.isError && !isNotFoundError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Profile" description="Manage your qualifications" />
        <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
      </div>
    );
  }

  // Work experience form submit
  const handleSaveExp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const startDate = formData.get("startDate") as string;
    const isCurrent = formData.get("isCurrent") === "on";
    // A current role has no end date, so any end date is ignored and not sent
    const endDate = isCurrent ? "" : (formData.get("endDate") as string);
    const expLetterErrors = lettersOnlyErrors({ title: formData.get("jobTitle"), company: formData.get("companyName") });
    if (Object.keys(expLetterErrors).length > 0) {
      setExpErrors(expLetterErrors);
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setExpErrors({ endDate: "End date can't be before the start date." });
      return;
    }
    setExpErrors({});
    addExpMutation.mutate({
      roleTitle: formData.get("jobTitle") as string,
      company: formData.get("companyName") as string,
      startDate,
      endDate: endDate || undefined,
      isCurrent,
      summary: (formData.get("responsibilities") as string) || undefined,
      previousId: editingExp?.id,
    });
  };

  // Education form submit
  const handleSaveEdu = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const eduLetterErrors = lettersOnlyErrors({
      school: formData.get("schoolName"),
      degree: formData.get("degree"),
      field: formData.get("fieldOfStudy"),
    });
    if (Object.keys(eduLetterErrors).length > 0) {
      setEduErrors(eduLetterErrors);
      return;
    }
    if (!startDate) {
      setEduErrors({ startDate: "Start date is required." });
      return;
    }
    if (endDate && endDate < startDate) {
      setEduErrors({ endDate: "End date can't be before the start date." });
      return;
    }
    setEduErrors({});
    addEduMutation.mutate({
      school: formData.get("schoolName") as string,
      degree: formData.get("degree") as string,
      fieldOfStudy: (formData.get("fieldOfStudy") as string) || undefined,
      startDate,
      endDate: endDate || undefined,
      notes: (formData.get("notes") as string) || undefined,
      previousId: editingEdu?.id,
    });
  };

  // Training form submit
  const handleSaveTraining = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const trainingLetterErrors = lettersOnlyErrors({ title: formData.get("title"), provider: formData.get("issuer") });
    if (Object.keys(trainingLetterErrors).length > 0) {
      setTrainingErrors(trainingLetterErrors);
      return;
    }
    setTrainingErrors({});
    addTrainingMutation.mutate({
      title: formData.get("title") as string,
      provider: formData.get("issuer") as string,
      completionDate: (formData.get("issueDate") as string) || undefined,
      previousId: editingTraining?.id,
    });
  };

  // Reference form submit
  const handleSaveRef = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addRefMutation.mutate({
      name: formData.get("name") as string,
      relationship: formData.get("relationship") as string,
      company: (formData.get("company") as string) || undefined,
      phone: refPhone,
      email: (formData.get("email") as string) || undefined,
      previousId: editingRef?.id,
    });
  };

  // Skills add / remove
  const handleAddSkill = (newSkills: string[]) => {
    if (newSkills.length === 0) return;
    if (skillsList.length + newSkills.length > FIELD_LIMITS.skills) {
      setFeedback({ type: "error", message: `You can list up to ${FIELD_LIMITS.skills} skills. Remove some before adding more.` });
      return;
    }
    const updated = [...skillsList, ...newSkills];
    setSkillsList(updated);
    updateSkillsMutation.mutate(updated);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = skillsList.filter((s) => s.toLowerCase() !== skillToRemove.toLowerCase());
    setSkillsList(updated);
    updateSkillsMutation.mutate(updated);
  };

  const handleCompleteNextSection = (target: string) => {
    if (target === "photo" || target.includes("photo") || target === "documents" || target.includes("resume")) {
      handleSectionChange("overview");
      window.setTimeout(() => {
        if (target.includes("photo")) {
          const photoInput = document.querySelector<HTMLInputElement>('[data-testid="photo-upload-input"]');
          photoInput?.focus();
        } else {
          document.getElementById("overview-resume-panel")?.focus();
        }
      }, 50);
    } else if (target === "experience" || target.includes("experience")) {
      setOpenQualificationSection("experience");
      handleSectionChange("qualifications");
    } else if (target === "education" || target.includes("education")) {
      setOpenQualificationSection("education");
      handleSectionChange("qualifications");
    } else if (target === "skills" || target.includes("skill")) {
      setOpenQualificationSection("skills");
      handleSectionChange("qualifications");
    } else if (target === "trainings" || target.includes("training") || target.includes("cert")) {
      setOpenQualificationSection("trainings");
      handleSectionChange("qualifications");
    } else if (target === "references" || target.includes("reference")) {
      setOpenPersonalSection("references");
      handleSectionChange("personal");
    } else {
      setOpenPersonalSection("basic");
      handleSectionChange("personal");
    }
  };

  const handleReviewResume = () => {
    setReviewError(null);
    setReviewOpen(true);
  };

  const handlePhotoFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Maximum photo upload size is 5 MB." });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if ((file.type && !["image/jpeg", "image/png", "image/jpg"].includes(file.type)) || !["jpg", "jpeg", "png"].includes(ext || "")) {
      setFeedback({ type: "error", message: "Invalid photo format. Only JPG and PNG files up to 5 MB are accepted." });
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    uploadPhotoMutation.mutate(formData);
  };

  const handleResumeFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Maximum resume upload size is 5 MB." });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["pdf", "docx", "doc", "png", "jpg", "jpeg", "webp"];
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];

    const isAllowedExt = ext ? allowedExtensions.includes(ext) : false;
    const isAllowedMime = !file.type || allowedMimeTypes.includes(file.type);

    if (!isAllowedExt || !isAllowedMime) {
      setFeedback({
        type: "error",
        message: "Invalid file format. Please upload a PDF, Word document (.docx), or image (.png, .jpg, .jpeg, .webp) up to 5 MB.",
      });
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    uploadResumeMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Profile"
        description="Keep your profile ready for the next opportunity"
        breadcrumbs={[
          { label: "Applicant Portal", href: "/app" },
          { label: "Profile" },
        ]}
      />

      {feedback && (
        <div
          className={`p-3.5 rounded-md border text-sm font-sans flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#EAF0F7] border-[#0B315D]/30 text-[#0B315D]"
              : "bg-[#FEF2F2] border-[#DC2626]/30 text-[#DC2626]"
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[#627D98] hover:text-[#102A43] font-bold ml-4 cursor-pointer text-base"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      <ProfileSectionNav activeSection={activeSection} onChange={handleSectionChange} />

      <div
        id={`profile-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`profile-tab-${activeSection}`}
        tabIndex={0}
        className="bg-white border border-[#D9E2EC] p-4 sm:p-6 shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2"
      >
          {activeSection === "overview" && (
            <ProfileOverview
              profile={profile}
              user={user}
              candidateInitials={candidateInitials}
              imgError={imgError}
              onImageError={() => setImgError(true)}
              onPhotoFile={handlePhotoFile}
              photoUploadPending={uploadPhotoMutation.isPending}
              onResumeFile={handleResumeFile}
              resumeUploadPending={uploadResumeMutation.isPending}
              pendingResumeCount={reviewProposal ? countActionable(reviewProposal.proposal) : 0}
              onViewPdf={() => {
                if (profile?.resumeUrl) {
                  setPreviewDocState({
                    open: true,
                    documentId: extractDocumentId(profile.resumeUrl),
                    fileUrl: profile.resumeUrl,
                    title: "Resume",
                  });
                }
              }}
              onReviewResume={handleReviewResume}
              onNavigate={handleSectionChange}
              onJumpToSection={handleCompleteNextSection}
              skills={skillsList}
            />
          )}

          {/* TAB 1: PERSONAL INFO */}
          {activeSection === "personal" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Personal Information</h3>
                <p className="text-xs text-slate-500">
                  Ensure contact details and full legal name match your government-issued identification.
                </p>
              </div>

              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  const clientErrors = personalFieldErrorsFor(personalForm);
                  setPersonalFieldErrors(clientErrors);
                  const firstMessage = firstFieldError(clientErrors);
                  if (firstMessage) {
                    const errorSection = Object.keys(clientErrors).map(personalSectionOf).find(Boolean);
                    if (errorSection) setOpenPersonalSection(errorSection);
                    setFeedback({ type: "error", message: "Failed to save personal information: " + firstMessage });
                    return;
                  }
                  updateProfileMutation.mutate({
                    ...personalForm,
                    height: personalForm.height ? parseFloat(personalForm.height) : undefined,
                    weight: personalForm.weight ? parseFloat(personalForm.weight) : undefined,
                  });
                }}
                className="space-y-6"
              >
                <div className="space-y-1.5" role="group" aria-label="Profile completion">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-900">Profile {profileProgress.percent}% complete</span>
                    <span className="text-xs text-slate-600">
                      {profileProgress.filled} of {profileProgress.total} key fields filled
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={profileProgress.percent}
                    aria-label="Profile completion"
                  >
                    <div className="h-full rounded-full bg-navy transition-all" style={{ width: `${profileProgress.percent}%` }} />
                  </div>
                  <p className="text-xs text-slate-600">
                    Fields marked <span className="text-rose-600">*</span> are required. Use Next and Previous to move between sections; nothing is lost.
                  </p>
                </div>
                <ProfileDisclosure
                  id="profile-personal-basic"
                  title="Basic information"
                  summary="Your legal name and personal details"
                  open={openPersonalSection === "basic"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "basic" ? "" : "basic")}
                  {...stepProps("basic")}
                >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input
                      label="First Name"
                      maxLength={100}
                      value={personalForm.firstName}
                      error={personalFieldErrors.firstName}
                      helperText={autoFilledFields.has("firstName") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, firstName: e.target.value }));
                        clearPersonalFieldError("firstName");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("firstName"); return n; });
                      }}
                      required
                    />
                    <Input
                      label="Middle Name"
                      maxLength={100}
                      value={personalForm.middleName}
                      error={personalFieldErrors.middleName}
                      helperText={autoFilledFields.has("middleName") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, middleName: e.target.value }));
                        clearPersonalFieldError("middleName");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("middleName"); return n; });
                      }}
                    />
                    <Input
                      label="Last Name"
                      maxLength={100}
                      value={personalForm.lastName}
                      error={personalFieldErrors.lastName}
                      helperText={autoFilledFields.has("lastName") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, lastName: e.target.value }));
                        clearPersonalFieldError("lastName");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("lastName"); return n; });
                      }}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Date of Birth"
                      type="date"
                      value={personalForm.dateOfBirth}
                      error={personalFieldErrors.dateOfBirth}
                      min={manilaDateYearsAgo(100)}
                      max={manilaDateYearsAgo(18)}
                      helperText={autoFilledFields.has("dateOfBirth") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                        clearPersonalFieldError("dateOfBirth");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("dateOfBirth"); return n; });
                      }}
                    />
                    <Input
                      label="Place of Birth"
                      placeholder="e.g. Quezon City, Rizal"
                      value={personalForm.birthPlace}
                      error={personalFieldErrors.birthPlace}
                      helperText={autoFilledFields.has("birthPlace") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, birthPlace: e.target.value }));
                        clearPersonalFieldError("birthPlace");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("birthPlace"); return n; });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <Select
                      label="Gender"
                      value={personalForm.gender}
                      error={personalFieldErrors.gender}
                      helperText={autoFilledFields.has("gender") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, gender: e.target.value }));
                        clearPersonalFieldError("gender");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("gender"); return n; });
                      }}
                      options={[
                        { value: "", label: "-- Select Gender --" },
                        { value: "Male", label: "Male" },
                        { value: "Female", label: "Female" },
                        { value: "Non-Binary", label: "Non-Binary" },
                        { value: "Prefer not to say", label: "Prefer not to say" },
                      ]}
                    />
                    <Select
                      label="Civil Status"
                      value={personalForm.civilStatus}
                      error={personalFieldErrors.civilStatus}
                      helperText={autoFilledFields.has("civilStatus") ? "✓ Extracted from resume" : undefined}
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, civilStatus: e.target.value }));
                        clearPersonalFieldError("civilStatus");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("civilStatus"); return n; });
                      }}
                      options={[
                        { value: "", label: "-- Select Status --" },
                        { value: "Single", label: "Single" },
                        { value: "Married", label: "Married" },
                        { value: "Widowed", label: "Widowed" },
                        { value: "Separated", label: "Separated" },
                        { value: "Divorced", label: "Divorced" },
                      ]}
                    />
                    <ComboBox
                      label="Nationality"
                      placeholder="Search nationality or select Filipino..."
                      allowCustom={true}
                      options={NATIONALITY_OPTIONS}
                      value={personalForm.nationality}
                      error={personalFieldErrors.nationality}
                      onChange={(val) => {
                        setPersonalForm((prev) => ({ ...prev, nationality: val }));
                        clearPersonalFieldError("nationality");
                        setAutoFilledFields((prev) => {
                          const n = new Set(prev);
                          n.delete("nationality");
                          return n;
                        });
                      }}
                      helperText={autoFilledFields.has("nationality") ? "✓ Extracted from resume" : undefined}
                    />
                    <ComboBox
                      label="Religion"
                      placeholder="Search religion or select Other..."
                      allowCustom={false}
                      options={RELIGION_OPTIONS}
                      value={religionParts.selected}
                      error={personalFieldErrors.religion}
                      helperText={autoFilledFields.has("religion") ? "✓ Extracted from resume" : undefined}
                      onChange={(val) => {
                        setReligionOtherDraft("");
                        setPersonalForm((prev) => ({ ...prev, religion: joinReligion(val, "") }));
                        clearPersonalFieldError("religion");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("religion"); return n; });
                      }}
                    />
                    {religionParts.selected === RELIGION_OTHER && (
                      <Input
                        label="Please specify"
                        placeholder="e.g. Shinto"
                        maxLength={100}
                        value={religionOtherText}
                        onChange={(e) => {
                          setReligionOtherDraft(e.target.value);
                          setPersonalForm((prev) => ({ ...prev, religion: joinReligion(RELIGION_OTHER, e.target.value) }));
                          clearPersonalFieldError("religion");
                          setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("religion"); return n; });
                        }}
                      />
                    )}
                  </div>
                </div>
                </ProfileDisclosure>

                <ProfileDisclosure
                  id="profile-personal-contact"
                  title="Contact and address"
                  summary="How we reach you and where you live"
                  open={openPersonalSection === "contact"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "contact" ? "" : "contact")}
                  {...stepProps("contact")}
                >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <PhoneInput
                      label="Contact Number"
                      value={personalForm.mobileNumber}
                      error={personalFieldErrors.mobileNumber}
                      mobileOnly
                      helperText={autoFilledFields.has("mobileNumber") ? "✓ Extracted from resume" : undefined}
                      onChange={(val) => {
                        setPersonalForm((prev) => ({ ...prev, mobileNumber: val }));
                        clearPersonalFieldError("mobileNumber");
                        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("mobileNumber"); return n; });
                      }}
                      required
                    />
                  </div>
                  <Input
                    label="Complete Residential Address"
                    maxLength={500}
                    placeholder="House/Unit No., Street, Barangay"
                    value={personalForm.address}
                    error={personalFieldErrors.address}
                    helperText={autoFilledFields.has("address") ? "✓ Extracted from resume" : undefined}
                    onChange={(e) => {
                      setPersonalForm((prev) => ({ ...prev, address: e.target.value }));
                      clearPersonalFieldError("address");
                      setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("address"); return n; });
                    }}
                  />
                  <PhilippineAddressFields
                    province={personalForm.province}
                    city={personalForm.city}
                    barangay={personalForm.barangay}
                    postalCode={personalForm.postalCode}
                    onChange={(patch) => {
                      setPersonalForm((previous) => ({ ...previous, ...patch }));
                      Object.keys(patch).forEach((field) => clearPersonalFieldError(field));
                      setAutoFilledFields((previous) => {
                        const next = new Set(previous);
                        Object.keys(patch).forEach((field) => next.delete(field));
                        return next;
                      });
                    }}
                  />
                </div>
                </ProfileDisclosure>

                <ProfileDisclosure
                  id="profile-personal-physical"
                  title="Physical details"
                  summary="Optional height and weight"
                  open={openPersonalSection === "physical"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "physical" ? "" : "physical")}
                  {...stepProps("physical")}
                >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Height (cm)"
                      type="number"
                      min={100}
                      max={250}
                      step="0.1"
                      placeholder="e.g. 170"
                      value={personalForm.height}
                      error={personalFieldErrors.height}
                      helperText={
                        autoFilledFields.has("height")
                          ? "✓ Extracted from resume"
                          : undefined
                      }
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, height: e.target.value }));
                        clearPersonalFieldError("height");
                        setAutoFilledFields((prev) => {
                          const n = new Set(prev);
                          n.delete("height");
                          return n;
                        });
                      }}
                    />
                    <Input
                      label="Weight (kg)"
                      type="number"
                      min={30}
                      max={300}
                      step="0.1"
                      placeholder="e.g. 65"
                      value={personalForm.weight}
                      error={personalFieldErrors.weight}
                      helperText={
                        autoFilledFields.has("weight")
                          ? "✓ Extracted from resume"
                          : undefined
                      }
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, weight: e.target.value }));
                        clearPersonalFieldError("weight");
                        setAutoFilledFields((prev) => {
                          const n = new Set(prev);
                          n.delete("weight");
                          return n;
                        });
                      }}
                    />
                  </div>
                </div>
                </ProfileDisclosure>

                <ProfileDisclosure
                  id="profile-personal-work"
                  title="Work preferences"
                  summary="Where you can work and a short introduction"
                  open={openPersonalSection === "work"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "work" ? "" : "work")}
                  {...stepProps("work")}
                >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                    <ComboBox
                      label="Preferred Work Locations"
                      placeholder="e.g. Laguna, Quezon City, Makati City, Remote"
                      allowCustom={true}
                      options={PREFERRED_WORK_LOCATION_OPTIONS}
                      value={personalForm.preferredWorkLocations}
                      error={personalFieldErrors.preferredWorkLocations}
                      onChange={(val) => {
                        setPersonalForm((prev) => ({
                          ...prev,
                          preferredWorkLocations: val,
                        }));
                        clearPersonalFieldError("preferredWorkLocations");
                      }}
                    />
                  </div>
                  <Textarea
                    label="Professional Summary"
                    rows={3}
                    maxLength={5000}
                    placeholder="Briefly describe your professional background, core expertise, and career objectives..."
                    value={personalForm.professionalSummary}
                    error={personalFieldErrors.professionalSummary}
                    helperText={autoFilledFields.has("professionalSummary") ? "✓ Extracted from resume" : undefined}
                    onChange={(e) => {
                      setPersonalForm((prev) => ({
                        ...prev,
                        professionalSummary: e.target.value,
                      }));
                      clearPersonalFieldError("professionalSummary");
                      setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("professionalSummary"); return n; });
                    }}
                  />
                </div>
                </ProfileDisclosure>

                <ProfileDisclosure
                  id="profile-personal-government"
                  title="Government IDs"
                  summary="Statutory numbers"
                  open={openPersonalSection === "government"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "government" ? "" : "government")}
                  {...stepProps("government")}
                >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Input
                      label="SSS Number"
                      placeholder="01-2345678-9"
                      value={personalForm.sss}
                      error={personalFieldErrors.sss}
                      maxLength={12}
                      inputMode="numeric"
                      helperText="e.g. 01-2345678-9 (10 digits)"
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, sss: formatSSSNumber(e.target.value) }));
                        clearPersonalFieldError("sss");
                      }}
                    />
                    <Input
                      label="PhilHealth Number"
                      placeholder="01-234567890-1"
                      value={personalForm.philhealth}
                      error={personalFieldErrors.philhealth}
                      maxLength={14}
                      inputMode="numeric"
                      helperText="e.g. 01-234567890-1 (12 digits)"
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, philhealth: formatPhilHealthNumber(e.target.value) }));
                        clearPersonalFieldError("philhealth");
                      }}
                    />
                    <Input
                      label="Pag-IBIG / HDMF Number"
                      placeholder="1234-5678-9012"
                      value={personalForm.pagibig}
                      error={personalFieldErrors.pagibig}
                      maxLength={14}
                      inputMode="numeric"
                      helperText="e.g. 1234-5678-9012 (12 digits)"
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, pagibig: formatPagIbigNumber(e.target.value) }));
                        clearPersonalFieldError("pagibig");
                      }}
                    />
                    <Input
                      label="TIN Number"
                      placeholder="123-456-789-000"
                      value={personalForm.tin}
                      error={personalFieldErrors.tin}
                      maxLength={15}
                      inputMode="numeric"
                      helperText="e.g. 123-456-789-000 (9 or 12 digits)"
                      onChange={(e) => {
                        setPersonalForm((prev) => ({ ...prev, tin: formatTINNumber(e.target.value) }));
                        clearPersonalFieldError("tin");
                      }}
                    />
                  </div>
                </div>
                </ProfileDisclosure>

                <ProfileDisclosure
                  id="profile-personal-references"
                  title="References"
                  summary={`${profile?.characterReferences?.length || 0} ${profile?.characterReferences?.length === 1 ? "reference" : "references"}`}
                  open={openPersonalSection === "references"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "references" ? "" : "references")}
                  {...stepProps("references")}
                >
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3 border-b border-[#D9E2EC] pb-3">
                    <p className="text-xs text-[#627D98]">People who can speak to your work, such as a former supervisor.</p>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setEditingRef(null);
                        setRefPhone("");
                        setRefModalOpen(true);
                      }}
                    >
                      Add Reference
                    </Button>
                  </div>

                  {!profile?.characterReferences || profile.characterReferences.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#627D98] bg-[#F7F9FC] border border-dashed border-[#D9E2EC]">
                      No references listed. Click "Add Reference" to record contacts.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#D9E2EC]">
                      {profile.characterReferences.map((r: any) => (
                        <div key={r.id} className="py-4 flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="text-sm font-bold text-[#102A43]">{r.name}</div>
                            <div className="text-xs text-[#102A43] font-medium">
                              {[r.relationship, r.company].filter(Boolean).join(" at ")}
                            </div>
                            <div className="text-[11px] text-[#627D98] font-mono">
                              <span>Phone: {r.phone}</span>
                              {r.email && <span> • Email: {r.email}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${r.name}`}
                              onClick={() => {
                                setEditingRef(r);
                                setRefPhone(r.phone || "");
                                setRefModalOpen(true);
                              }}
                              className="text-[#627D98] hover:text-[#0B315D] hover:bg-[#EAF0F7]"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${r.name}`}
                              onClick={() =>
                                setDeleteTarget({
                                  type: "reference",
                                  id: r.id,
                                  label: r.name,
                                })
                              }
                              className="text-[#DC2626] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </ProfileDisclosure>

                <ProfileDisclosure
                  id="profile-personal-notes"
                  title="Additional notes"
                  summary="Optional accommodations or schedule notes"
                  open={openPersonalSection === "notes"}
                  onToggle={() => setOpenPersonalSection(openPersonalSection === "notes" ? "" : "notes")}
                  {...stepProps("notes")}
                >
                <div className="space-y-3">
                  <Textarea
                    label="Additional Notes / Remarks"
                    rows={2}
                    placeholder="Any special accommodations, schedule constraints, or additional remarks..."
                    value={personalForm.additionalNotes}
                    error={personalFieldErrors.additionalNotes}
                    onChange={(e) => {
                      setPersonalForm((prev) => ({ ...prev, additionalNotes: e.target.value }));
                      clearPersonalFieldError("additionalNotes");
                    }}
                  />
                </div>
                </ProfileDisclosure>

                <div className="flex flex-col-reverse gap-3 pt-4 border-t border-slate-200 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    rightIcon={<ChevronRight className="size-4" aria-hidden="true" />}
                    onClick={() => {
                      handleSectionChange("qualifications");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Next: Experience & Education
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={updateProfileMutation.isPending}
                  >
                    Save Personal Details
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: WORK EXPERIENCE */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-experience"
              title="Work experience"
              summary={`${profile?.workExperiences?.length || 0} ${profile?.workExperiences?.length === 1 ? "role" : "roles"}`}
              open={openQualificationSection === "experience"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "experience" ? "" : "experience")}
            >
              <div className="space-y-5">
                <div className="flex justify-end border-b border-[#D9E2EC] pb-3">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingExp(null);
                    setExpModalOpen(true);
                  }}
                >
                  Add Experience
                </Button>
                </div>

              {!profile?.workExperiences || profile.workExperiences.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#627D98] bg-[#F7F9FC] border border-dashed border-[#D9E2EC]">
                  No work experience entries recorded. Click "Add Experience" to begin.
                </div>
              ) : (
                <div className="divide-y divide-[#D9E2EC]">
                  {profile.workExperiences.map((exp: any) => (
                    <div key={exp.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#102A43]">{exp.roleTitle}</span>
                          {exp.isCurrent && (
                            <span className="px-1.5 py-0.5 bg-[#EAF0F7] border border-[#D9E2EC] text-[#0B315D] text-[10px] font-mono font-bold uppercase rounded">
                              Present
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#102A43] font-medium">
                          {exp.company}
                        </div>
                        <div className="text-[11px] text-[#627D98] font-mono">
                          {formatDate(exp.startDate)} —{" "}
                          {exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : "N/A"}
                        </div>
                        {exp.summary && (
                          <p className="text-xs text-[#627D98] mt-2 leading-relaxed">
                            {exp.summary}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${exp.roleTitle}`}
                          onClick={() => {
                            setEditingExp(exp);
                            setExpModalOpen(true);
                          }}
                          className="text-[#627D98] hover:text-[#0B315D] hover:bg-[#EAF0F7]"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${exp.roleTitle}`}
                          onClick={() =>
                            setDeleteTarget({
                              type: "experience",
                              id: exp.id,
                              label: `${exp.roleTitle} at ${exp.company}`,
                            })
                          }
                          className="text-[#DC2626] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </ProfileDisclosure>
          )}

          {/* TAB 4: EDUCATION */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-education"
              title="Education"
              summary={`${profile?.educations?.length || 0} ${profile?.educations?.length === 1 ? "record" : "records"}`}
              open={openQualificationSection === "education"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "education" ? "" : "education")}
            >
              <div className="space-y-5">
                <div className="flex justify-end border-b border-[#D9E2EC] pb-3">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingEdu(null);
                    setEduModalOpen(true);
                  }}
                >
                  Add Education
                </Button>
                </div>

              {!profile?.educations || profile.educations.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#627D98] bg-[#F7F9FC] border border-dashed border-[#D9E2EC]">
                  No education entries recorded. Click "Add Education" to begin.
                </div>
              ) : (
                <div className="divide-y divide-[#D9E2EC]">
                  {profile.educations.map((edu: any) => (
                    <div key={edu.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="text-sm font-bold text-[#102A43]">{edu.degree}</div>
                        <div className="text-xs text-[#102A43] font-medium">
                          {edu.school}
                        </div>
                        <div className="text-[11px] text-[#627D98] font-mono">
                          {edu.fieldOfStudy && <span>{edu.fieldOfStudy} • </span>}
                          {edu.startDate && <span>From {formatDate(edu.startDate)} </span>}
                          {edu.endDate && <span>to {formatDate(edu.endDate)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${edu.degree}`}
                          onClick={() => {
                            setEditingEdu(edu);
                            setEduModalOpen(true);
                          }}
                          className="text-[#627D98] hover:text-[#0B315D] hover:bg-[#EAF0F7]"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${edu.degree}`}
                          onClick={() =>
                            setDeleteTarget({
                              type: "education",
                              id: edu.id,
                              label: `${edu.degree} from ${edu.school}`,
                            })
                          }
                          className="text-[#DC2626] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </ProfileDisclosure>
          )}

          {/* TAB 5: SKILLS */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-skills"
              title="Skills"
              summary={`${skillsList.length} ${skillsList.length === 1 ? "skill" : "skills"}`}
              open={openQualificationSection === "skills"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "skills" ? "" : "skills")}
            >
              <SkillsSection
                skills={skillsList}
                onAddSkill={handleAddSkill}
                onRemoveSkill={handleRemoveSkill}
                isUpdating={updateSkillsMutation.isPending}
                showHeader={false}
              />
            </ProfileDisclosure>
          )}

          {/* TAB 6: TRAININGS & CERTIFICATIONS */}
          {activeSection === "qualifications" && (
            <ProfileDisclosure
              id="profile-qualification-trainings"
              title="Training & certifications"
              summary={`${profile?.trainings?.length || 0} ${profile?.trainings?.length === 1 ? "record" : "records"}`}
              open={openQualificationSection === "trainings"}
              onToggle={() => setOpenQualificationSection(openQualificationSection === "trainings" ? "" : "trainings")}
            >
              <div className="space-y-5">
                <div className="flex justify-end border-b border-[#D9E2EC] pb-3">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditingTraining(null);
                    setTrainingModalOpen(true);
                  }}
                >
                  Add Training
                </Button>
                </div>

              {!profile?.trainings || profile.trainings.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#627D98] bg-[#F7F9FC] border border-dashed border-[#D9E2EC]">
                  No training records added. Click "Add Training" to record credentials.
                </div>
              ) : (
                <div className="divide-y divide-[#D9E2EC]">
                  {profile.trainings.map((t: any) => (
                    <div key={t.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="text-sm font-bold text-[#102A43]">{t.title}</div>
                        <div className="text-xs text-[#102A43] font-medium">{t.provider}</div>
                        <div className="text-[11px] text-[#627D98] font-mono">
                          {t.completionDate && <span>Completed: {formatDate(t.completionDate)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${t.title}`}
                          onClick={() => {
                            setEditingTraining(t);
                            setTrainingModalOpen(true);
                          }}
                          className="text-[#627D98] hover:text-[#0B315D] hover:bg-[#EAF0F7]"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${t.title}`}
                          onClick={() =>
                            setDeleteTarget({
                              type: "training",
                              id: t.id,
                              label: t.title,
                            })
                          }
                          className="text-[#DC2626] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </ProfileDisclosure>
          )}

          {activeSection === "applications" && <ProfileApplications />}

        </div>

      {/* Add / Edit Experience Modal */}
      <Dialog
        open={expModalOpen}
        onClose={() => {
          setExpModalOpen(false);
          setEditingExp(null);
        }}
        title={editingExp ? "Edit Work Experience" : "Add Work Experience"}
        description={editingExp ? "Update your employment details" : "Record a previous employment role"}
      >
        <form onSubmit={handleSaveExp} className="space-y-4">
          <Input
            label="Job Title / Position"
            name="jobTitle"
            defaultValue={editingExp?.roleTitle || ""}
            maxLength={FIELD_LIMITS.shortText}
            error={expErrors.title}
            onChange={() => clearExpError("title")}
            required
          />
          <Input
            label="Company / Employer Name"
            name="companyName"
            defaultValue={editingExp?.company || ""}
            maxLength={FIELD_LIMITS.shortText}
            error={expErrors.company}
            onChange={() => clearExpError("company")}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              name="startDate"
              defaultValue={editingExp?.startDate ? editingExp.startDate.substring(0, 10) : ""}
              error={expErrors.startDate}
              onChange={() => clearExpError("startDate")}
              max={getManilaToday()}
              required
            />
            <Input
              label="End Date"
              type="date"
              name="endDate"
              defaultValue={editingExp?.endDate ? editingExp.endDate.substring(0, 10) : ""}
              error={expErrors.endDate}
              onChange={() => clearExpError("endDate")}
              max={getManilaToday()}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isCurrent"
              name="isCurrent"
              defaultChecked={Boolean(editingExp?.isCurrent)}
              className="rounded text-[#0B315D] focus:ring-[#0B315D]"
            />
            <label htmlFor="isCurrent" className="text-xs text-[#102A43]">
              I currently work in this position
            </label>
          </div>
          <Textarea
            label="Responsibilities & Duties"
            name="responsibilities"
            defaultValue={editingExp?.summary || ""}
            maxLength={FIELD_LIMITS.notes}
            error={expErrors.description}
            onChange={() => clearExpError("description")}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E2EC]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExpModalOpen(false);
                setEditingExp(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addExpMutation.isPending}>
              {editingExp ? "Save Changes" : "Save Experience"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add / Edit Education Modal */}
      <Dialog
        open={eduModalOpen}
        onClose={() => {
          setEduModalOpen(false);
          setEditingEdu(null);
        }}
        title={editingEdu ? "Edit Educational Background" : "Add Educational Background"}
        description={editingEdu ? "Update your degree or course details" : "Record a degree, diploma, or certificate"}
      >
        <form onSubmit={handleSaveEdu} className="space-y-4">
          <Input
            label="School / Institution Name"
            name="schoolName"
            defaultValue={editingEdu?.school || ""}
            maxLength={FIELD_LIMITS.shortText}
            error={eduErrors.school}
            onChange={() => clearEduError("school")}
            required
          />
          <Input
            label="Degree / Course Level"
            name="degree"
            placeholder="e.g. High School Diploma, BS Nursing"
            defaultValue={editingEdu?.degree || ""}
            maxLength={FIELD_LIMITS.shortText}
            error={eduErrors.degree}
            onChange={() => clearEduError("degree")}
            required
          />
          <Input
            label="Field of Study"
            name="fieldOfStudy"
            placeholder="e.g. General Sciences, Electrical"
            defaultValue={editingEdu?.fieldOfStudy || ""}
            maxLength={FIELD_LIMITS.shortText}
            error={eduErrors.field}
            onChange={() => clearEduError("field")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              name="startDate"
              defaultValue={editingEdu?.startDate ? editingEdu.startDate.substring(0, 10) : ""}
              error={eduErrors.startDate}
              onChange={() => clearEduError("startDate")}
              max={getManilaToday()}
            />
            <Input
              label="End Date"
              type="date"
              name="endDate"
              defaultValue={editingEdu?.endDate ? editingEdu.endDate.substring(0, 10) : ""}
              error={eduErrors.endDate}
              onChange={() => clearEduError("endDate")}
              max="2100-12-31"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E2EC]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEduModalOpen(false);
                setEditingEdu(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addEduMutation.isPending}>
              {editingEdu ? "Save Changes" : "Save Education"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add / Edit Training Modal */}
      <Dialog
        open={trainingModalOpen}
        onClose={() => {
          setTrainingModalOpen(false);
          setEditingTraining(null);
        }}
        title={editingTraining ? "Edit Training or Certification" : "Add Training or Certification"}
        description={editingTraining ? "Update credential records" : "Record industry credentials"}
      >
        <form onSubmit={handleSaveTraining} className="space-y-4">
          <Input
            label="Certificate / Course Title"
            name="title"
            defaultValue={editingTraining?.title || ""}
            maxLength={FIELD_LIMITS.shortText}
            error={trainingErrors.title}
            onChange={() => clearTrainingError("title")}
            required
          />
          <Input
            label="Issuing Organization"
            name="issuer"
            placeholder="e.g. TESDA, Red Cross, DOLE"
            defaultValue={editingTraining?.provider || ""}
            maxLength={FIELD_LIMITS.shortText}
            error={trainingErrors.provider}
            onChange={() => clearTrainingError("provider")}
            required
          />
          <Input
            label="Completion Date"
            type="date"
            name="issueDate"
            defaultValue={editingTraining?.completionDate ? editingTraining.completionDate.substring(0, 10) : ""}
            error={trainingErrors.completionDate}
            onChange={() => clearTrainingError("completionDate")}
            max={getManilaToday()}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E2EC]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTrainingModalOpen(false);
                setEditingTraining(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addTrainingMutation.isPending}>
              {editingTraining ? "Save Changes" : "Save Training"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add / Edit Reference Modal */}
      <Dialog
        open={refModalOpen}
        onClose={() => {
          setRefModalOpen(false);
          setEditingRef(null);
        }}
        title={editingRef ? "Edit Character Reference" : "Add Character Reference"}
        description={editingRef ? "Update contact information" : "Record a professional or personal contact"}
      >
        <form onSubmit={handleSaveRef} className="space-y-4">
          <Input
            label="Contact Full Name"
            name="name"
            defaultValue={editingRef?.name || ""}
            maxLength={FIELD_LIMITS.name}
            error={refErrors.name}
            onChange={() => clearRefError("name")}
            required
          />
          <Input
            label="Relationship / Title"
            name="relationship"
            placeholder="e.g. Former Supervisor"
            defaultValue={editingRef?.relationship || ""}
            maxLength={FIELD_LIMITS.name}
            error={refErrors.relationship}
            onChange={() => clearRefError("relationship")}
            required
          />
          <Input
            label="Company"
            name="company"
            placeholder="e.g. ABC Manufacturing"
            defaultValue={editingRef?.company || ""}
            maxLength={FIELD_LIMITS.name}
            error={refErrors.company}
            onChange={() => clearRefError("company")}
          />
          <PhoneInput
            label="Contact Phone Number"
            value={refPhone}
            error={refErrors.phone}
            onChange={(val) => {
              setRefPhone(val);
              clearRefError("phone");
            }}
            required
          />
          <Input
            label="Email Address"
            type="email"
            name="email"
            defaultValue={editingRef?.email || ""}
            maxLength={FIELD_LIMITS.email}
            error={refErrors.email}
            onChange={() => clearRefError("email")}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E2EC]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefModalOpen(false);
                setEditingRef(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addRefMutation.isPending}>
              {editingRef ? "Save Changes" : "Save Reference"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ResumeReviewDialog
        open={reviewOpen}
        proposal={reviewProposal?.proposal ?? null}
        saving={applyResumeMutation.isPending}
        error={reviewError}
        onSave={(accept) => reviewProposal && applyResumeMutation.mutate({ parseId: reviewProposal.parseId, accept })}
        onClose={() => {
          if (!applyResumeMutation.isPending) setReviewOpen(false);
        }}
      />

      {/* Delete Item Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "experience") deleteExpMutation.mutate(deleteTarget.id);
          if (deleteTarget.type === "education") deleteEduMutation.mutate(deleteTarget.id);
          if (deleteTarget.type === "training") deleteTrainingMutation.mutate(deleteTarget.id);
          if (deleteTarget.type === "reference") deleteRefMutation.mutate(deleteTarget.id);
        }}
        variant="danger"
        title="Delete Qualification Entry"
        description={`Are you sure you want to remove ${deleteTarget?.label || "this record"}? This action cannot be undone.`}
        confirmLabel="Remove Entry"
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        open={Boolean(previewDocState?.open)}
        onClose={() => setPreviewDocState(null)}
        documentId={previewDocState?.documentId}
        fileUrl={previewDocState?.fileUrl}
        title={previewDocState?.title}
      />

      {blocker.status === "blocked" && (
        <ConfirmDialog
          open
          onClose={() => blocker.reset?.()}
          onConfirm={() => blocker.proceed?.()}
          title="Leave without saving?"
          description="Your personal information changes will be lost if you leave this page."
          confirmLabel="Leave without saving"
        />
      )}
    </div>
  );
};
