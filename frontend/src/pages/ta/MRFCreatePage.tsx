import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi, type MRFFileField, type MRFFileReading } from "../../lib/api/ta.api";
import { PageHeader, ConfirmDialog, DateField } from "../../components/common";
import { MRFCreateSummary, MRFStepList, type MRFStep } from "../../components/ta/recruitment/MRFCreateSummary";
import { MRFFileReviewDialog, type MRFFileReviewRow } from "../../components/ta/MRFFileReviewDialog";
import { cn } from "../../lib/utils";
import { Button, Input, Select, Textarea, ComboBox } from "../../components/ui";
import { notify, formatErrorMessage, fieldErrorsFrom } from "../../lib/feedback";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  MRF_EDUCATION_OPTIONS,
  MRF_EXPERIENCE_OPTIONS,
} from "../../lib/hr-constants";
import { TA_COPY } from "../../lib/ta-copy";
import { getManilaToday, salaryTextError, salaryRangeError, SALARY_RANGE_MESSAGE } from "../../lib/field-limits";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../lib/query-policies";
import {
  validateStandardText,
  validateProseText,
} from "../../lib/statutory-validation";
import { parseSkillsArray, formatSkillsList } from "../../lib/mrf-presets";
import { useDirtyGuard } from "../../hooks/useDirtyGuard";
import { CloneMRFModal } from "../../components/ta/CloneMRFModal";
import { FieldWarning } from "../../components/ta/FieldWarning";
import {
  LOCATION_HINT,
  LOCATION_UNCLEAR_WARNING,
  SKILLS_HINT,
  SKILLS_TRAITS_WARNING,
  clientWorkLocation,
  locationLooksUnclear,
  skillsLookLikeTraits,
  useKnownPlaceName,
} from "../../lib/requirement-hints";
import type { ManpowerRequest } from "../../lib/types/ta.types";
import {
  DEPARTMENT_SUGGESTIONS,
  REQUEST_REASONS,
  REQUEST_REASON_LABELS,
  WORK_DAYS,
  WORK_DAYS_LABELS,
  WORK_HOURS,
  WORK_SHIFTS,
  WORK_SHIFT_LABELS,
  formatWorkSchedule,
  matchClientByCompany,
  workHoursLabel,
} from "../../lib/mrf-schedule";

/** Form fields in the order they appear on the page, with the element id used to focus them. */
const FIELD_ORDER: Array<[string, string]> = [
  ["clientId", "mrf-client"],
  ["title", "mrf-title"],
  ["department", "mrf-department"],
  ["headcount", "mrf-headcount"],
  ["location", "mrf-location"],
  ["requestReasonNote", "mrf-reason-note"],
  ["requiredSkills", "mrf-skills"],
  ["requiredCertifications", "mrf-certifications"],
  ["description", "mrf-description"],
  ["ageMin", "mrf-age-min"],
  ["ageMax", "mrf-age-max"],
  ["salaryRangeMin", "mrf-salary-min"],
  ["salaryRangeMax", "mrf-salary-max"],
  ["workTime", "mrf-work-time"],
];

/** Optional fields kept inside the "More details" disclosure. */
const MORE_DETAILS_FIELDS = [
  "requiredExperience",
  "requiredEducation",
  "requiredCertifications",
  "ageMin",
  "ageMax",
  "genderPreference",
  "tattooPolicy",
];

type FileNotes = Partial<Record<MRFFileField, "missing" | "invalid" | "uncertain">>;

const FILE_NOTE_TEXT = {
  uncertain: "Check this — read from the file.",
  invalid: "Couldn't read a valid value. Enter it manually.",
  missing: "Not found in the file.",
} as const;

const MRF_FILE_ACCEPT = "application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";
const MRF_FILE_MAX_BYTES = 5 * 1024 * 1024;

/** Page defaults count as empty: a file may replace them without asking. */
const FIELD_DEFAULTS: Partial<Record<MRFFileField, string>> = {
  headcount: "1",
  priority: "NORMAL",
  employmentType: "Contractual",
  workArrangement: "On-site",
  genderPreference: "ANY",
  tattooPolicy: "ALLOWED",
};

const FIELD_LABELS: Record<MRFFileField, string> = {
  title: "Request title", description: "Description", headcount: "Workers needed", location: "Work site", targetFillDate: "Needed by",
  priority: "Priority", employmentType: "Employment", workArrangement: "Work arrangement", requiredSkills: "Skills",
  requiredExperience: "Experience", requiredEducation: "Education", requiredCertifications: "Certifications and licenses",
  salaryRangeMin: "Minimum monthly pay", salaryRangeMax: "Maximum monthly pay", ageMin: "Minimum age", ageMax: "Maximum age",
  genderPreference: "Gender preference", tattooPolicy: "Tattoo policy",
  department: "Department", workShift: "Shift", workDays: "Work days", workHoursPerDay: "Hours per day",
  workTime: "Work time", requestReason: "Reason for request", requestReasonNote: "Reason",
};

/** "NO_VISIBLE" reads as "No visible". Free text is left alone. */
const readable = (value: string): string =>
  /^[A-Z_]+$/.test(value) ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") : value;

/** How a value reads in the review dialog: schedule and reason codes use the same labels as the form. */
const fileDisplay = (key: MRFFileField, value: string): string => {
  const trimmed = value.trim();
  if (key === "workShift") return WORK_SHIFT_LABELS[trimmed as keyof typeof WORK_SHIFT_LABELS] ?? readable(trimmed);
  if (key === "workDays") return WORK_DAYS_LABELS[trimmed as keyof typeof WORK_DAYS_LABELS] ?? readable(trimmed);
  if (key === "requestReason") return REQUEST_REASON_LABELS[trimmed as keyof typeof REQUEST_REASON_LABELS] ?? readable(trimmed);
  if (key === "workHoursPerDay" && trimmed) return workHoursLabel(Number(trimmed));
  return readable(value);
};

/** An empty first option so a schedule or reason can be left unset. */
const NOT_SET_OPTION = { value: "", label: "Not set" };

const isEmptyField = (key: MRFFileField, values: Record<MRFFileField, string>): boolean => {
  const value = values[key].trim();
  return value === "" || value === FIELD_DEFAULTS[key];
};

type PendingFill = { kind: "clone"; mrf: ManpowerRequest; preserveClient: boolean };

export const MRFCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlSearch = useSearch({ strict: false }) as { clientId?: number | string };
  const presetClientId = Number(urlSearch?.clientId) || 0;
  const presetClientApplied = useRef(false);

  const [clientId, setClientId] = useState<number>(presetClientId);
  const [title, setTitle] = useState("");
  const [headcount, setHeadcount] = useState<number | string>(1);
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [location, setLocation] = useState("");
  const isKnownPlaceName = useKnownPlaceName(Boolean(location.trim()));
  const [targetFillDate, setTargetFillDate] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [requiredExperience, setRequiredExperience] = useState("");
  const [requiredEducation, setRequiredEducation] = useState("");
  const [requiredCertifications, setRequiredCertifications] = useState("");
  const [description, setDescription] = useState("");
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [employmentType, setEmploymentType] = useState("Contractual");
  const [workArrangement, setWorkArrangement] = useState("On-site");
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");
  const [genderPreference, setGenderPreference] = useState<string>("ANY");
  const [tattooPolicy, setTattooPolicy] = useState<string>("ALLOWED");
  const [department, setDepartment] = useState("");
  const [workShift, setWorkShift] = useState("");
  const [workDays, setWorkDays] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [workTime, setWorkTime] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestReasonNote, setRequestReasonNote] = useState("");
  /** Company named on the file when it matched none of the TA's clients. */
  const [unmatchedCompany, setUnmatchedCompany] = useState<string | null>(null);
  const [requiresClientReview, setRequiresClientReview] = useState(true);
  const [clientRequirementsOpen, setClientRequirementsOpen] = useState(false);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [pendingFill, setPendingFill] = useState<PendingFill | null>(null);
  const [fileReview, setFileReview] = useState<{ reading: MRFFileReading; rows: MRFFileReviewRow[]; clientId?: number } | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [fileState, setFileState] = useState<"idle" | "reading" | "filled" | "nothing" | "unreadable" | "too-big">("idle");
  const [fileNotes, setFileNotes] = useState<FileNotes>({});
  const fileReadVersion = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const clearServerFieldError = (field: string) => {
    setFileNotes((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as MRFFileField];
      return next;
    });
    clearServerError(field);
  };
  const clearServerError = (field: string) =>
    setServerFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  // Anything typed beyond the page defaults. A client chosen through ?clientId= is not typed work.
  const hasSpecifications = Boolean(
    title.trim() ||
      requiredSkills.trim() ||
      requiredExperience.trim() ||
      requiredEducation.trim() ||
      requiredCertifications.trim() ||
      description.trim() ||
      salaryMin ||
      salaryMax
  );
  const isDirty =
    createdId === null &&
    (hasSpecifications ||
      clientId !== presetClientId ||
      location.trim() !== "" ||
      targetFillDate !== "" ||
      String(headcount) !== "1" ||
      priority !== "NORMAL" ||
      ageMin !== "" ||
      ageMax !== "" ||
      genderPreference !== "ANY" ||
      tattooPolicy !== "ALLOWED" ||
      [department, workShift, workDays, workHours, workTime, requestReason, requestReasonNote].some((value) => value.trim() !== "") ||
      !requiresClientReview);
  const { discardDialog } = useDirtyGuard({
    isDirty,
    message: "You have unsaved changes in this manpower request.",
  });

  const handleHeadcountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("headcount");
    setHeadcount(e.target.value);
  };

  const handleSalaryMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("salaryRangeMin");
    setSalaryMin(e.target.value);
  };

  const handleSalaryMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("salaryRangeMax");
    setSalaryMax(e.target.value);
  };

  const handleAgeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("ageMin");
    const val = e.target.value;
    if (val === "") {
      setAgeMin("");
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    setAgeMin(val);
  };

  const handleAgeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("ageMax");
    const val = e.target.value;
    if (val === "") {
      setAgeMax("");
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    setAgeMax(val);
  };

  const isSalaryRangeInvalid = Boolean(
    salaryMin && salaryMax && parseFloat(salaryMin) > parseFloat(salaryMax)
  );

  const isAgeRangeInvalid = Boolean(
    ageMin && ageMax && parseInt(ageMin, 10) > parseInt(ageMax, 10)
  );

  /** Show errors on their fields, open the internal-only block if one is inside it, and focus the first. */
  const showFieldErrors = (errors: Record<string, string>) => {
    setServerFieldErrors(errors);
    const first = FIELD_ORDER.find(([key]) => errors[key]);
    if (MORE_DETAILS_FIELDS.some((key) => errors[key])) setMoreDetailsOpen(true);
    if (first && (first[0] === "ageMin" || first[0] === "ageMax")) setClientRequirementsOpen(true);
    if (first) {
      window.setTimeout(() => {
        const el = document.getElementById(first[1]);
        el?.scrollIntoView?.({ block: "center" });
        el?.focus();
      }, 0);
    }
  };

  const createMRFMutation = useMutation({
    mutationFn: taApi.createMRF,
    onSuccess: (newMRF) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
      notify.success("Manpower request created", `Request #${newMRF.id} (${newMRF.title}) is ready.`);
      setCreatedId(newMRF.id);
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      if (Object.keys(fieldErrors).length > 0) {
        showFieldErrors(fieldErrors);
        setValidationError(`Check the highlighted ${Object.keys(fieldErrors).length === 1 ? "field" : "fields"} below.`);
        notify.error("Check the highlighted fields", Object.values(fieldErrors)[0]);
        return;
      }
      const formatted = formatErrorMessage(err);
      setValidationError("Unable to create this manpower request: " + formatted);
      notify.error("Unable to create request", err);
    },
  });

  // The form is clean once the request exists, so the leave guard lets the router go to its page.
  useEffect(() => {
    if (createdId === null) return;
    navigate({
      to: "/ta/mrfs/$mrfId",
      params: { mrfId: String(createdId) },
    });
  }, [createdId, navigate]);

  const clients = clientsQuery.data || [];

  // Latest client choice and list, so a file that finishes reading later never works from stale state.
  const clientIdRef = useRef(clientId);
  clientIdRef.current = clientId;
  const clientsRef = useRef(clients);
  clientsRef.current = clients;

  const handleClientChange = (val: string) => {
    const numericId = Number(val);
    setClientId(numericId);
    setUnmatchedCompany(null);
    clearServerFieldError("clientId");
    if (numericId) {
      const chosenClient = clients.find((c) => c.id === numericId);
      if (chosenClient) {
        // City and province only: a street address can't be matched to where candidates live.
        const workLocation = clientWorkLocation(chosenClient);
        if (workLocation && (!location || location === "Philippines")) {
          setLocation(workLocation);
        }
      }
    }
  };

  // Opened from a client page (?clientId=): fill the client's work site once, as if it was picked by hand.
  useEffect(() => {
    if (!presetClientId || presetClientApplied.current || clients.length === 0) return;
    presetClientApplied.current = true;
    const chosenClient = clients.find((c) => c.id === presetClientId);
    const workLocation = chosenClient ? clientWorkLocation(chosenClient) : "";
    if (workLocation) setLocation((current) => (!current || current === "Philippines" ? workLocation : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, presetClientId]);

  const applyClonedMRF = (mrf: ManpowerRequest, preserveClient: boolean) => {
    setServerFieldErrors({});
    setTitle(mrf.title || "");
    setHeadcount(mrf.headcount || 1);
    if (mrf.priority) {
      setPriority(mrf.priority);
    }
    setRequiresClientReview(mrf.requiresClientReview !== false);
    setRequiredSkills(formatSkillsList(mrf.requiredSkills));
    setRequiredExperience(mrf.requiredExperience || "");
    setRequiredEducation(mrf.requiredEducation || "");
    setRequiredCertifications(
      mrf.requiredCertifications ? formatSkillsList(mrf.requiredCertifications) : ""
    );
    setDescription(mrf.description || "");
    setSalaryMin(mrf.salaryRangeMin != null ? String(mrf.salaryRangeMin) : "");
    setSalaryMax(mrf.salaryRangeMax != null ? String(mrf.salaryRangeMax) : "");
    setEmploymentType(mrf.employmentType || "Contractual");
    setWorkArrangement(mrf.workArrangement || "On-site");
    setAgeMin(mrf.ageMin != null ? String(mrf.ageMin) : "");
    setAgeMax(mrf.ageMax != null ? String(mrf.ageMax) : "");
    setGenderPreference(mrf.genderPreference || "ANY");
    setTattooPolicy(mrf.tattooPolicy || "ALLOWED");
    // The schedule and department usually repeat. The reason is per request, so it is left as it is.
    setDepartment(mrf.department || "");
    setWorkShift(mrf.workShift || "");
    setWorkDays(mrf.workDays || "");
    setWorkHours(mrf.workHoursPerDay != null ? String(mrf.workHoursPerDay) : "");
    setWorkTime(mrf.workTime || "");

    if (!preserveClient) {
      if (mrf.clientId) {
        setClientId(mrf.clientId);
      }
      if (mrf.location) {
        setLocation(mrf.location);
      }
    } else {
      if (!location && mrf.location) {
        setLocation(mrf.location);
      }
    }

    notify.success("Request cloned", `Populated specifications from MRF #${mrf.id} (${mrf.title}).`);
  };

  const handleApplyClonedMRF = (mrf: ManpowerRequest, preserveClient: boolean) => {
    setCloneModalOpen(false);
    if (hasSpecifications) {
      setPendingFill({ kind: "clone", mrf, preserveClient });
      return;
    }
    applyClonedMRF(mrf, preserveClient);
  };

  // Latest typed values, so a file that finishes reading later never works from stale state.
  const currentValues: Record<MRFFileField, string> = {
    title, description, headcount: String(headcount), location, targetFillDate, priority, employmentType, workArrangement,
    requiredSkills, requiredExperience, requiredEducation, requiredCertifications,
    salaryRangeMin: salaryMin, salaryRangeMax: salaryMax, ageMin, ageMax, genderPreference, tattooPolicy,
    department, workShift, workDays, workHoursPerDay: workHours, workTime, requestReason, requestReasonNote,
  };
  const valuesRef = useRef(currentValues);
  valuesRef.current = currentValues;

  const fileSetters: Record<MRFFileField, (value: string) => void> = {
    title: setTitle, description: setDescription, headcount: setHeadcount, location: setLocation,
    targetFillDate: setTargetFillDate, priority: (value) => setPriority(value as typeof priority), employmentType: setEmploymentType, workArrangement: setWorkArrangement,
    requiredSkills: setRequiredSkills, requiredExperience: setRequiredExperience, requiredEducation: setRequiredEducation,
    requiredCertifications: setRequiredCertifications, salaryRangeMin: setSalaryMin, salaryRangeMax: setSalaryMax,
    ageMin: setAgeMin, ageMax: setAgeMax, genderPreference: setGenderPreference, tattooPolicy: setTattooPolicy,
    department: setDepartment, workShift: setWorkShift, workDays: setWorkDays, workHoursPerDay: setWorkHours,
    workTime: setWorkTime, requestReason: setRequestReason, requestReasonNote: setRequestReasonNote,
  };

  const fillTargets = (reading: MRFFileReading) => Object.keys(reading.fields) as MRFFileField[];

  /** What the file found that differs from the form, for the review dialog. Fields the TA already filled with the same value are left out. */
  const fileReviewRows = (reading: MRFFileReading): MRFFileReviewRow[] => {
    const values = valuesRef.current;
    const rows: MRFFileReviewRow[] = [];
    for (const key of fillTargets(reading)) {
      const fileValue = String(reading.fields[key]);
      const empty = isEmptyField(key, values);
      if (!empty && values[key].trim() === fileValue.trim()) continue;
      rows.push({ key, label: FIELD_LABELS[key], fileValue: fileDisplay(key, fileValue), currentValue: empty ? null : fileDisplay(key, values[key]) });
    }
    return rows;
  };

  /** The client named on the file, when it is one of the TA's clients and not already chosen. */
  const clientMatchFor = (reading: MRFFileReading) => {
    const match = matchClientByCompany(clientsRef.current, reading.companyName);
    return match && match.id !== clientIdRef.current ? match : null;
  };

  /** Writes only the chosen fields from a reading into the form. Nothing is saved. */
  const applyFileReading = (reading: MRFFileReading, chosen: Set<MRFFileField>) => {
    const before = valuesRef.current;
    const applied = new Set<MRFFileField>();
    for (const key of fillTargets(reading)) {
      if (!chosen.has(key)) continue;
      fileSetters[key](String(reading.fields[key]));
      applied.add(key);
    }
    const notes: FileNotes = {};
    for (const [key, issue] of Object.entries(reading.issues) as Array<[MRFFileField, "missing" | "invalid" | "uncertain"]>) {
      if (issue === "uncertain" ? applied.has(key) : isEmptyField(key, before)) notes[key] = issue;
    }
    setFileNotes(notes);
    setServerFieldErrors({});
    if (MORE_DETAILS_FIELDS.some((key) => notes[key as MRFFileField])) setMoreDetailsOpen(true);
    if (["ageMin", "ageMax", "genderPreference", "tattooPolicy"].some((key) => notes[key as MRFFileField])) setClientRequirementsOpen(true);
    setFileState(applied.size > 0 || (chosen as Set<string>).has("clientId") ? "filled" : "nothing");
  };

  const readMRFFile = async (file: File) => {
    const version = ++fileReadVersion.current;
    setFileState("reading");
    setFileNotes({});
    try {
      const reading = await taApi.readMRFFile(file);
      if (version !== fileReadVersion.current) return;
      if (reading.status !== "SUCCESS") {
        setFileState("unreadable");
        return;
      }
      // Nothing reaches the form until the TA has reviewed it.
      const rows = fileReviewRows(reading);
      const clientMatch = clientMatchFor(reading);
      if (clientMatch) {
        const current = clientsRef.current.find((c) => c.id === clientIdRef.current);
        rows.unshift({ key: "clientId", label: "Client", fileValue: clientMatch.name, currentValue: current ? current.name : null });
      }
      setUnmatchedCompany(
        reading.companyName && !matchClientByCompany(clientsRef.current, reading.companyName) && !clientIdRef.current ? reading.companyName : null,
      );
      if (rows.length === 0) {
        applyFileReading(reading, new Set());
        return;
      }
      setFileState("idle");
      setFileReview({ reading, rows, clientId: clientMatch?.id });
    } catch {
      // Includes "too many reads right now". The TA can type the details; creating the request still works.
      if (version === fileReadVersion.current) setFileState("unreadable");
    }
  };

  const handleMRFFileChange = (file: File | null) => {
    fileReadVersion.current += 1;
    if (!file) {
      setFileState("idle");
      return;
    }
    if (file.size > MRF_FILE_MAX_BYTES) {
      setFileState("too-big");
      return;
    }
    void readMRFFile(file);
  };

  const confirmPendingFill = () => {
    if (!pendingFill) return;
    applyClonedMRF(pendingFill.mrf, pendingFill.preserveClient);
    setPendingFill(null);
  };

  const cancelPendingFill = () => setPendingFill(null);

  const activeSkillsList = useMemo(
    () => parseSkillsArray(requiredSkills),
    [requiredSkills]
  );

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = activeSkillsList.filter((s) => s.toLowerCase() !== skillToRemove.toLowerCase());
    setRequiredSkills(updated.join(", "));
  };

  const validate = (): { errors: Record<string, string>; parsedHeadcount: number } => {
    const errors: Record<string, string> = {};

    if (!clientId) errors.clientId = "Choose the client for this request.";

    if (!title.trim()) errors.title = "Enter a request title.";
    else {
      const titleErr = validateStandardText(title, "Request title", { maxLength: 200 });
      if (titleErr) errors.title = titleErr;
    }

    if (location.trim()) {
      const locErr = validateStandardText(location, "Location", { maxLength: 200 });
      if (locErr) errors.location = locErr;
    }

    if (requiredSkills.trim()) {
      const skillsErr = validateProseText(requiredSkills, "Required skills", { maxLength: 2000 });
      if (skillsErr) errors.requiredSkills = skillsErr;
    }

    for (const [key, value, label] of [
      ["department", department, "Department"],
      ["workTime", workTime, "Work time"],
      ["requestReasonNote", requestReasonNote, "Reason"],
    ] as const) {
      if (value.trim()) {
        const problem = validateStandardText(value, label, { maxLength: 200 });
        if (problem) errors[key] = problem;
      }
    }

    if (!description.trim()) errors.description = "Describe the role and its responsibilities.";
    else {
      const descErr = validateProseText(description, "Job description and responsibilities", { maxLength: 10000 });
      if (descErr) errors.description = descErr;
    }

    if (requiredCertifications.trim()) {
      const certErr = validateProseText(requiredCertifications, "Required certifications", { maxLength: 2000 });
      if (certErr) errors.requiredCertifications = certErr;
    }

    const parsedHeadcount = Number(headcount);
    if (
      headcount === "" ||
      isNaN(parsedHeadcount) ||
      !Number.isInteger(parsedHeadcount) ||
      parsedHeadcount < 1 ||
      parsedHeadcount > 1000
    ) {
      errors.headcount = "Enter a whole number from 1 to 1,000.";
    }

    const minSalaryProblem = salaryTextError(salaryMin);
    const maxSalaryProblem = salaryTextError(salaryMax);
    if (minSalaryProblem) errors.salaryRangeMin = minSalaryProblem;
    if (maxSalaryProblem) errors.salaryRangeMax = maxSalaryProblem;
    if (!minSalaryProblem && !maxSalaryProblem) {
      const rangeProblem = salaryRangeError(salaryMin, salaryMax);
      if (rangeProblem) errors.salaryRangeMax = rangeProblem;
    }

    if (ageMin !== "") {
      const min = parseInt(ageMin, 10);
      if (isNaN(min) || min < 18 || min > 65) errors.ageMin = "Minimum age must be a whole number from 18 to 65.";
    }

    if (ageMax !== "") {
      const max = parseInt(ageMax, 10);
      if (isNaN(max) || max < 18 || max > 65) errors.ageMax = "Maximum age must be a whole number from 18 to 65.";
    }

    if (!errors.ageMin && !errors.ageMax && ageMin && ageMax && parseInt(ageMin, 10) > parseInt(ageMax, 10)) {
      errors.ageMax = "Minimum age cannot exceed maximum age.";
    }

    return { errors, parsedHeadcount };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { errors, parsedHeadcount } = validate();
    const count = Object.keys(errors).length;
    if (count > 0) {
      showFieldErrors(errors);
      setValidationError(`Check the ${count === 1 ? "highlighted field" : `${count} highlighted fields`} below.`);
      return;
    }

    setValidationError(null);
    createMRFMutation.mutate({
      clientId,
      title: title.trim(),
      headcount: parsedHeadcount,
      priority,
      location: location || undefined,
      targetFillDate: targetFillDate || undefined,
      requiredSkills: requiredSkills || undefined,
      requiredExperience: requiredExperience || undefined,
      requiredEducation: requiredEducation || undefined,
      requiredCertifications: requiredCertifications || undefined,
      description: description.trim(),
      salaryRangeMin: salaryMin ? Number(salaryMin) : undefined,
      salaryRangeMax: salaryMax ? Number(salaryMax) : undefined,
      employmentType,
      workArrangement,
      ageMin: ageMin ? parseInt(ageMin, 10) : null,
      ageMax: ageMax ? parseInt(ageMax, 10) : null,
      genderPreference: genderPreference || "ANY",
      tattooPolicy: tattooPolicy || "ALLOWED",
      // Empty paper-form fields are left out, so the request body only carries what was filled in.
      department: department.trim() || undefined,
      workShift: workShift || undefined,
      workDays: workDays || undefined,
      workHoursPerDay: workHours ? Number(workHours) : undefined,
      workTime: workTime.trim() || undefined,
      requestReason: requestReason || undefined,
      requestReasonNote: requestReasonNote.trim() || undefined,
      requiresClientReview,
    });
  };

  // Leaving while the form is dirty is caught by the leave guard, which asks before discarding.
  const handleCancel = () => navigate({ to: "/ta/mrfs" });

  const clientOptions = clients.map((c) => ({
    value: String(c.id),
    label: c.tradeName ? `${c.name} (${c.tradeName})` : c.name,
    subtitle: `${c.industry || "General industry"} • ${[c.city, c.province].filter(Boolean).join(", ") || c.address || "Philippines"}`,
  }));

  const selectedClient = clients.find((c) => c.id === clientId);
  const steps: MRFStep[] = [
    { id: "mrf-step-role", label: "Client & role", done: Boolean(clientId && title.trim() && Number(headcount) >= 1) },
    { id: "mrf-step-requirements", label: "Requirements", done: Boolean(description.trim()) },
    { id: "mrf-step-terms", label: "Terms", done: Boolean(employmentType && workArrangement && (salaryMin || salaryMax)) },
    { id: "mrf-step-review", label: "Review", done: false },
  ];
  const summaryValues = {
    clientName: selectedClient?.name,
    title,
    headcount,
    priority,
    targetFillDate,
    location,
    employmentType,
    workArrangement,
    salaryMin,
    salaryMax,
    skillCount: activeSkillsList.length,
    department,
    workSchedule: formatWorkSchedule({ workShift, workDays, workHoursPerDay: workHours ? Number(workHours) : null, workTime }) ?? undefined,
  };

  const fileNote = (field: MRFFileField) => {
    const issue = fileNotes[field];
    // One note is enough when no salary was found.
    if (field === "salaryRangeMax" && issue === "missing" && fileNotes.salaryRangeMin === "missing") return null;
    return <FieldWarning show={Boolean(issue)}>{issue ? FILE_NOTE_TEXT[issue] : null}</FieldWarning>;
  };

  const sectionClass = "scroll-mt-24 space-y-4 rounded-md border border-slate-300 bg-white p-4 sm:p-5";
  const sectionTitleClass = "text-lg font-semibold text-slate-950";

  return (
    <div className="space-y-6">
      <PageHeader
        flush
        title={TA_COPY.pageTitles.createManpowerRequest}
        description="Tell us how many workers the client needs and when they are needed."
        breadcrumbs={[
          { label: TA_COPY.breadcrumbRoot, href: "/ta" },
          { label: TA_COPY.navigation.manpowerRequests, href: "/ta/mrfs" },
          { label: "Create" },
        ]}
      />

      {validationError && (
        <div className="flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert" aria-live="assertive">
          <span>{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            aria-label="Dismiss error"
            className="ml-4 inline-flex min-h-11 min-w-11 items-center justify-center font-bold text-slate-600 hover:text-slate-900 focus-ring"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)_18rem]">
        <MRFStepList steps={steps} className="hidden self-start lg:sticky lg:top-4 lg:block" />

        <form id="mrf-create-form" noValidate onSubmit={handleSubmit} className="min-w-0 space-y-5">
          {/* Step 1: client and role */}
          <section id="mrf-step-role" aria-labelledby="mrf-step-role-title" className={sectionClass}>
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center">
              <h2 id="mrf-step-role-title" className={sectionTitleClass}>Client and role</h2>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCloneModalOpen(true)}
                  className="shrink-0"
                >
                  Clone from past MRF
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="mrf-file" className="block text-xs font-medium text-slate-600">
                Fill from MRF file (optional)
              </label>
              <input
                ref={fileInputRef}
                id="mrf-file"
                type="file"
                accept={MRF_FILE_ACCEPT}
                aria-describedby="mrf-file-help"
                aria-busy={fileState === "reading"}
                onChange={(e) => handleMRFFileChange(e.target.files?.[0] ?? null)}
                className="block w-full min-h-11 md:min-h-10 rounded-md border border-slate-300 bg-white text-sm text-slate-900 transition-colors hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 file:mr-3 file:h-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800"
              />
              <p id="mrf-file-help" role="status" className="text-xs text-slate-600">
                {fileState === "reading" && (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Reading the file…
                  </span>
                )}
                {fileState === "filled" && "Filled from the file. Check every field before creating the request."}
                {fileState === "nothing" && "Nothing new to fill in."}
                {fileState === "unreadable" && "Couldn't read this file. Enter the details manually."}
                {fileState === "too-big" && "The file is over 5 MB. Use a smaller file."}
                {fileState === "idle" && "PDF, Word file or photo. You review what it found before anything is filled in."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <ComboBox
                  id="mrf-client"
                  label="Client"
                  placeholder="Search or select client account..."
                  value={clientId ? String(clientId) : ""}
                  error={serverFieldErrors.clientId}
                  onChange={handleClientChange}
                  options={clientOptions}
                  emptyText="No client accounts match your search"
                  required
                />
                {unmatchedCompany && !clientId && (
                  <p className="text-xs text-slate-600">The form names {unmatchedCompany}, which isn't one of your clients.</p>
                )}
              </div>
              <div className="space-y-1.5">
              <Input
                id="mrf-title"
                label="Request title"
                placeholder="e.g. 50x Forklift Operators - Warehouse Expansion"
                value={title}
                error={serverFieldErrors.title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearServerFieldError("title");
                }}
                required
              />
                {fileNote("title")}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <ComboBox
                  id="mrf-department"
                  label="Department"
                  placeholder="Select or type a department"
                  value={department}
                  error={serverFieldErrors.department}
                  onChange={(val) => {
                    setDepartment(val || "");
                    clearServerFieldError("department");
                  }}
                  options={DEPARTMENT_SUGGESTIONS.map((d) => ({ value: d, label: d }))}
                  allowCustom
                />
                {fileNote("department")}
              </div>
              <div className="space-y-1.5">
                <Select
                  label="Reason for request"
                  value={requestReason}
                  error={serverFieldErrors.requestReason}
                  onChange={(e) => {
                    setRequestReason(e.target.value);
                    clearServerFieldError("requestReason");
                  }}
                  options={[NOT_SET_OPTION, ...REQUEST_REASONS.map((r) => ({ value: r, label: REQUEST_REASON_LABELS[r] }))]}
                />
                {fileNote("requestReason")}
              </div>
            </div>

            {(requestReason || requestReasonNote) && (
              <div className="space-y-1.5">
                <Input
                  id="mrf-reason-note"
                  label="Reason (internal only)"
                  placeholder={requestReason === "REPLACEMENT" ? "e.g. 2 operators resigned" : "e.g. New production line"}
                  value={requestReasonNote}
                  error={serverFieldErrors.requestReasonNote}
                  onChange={(e) => {
                    setRequestReasonNote(e.target.value);
                    clearServerFieldError("requestReasonNote");
                  }}
                />
                {fileNote("requestReasonNote")}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
              <Input
                id="mrf-headcount"
                label="Number of workers needed"
                type="number"
                min={1}
                max={1000}
                value={headcount}
                error={serverFieldErrors.headcount}
                onChange={handleHeadcountChange}
                required
              />
                {fileNote("headcount")}
              </div>
              <Select
                label="Priority"
                value={priority}
                error={serverFieldErrors.priority}
                onChange={(e) => {
                  setPriority(e.target.value as any);
                  clearServerFieldError("priority");
                }}
                options={[
                  { value: "LOW", label: "Low" },
                  { value: "NORMAL", label: "Normal" },
                  { value: "HIGH", label: "High" },
                  { value: "URGENT", label: "Urgent (critical need)" },
                ]}
              />
              <div className="space-y-1.5">
              <DateField
                label="Target fill date"
                min={getManilaToday()}
                value={targetFillDate}
                error={serverFieldErrors.targetFillDate}
                onChange={(e) => {
                  setTargetFillDate(e.target.value);
                  clearServerFieldError("targetFillDate");
                }}
              />
                {fileNote("targetFillDate")}
              </div>
            </div>

            <div className="space-y-1">
              <Input
                id="mrf-location"
                label="Work site"
                placeholder="e.g. Calamba, Laguna"
                helperText={LOCATION_HINT}
                value={location}
                error={serverFieldErrors.location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  clearServerFieldError("location");
                }}
              />
              <FieldWarning show={locationLooksUnclear(location, isKnownPlaceName)}>{LOCATION_UNCLEAR_WARNING}</FieldWarning>
              {fileNote("location")}
            </div>

            <div className="flex items-start gap-3">
              <input
                id="mrf-requires-client-review"
                type="checkbox"
                checked={requiresClientReview}
                onChange={(e) => setRequiresClientReview(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-slate-400 text-navy focus-ring"
              />
              <label htmlFor="mrf-requires-client-review" className="min-w-0 text-sm text-slate-900">
                <span className="font-medium">Requires client review</span>
                <span className="block text-xs text-slate-600">
                  Turn this off when the client does not review candidates, such as MEGS itself. Candidates then go from screening straight to the final interview.
                </span>
              </label>
            </div>
          </section>

          {/* Step 2: skills and qualifications */}
          <section id="mrf-step-requirements" aria-labelledby="mrf-step-requirements-title" className={sectionClass}>
            <h2 id="mrf-step-requirements-title" className={cn(sectionTitleClass, "border-b border-slate-200 pb-3")}>
              Skills and qualifications
            </h2>

            <div className="space-y-1.5">
              <Input
                id="mrf-skills"
                label="Required skills"
                placeholder="e.g. Forklift Operation, Heavy Machinery, Safety Certified"
                helperText={SKILLS_HINT}
                value={requiredSkills}
                error={serverFieldErrors.requiredSkills}
                onChange={(e) => {
                  setRequiredSkills(e.target.value);
                  clearServerFieldError("requiredSkills");
                }}
              />
              <FieldWarning show={skillsLookLikeTraits(requiredSkills)}>{SKILLS_TRAITS_WARNING}</FieldWarning>
              {fileNote("requiredSkills")}
              {activeSkillsList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-xs text-slate-600">
                    Skills ({activeSkillsList.length}):
                  </span>
                  {activeSkillsList.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 py-0.5 pl-2 text-xs text-slate-700"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="inline-flex min-h-11 min-w-8 cursor-pointer items-center justify-center text-sm leading-none text-slate-600 hover:text-rose-700 focus-ring md:min-h-6"
                        aria-label={`Remove skill ${skill}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Textarea
                id="mrf-description"
                label="Job description and responsibilities"
                required
                placeholder="Describe role responsibilities..."
                value={description}
                error={serverFieldErrors.description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearServerFieldError("description");
                }}
                rows={5}
                maxLength={10000}
              />
              {fileNote("description")}
            </div>

            <details
              className="group/more border-t border-slate-200 pt-4"
              open={moreDetailsOpen}
              onToggle={(e) => setMoreDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-900 focus-ring md:min-h-0 [&::-webkit-details-marker]:hidden">
                <span>More details</span>
                <span className="text-sm font-medium text-navy group-open/more:hidden">Show</span>
                <span className="hidden text-sm font-medium text-navy group-open/more:inline">Hide</span>
              </summary>
              <div className="mt-3 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
              <ComboBox
                label="Required experience"
                placeholder="Select or specify required experience"
                value={requiredExperience}
                error={serverFieldErrors.requiredExperience}
                onChange={(val) => {
                  setRequiredExperience(val || "");
                  clearServerFieldError("requiredExperience");
                }}
                options={MRF_EXPERIENCE_OPTIONS.map((e) => ({ value: e, label: e }))}
                allowCustom
              />
                {fileNote("requiredExperience")}
              </div>
              <div className="space-y-1.5">
              <ComboBox
                label="Minimum education"
                placeholder="Select minimum education"
                value={requiredEducation}
                error={serverFieldErrors.requiredEducation}
                onChange={(val) => {
                  setRequiredEducation(val || "");
                  clearServerFieldError("requiredEducation");
                }}
                options={MRF_EDUCATION_OPTIONS.map((ed) => ({ value: ed, label: ed }))}
                allowCustom
              />
                {fileNote("requiredEducation")}
              </div>
            </div>

            <div className="space-y-1.5">
            <Input
              id="mrf-certifications"
              label="Required certifications & licenses"
              placeholder="e.g. Professional Driver's License (Code 2/3), TESDA NC II Automotive Servicing, PRC License"
              value={requiredCertifications}
              error={serverFieldErrors.requiredCertifications}
              onChange={(e) => {
                setRequiredCertifications(e.target.value);
                clearServerFieldError("requiredCertifications");
              }}
            />
              {fileNote("requiredCertifications")}
            </div>

            {/* Internal-only client requirements */}
            <details
              className="group/client border-t border-slate-200 pt-4"
              open={clientRequirementsOpen}
              onToggle={(e) => setClientRequirementsOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-900 focus-ring md:min-h-0 [&::-webkit-details-marker]:hidden">
                <span>Client requirements (internal only)</span>
                <span className="text-sm font-medium text-navy group-open/client:hidden">Show</span>
                <span className="hidden text-sm font-medium text-navy group-open/client:inline">Hide</span>
              </summary>
              <div className="mt-3 space-y-4">
                <p className="text-sm text-slate-600">These preferences are for your team only and are never shown on job postings.</p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                  <Input
                    id="mrf-age-min"
                    label="Minimum age"
                    type="number"
                    min={18}
                    max={65}
                    placeholder="e.g. 21"
                    value={ageMin}
                    error={serverFieldErrors.ageMin}
                    onChange={handleAgeMinChange}
                    helperText="Must be between 18 and 65"
                  />
                    {fileNote("ageMin")}
                  </div>
                  <div className="space-y-1.5">
                  <Input
                    id="mrf-age-max"
                    label="Maximum age"
                    type="number"
                    min={18}
                    max={65}
                    placeholder="e.g. 45"
                    value={ageMax}
                    onChange={handleAgeMaxChange}
                    error={serverFieldErrors.ageMax || (isAgeRangeInvalid ? "Maximum age cannot be less than minimum age" : undefined)}
                    helperText="Must be between 18 and 65"
                  />
                    {fileNote("ageMax")}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                  <Select
                    label="Gender preference"
                    value={genderPreference}
                    error={serverFieldErrors.genderPreference}
                    onChange={(e) => {
                      setGenderPreference(e.target.value);
                      clearServerFieldError("genderPreference");
                    }}
                    options={[
                      { value: "ANY", label: "Any / No preference" },
                      { value: "MALE", label: "Male preferred" },
                      { value: "FEMALE", label: "Female preferred" },
                    ]}
                  />
                    {fileNote("genderPreference")}
                  </div>
                  <div className="space-y-1.5">
                  <Select
                    label="Tattoo visibility policy"
                    value={tattooPolicy}
                    error={serverFieldErrors.tattooPolicy}
                    onChange={(e) => {
                      setTattooPolicy(e.target.value);
                      clearServerFieldError("tattooPolicy");
                    }}
                    options={[
                      { value: "ALLOWED", label: "No restrictions / Allowed" },
                      { value: "NO_VISIBLE", label: "No visible tattoos" },
                      { value: "NONE", label: "No tattoos permitted" },
                    ]}
                  />
                    {fileNote("tattooPolicy")}
                  </div>
                </div>
              </div>
            </details>
              </div>
            </details>
          </section>

          {/* Step 3: terms */}
          <section id="mrf-step-terms" aria-labelledby="mrf-step-terms-title" className={sectionClass}>
            <h2 id="mrf-step-terms-title" className={cn(sectionTitleClass, "border-b border-slate-200 pb-3")}>
              Terms
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
              <ComboBox
                label="Employment type"
                placeholder="Select employment type"
                value={employmentType}
                error={serverFieldErrors.employmentType}
                onChange={(val) => {
                  setEmploymentType(val || "Contractual");
                  clearServerFieldError("employmentType");
                }}
                options={EMPLOYMENT_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
                allowCustom
                required
              />
                {fileNote("employmentType")}
              </div>
              <div className="space-y-1.5">
              <ComboBox
                label="Work arrangement"
                placeholder="Select arrangement"
                value={workArrangement}
                error={serverFieldErrors.workArrangement}
                onChange={(val) => {
                  setWorkArrangement(val || "On-site");
                  clearServerFieldError("workArrangement");
                }}
                options={WORK_ARRANGEMENT_OPTIONS.map((w) => ({ value: w, label: w }))}
                allowCustom
                required
              />
                {fileNote("workArrangement")}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
              <Input
                id="mrf-salary-min"
                label="Minimum monthly salary (PHP)"
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                placeholder="e.g. 18000"
                value={salaryMin}
                error={serverFieldErrors.salaryRangeMin}
                onChange={handleSalaryMinChange}
              />
                {fileNote("salaryRangeMin")}
              </div>
              <div className="space-y-1.5">
              <Input
                id="mrf-salary-max"
                label="Maximum monthly salary (PHP)"
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                placeholder="e.g. 25000"
                value={salaryMax}
                onChange={handleSalaryMaxChange}
                error={serverFieldErrors.salaryRangeMax || (isSalaryRangeInvalid ? SALARY_RANGE_MESSAGE : undefined)}
              />
                {fileNote("salaryRangeMax")}
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Work schedule</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Select
                    label="Shift"
                    value={workShift}
                    onChange={(e) => {
                      setWorkShift(e.target.value);
                      clearServerFieldError("workShift");
                    }}
                    options={[NOT_SET_OPTION, ...WORK_SHIFTS.map((s) => ({ value: s, label: WORK_SHIFT_LABELS[s] }))]}
                  />
                  {fileNote("workShift")}
                </div>
                <div className="space-y-1.5">
                  <Select
                    label="Work days"
                    value={workDays}
                    onChange={(e) => {
                      setWorkDays(e.target.value);
                      clearServerFieldError("workDays");
                    }}
                    options={[NOT_SET_OPTION, ...WORK_DAYS.map((d) => ({ value: d, label: WORK_DAYS_LABELS[d] }))]}
                  />
                  {fileNote("workDays")}
                </div>
                <div className="space-y-1.5">
                  <Select
                    label="Hours per day"
                    value={workHours}
                    onChange={(e) => {
                      setWorkHours(e.target.value);
                      clearServerFieldError("workHoursPerDay");
                    }}
                    options={[NOT_SET_OPTION, ...WORK_HOURS.map((h) => ({ value: String(h), label: workHoursLabel(h) }))]}
                  />
                  {fileNote("workHoursPerDay")}
                </div>
              </div>
              <div className="space-y-1.5">
                <Input
                  id="mrf-work-time"
                  label="Time (optional)"
                  placeholder="e.g. 7:00 AM - 4:00 PM"
                  value={workTime}
                  error={serverFieldErrors.workTime}
                  onChange={(e) => {
                    setWorkTime(e.target.value);
                    clearServerFieldError("workTime");
                  }}
                />
                {fileNote("workTime")}
              </div>
            </div>
          </section>

          {/* Step 4: review. At 1280px and wider the same summary sits beside the form. */}
          <section id="mrf-step-review" aria-labelledby="mrf-step-review-title" className={cn(sectionClass, "xl:hidden")}>
            <h2 id="mrf-step-review-title" className={cn(sectionTitleClass, "border-b border-slate-200 pb-3")}>
              Review
            </h2>
            <MRFCreateSummary values={summaryValues} className="grid grid-cols-2 gap-x-4 sm:grid-cols-3 [&>div]:min-w-0" />
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse justify-end gap-2 border-t border-slate-300 bg-white px-4 py-3 sm:mx-0 sm:flex-row sm:rounded-md sm:border">
            <Button variant="outline" size="sm" type="button" onClick={handleCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={createMRFMutation.isPending}
              className="w-full sm:w-auto"
            >
              Create request
            </Button>
          </div>
        </form>

        <aside aria-label="Request summary" className="hidden self-start xl:sticky xl:top-4 xl:block">
          <div className="rounded-md border border-slate-300 bg-white p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-950">Request summary</h2>
            <MRFCreateSummary values={summaryValues} />
          </div>
        </aside>
      </div>

      <CloneMRFModal
        open={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        onSelectMRF={handleApplyClonedMRF}
        currentClientId={clientId || undefined}
        currentClientName={selectedClient?.name}
      />

      {fileReview && (
        <MRFFileReviewDialog
          rows={fileReview.rows}
          onClose={() => {
            setFileReview(null);
            // Clear the picker so choosing the same file again opens the review again.
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onFill={(keys) => {
            if (keys.has("clientId") && fileReview.clientId) handleClientChange(String(fileReview.clientId));
            applyFileReading(fileReview.reading, keys as Set<MRFFileField>);
            setFileReview(null);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingFill !== null}
        onClose={cancelPendingFill}
        onConfirm={confirmPendingFill}
        title="Replace what you have filled in?"
        description="This overwrites the title, skills, salary and notes you have entered with the specifications from the past request."
        confirmLabel="Replace fields"
        cancelLabel="Keep my entries"
        variant="warning"
      />

      {discardDialog}
    </div>
  );
};
