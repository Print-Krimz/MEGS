import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { PageHeader, ConfirmDialog } from "../../components/common";
import { Button, Input, Select, Textarea, ComboBox } from "../../components/ui";
import { notify, formatErrorMessage, fieldErrorsFrom } from "../../lib/feedback";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  MRF_EDUCATION_OPTIONS,
  MRF_EXPERIENCE_OPTIONS,
} from "../../lib/hr-constants";
import { TA_COPY } from "../../lib/ta-copy";
import { getManilaToday } from "../../lib/field-limits";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../lib/query-policies";
import {
  validateStandardText,
  validateProseText,
} from "../../lib/statutory-validation";
import {
  getMRFPresetById,
  getPresetsByIndustry,
  parseSkillsArray,
  formatSkillsList,
} from "../../lib/mrf-presets";
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
} from "../../lib/requirement-hints";
import type { ManpowerRequest } from "../../lib/types/ta.types";

/** Form fields in the order they appear on the page, with the element id used to focus them. */
const FIELD_ORDER: Array<[string, string]> = [
  ["clientId", "mrf-client"],
  ["title", "mrf-title"],
  ["headcount", "mrf-headcount"],
  ["location", "mrf-location"],
  ["salaryRangeMin", "mrf-salary-min"],
  ["salaryRangeMax", "mrf-salary-max"],
  ["requiredSkills", "mrf-skills"],
  ["requiredCertifications", "mrf-certifications"],
  ["description", "mrf-notes"],
  ["ageMin", "mrf-age-min"],
  ["ageMax", "mrf-age-max"],
];

type PendingFill =
  | { kind: "preset"; presetId: string }
  | { kind: "clone"; mrf: ManpowerRequest; preserveClient: boolean };

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
  const [clientRequirementsOpen, setClientRequirementsOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [pendingFill, setPendingFill] = useState<PendingFill | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const presetsByIndustry = useMemo(() => getPresetsByIndustry(), []);

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const clearServerFieldError = (field: string) =>
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
      tattooPolicy !== "ALLOWED");
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

  const handleClientChange = (val: string) => {
    const numericId = Number(val);
    setClientId(numericId);
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

  const applyPreset = (presetId: string) => {
    const preset = getMRFPresetById(presetId);
    if (!preset) return;

    setServerFieldErrors({});
    setTitle(preset.title);
    setRequiredSkills(formatSkillsList(preset.requiredSkills));
    setRequiredExperience(preset.requiredExperience);
    setRequiredEducation(preset.requiredEducation);
    setRequiredCertifications(formatSkillsList(preset.requiredCertifications));
    setDescription(preset.description);
    setSalaryMin(String(preset.salaryMin));
    setSalaryMax(String(preset.salaryMax));
    setEmploymentType(preset.employmentType);
    setWorkArrangement(preset.workArrangement);

    notify.success("Template applied", `Loaded "${preset.label}" specifications.`);
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;
    if (hasSpecifications) {
      setPendingFill({ kind: "preset", presetId });
      return;
    }
    applyPreset(presetId);
  };

  const applyClonedMRF = (mrf: ManpowerRequest, preserveClient: boolean) => {
    setServerFieldErrors({});
    setTitle(mrf.title || "");
    setHeadcount(mrf.headcount || 1);
    if (mrf.priority) {
      setPriority(mrf.priority);
    }
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

    setSelectedPresetId("");
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

  const confirmPendingFill = () => {
    if (!pendingFill) return;
    if (pendingFill.kind === "preset") applyPreset(pendingFill.presetId);
    else applyClonedMRF(pendingFill.mrf, pendingFill.preserveClient);
    setPendingFill(null);
  };

  const cancelPendingFill = () => {
    // Put the template picker back where it was; nothing was replaced.
    if (pendingFill?.kind === "preset") setSelectedPresetId("");
    setPendingFill(null);
  };

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

    if (description.trim()) {
      const descErr = validateProseText(description, "Job description", { maxLength: 10000 });
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

    if (salaryMin !== "") {
      const min = parseFloat(salaryMin);
      if (isNaN(min) || min < 0 || min > 1000000) errors.salaryRangeMin = "Minimum monthly salary must be between 0 and 1,000,000 PHP.";
    }

    if (salaryMax !== "") {
      const max = parseFloat(salaryMax);
      if (isNaN(max) || max < 0 || max > 1000000) errors.salaryRangeMax = "Maximum monthly salary must be between 0 and 1,000,000 PHP.";
    }

    if (!errors.salaryRangeMin && !errors.salaryRangeMax && salaryMin && salaryMax && parseFloat(salaryMin) > parseFloat(salaryMax)) {
      errors.salaryRangeMax = "Minimum monthly salary cannot exceed maximum monthly salary.";
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
      description: description || undefined,
      salaryRangeMin: salaryMin ? Number(salaryMin) : undefined,
      salaryRangeMax: salaryMax ? Number(salaryMax) : undefined,
      employmentType,
      workArrangement,
      ageMin: ageMin ? parseInt(ageMin, 10) : null,
      ageMax: ageMax ? parseInt(ageMax, 10) : null,
      genderPreference: genderPreference || "ANY",
      tattooPolicy: tattooPolicy || "ALLOWED",
    });
  };

  // Leaving while the form is dirty is caught by the leave guard, which asks before discarding.
  const handleCancel = () => navigate({ to: "/ta/mrfs" });

  const clientOptions = clients.map((c) => ({
    value: String(c.id),
    label: c.tradeName ? `${c.name} (${c.tradeName})` : c.name,
    subtitle: `${c.industry || "General industry"} • ${[c.city, c.province].filter(Boolean).join(", ") || c.address || "Philippines"}`,
  }));

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

      <form noValidate onSubmit={handleSubmit} className="space-y-6 border border-slate-300 bg-white p-4 sm:p-6">
        {/* Core Order Information */}
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-2 sm:flex-row sm:items-center">
            <h3 className="text-sm font-semibold text-slate-900">Request details</h3>

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

              <div className="sm:w-64">
                <Select
                  aria-label="Apply role template"
                  value={selectedPresetId}
                  onChange={(e) => handleApplyPreset(e.target.value)}
                >
                  <option value="">Apply role template…</option>
                  {Object.entries(presetsByIndustry).map(([industry, presets]) => (
                    presets.length > 0 && (
                      <optgroup key={industry} label={industry}>
                        {presets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                    )
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <Input
              label="Target fill date"
              type="date"
              min={getManilaToday()}
              value={targetFillDate}
              error={serverFieldErrors.targetFillDate}
              onChange={(e) => {
                setTargetFillDate(e.target.value);
                clearServerFieldError("targetFillDate");
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              <FieldWarning show={locationLooksUnclear(location)}>{LOCATION_UNCLEAR_WARNING}</FieldWarning>
            </div>
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              error={serverFieldErrors.salaryRangeMax || (isSalaryRangeInvalid ? "Maximum salary cannot be less than minimum salary" : undefined)}
            />
          </div>
        </div>

        {/* Skills and qualifications */}
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">
            Skills and qualifications
          </h3>

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
            {activeSkillsList.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-xs text-slate-600">
                  Skills ({activeSkillsList.length}):
                </span>
                {activeSkillsList.map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 border border-slate-200 bg-slate-100 py-0.5 pl-2 text-xs text-slate-700"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>

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

          <Textarea
            id="mrf-notes"
            label="Notes for this client"
            placeholder="Specify shift schedules, client site notes, uniform provisions..."
            value={description}
            error={serverFieldErrors.description}
            onChange={(e) => {
              setDescription(e.target.value);
              clearServerFieldError("description");
            }}
            rows={4}
            maxLength={10000}
          />
        </div>

        {/* Internal-only client requirements */}
        <details
          className="group border-t border-slate-200 pt-4"
          open={clientRequirementsOpen}
          onToggle={(e) => setClientRequirementsOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-900 focus-ring md:min-h-0 [&::-webkit-details-marker]:hidden">
            <span>Client requirements (internal only)</span>
            <span className="text-sm font-medium text-navy group-open:hidden">Show</span>
            <span className="hidden text-sm font-medium text-navy group-open:inline">Hide</span>
          </summary>
          <div className="mt-3 space-y-4">
            <p className="text-sm text-slate-600">These preferences are for your team only and are never shown on job postings.</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
          </div>
        </details>

        <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row">
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

      <CloneMRFModal
        open={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        onSelectMRF={handleApplyClonedMRF}
        currentClientId={clientId || undefined}
        currentClientName={clients.find((c) => c.id === clientId)?.name}
      />

      <ConfirmDialog
        open={pendingFill !== null}
        onClose={cancelPendingFill}
        onConfirm={confirmPendingFill}
        title="Replace what you have filled in?"
        description="This overwrites the title, skills, salary and notes you have entered with the selected specifications."
        confirmLabel="Replace fields"
        cancelLabel="Keep my entries"
        variant="warning"
      />

      {discardDialog}
    </div>
  );
};
