import React, { useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { ApiError } from "../../../lib/api/client";
import { AuthContext } from "../../../context/AuthContext";
import { Button, ComboBox, Dialog, Input, PhoneInput, Select } from "../../ui";
import { DateField } from "../../common/DateField";
import { notify, fieldErrorsFrom } from "../../../lib/feedback";
import { useDirtyGuard } from "../../../hooks/useDirtyGuard";
import { MAX_AGE, MIN_AGE, yearsAgo } from "../../../lib/walk-in-age";
import type { CheckInDetail, WalkInMatch, WalkInSlip } from "../../../lib/types/application.types";
import {
  ACCEPT_ATTRIBUTE,
  GENDER_SELECT_OPTIONS,
  UNREADABLE_MESSAGE,
  duplicateParamsFor,
  fileSchema,
  fillEmptyFields,
  useOpenJobOptions,
  walkInIdentitySchema,
} from "./walkInShared";
import { ExistingRecordNotice, WalkInMatchList } from "./WalkInMatchList";

interface EncodeWalkInDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (slip: WalkInSlip) => void;
  /** A pending self check-in to confirm. Prefills the form and locks the job. */
  checkIn?: CheckInDetail | null;
}

const schema = walkInIdentitySchema.extend({ file: fileSchema });

interface FormState {
  jobPostingId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobileNumber: string;
  birthDate: string;
  gender: string;
  file: File | null;
}

const EMPTY_FORM: FormState = {
  jobPostingId: "",
  firstName: "",
  middleName: "",
  lastName: "",
  mobileNumber: "",
  birthDate: "",
  gender: "",
  file: null,
};

const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const EncodeWalkInDialog: React.FC<EncodeWalkInDialogProps> = ({ open, onClose, onCreated, checkIn = null }) => {
  const queryClient = useQueryClient();
  const auth = useContext(AuthContext);
  const myId = auth?.user?.id;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<WalkInMatch[]>([]);
  const [existingUser, setExistingUser] = useState<WalkInMatch | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [readState, setReadState] = useState<"idle" | "reading" | "filled" | "unreadable">("idle");
  const lastCheckKey = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Each file pick gets a number, so an older read that finishes late is ignored.
  const readVersion = useRef(0);
  const formRef = useRef(form);
  formRef.current = form;

  const { jobsQuery, jobOptions } = useOpenJobOptions(open && !checkIn);

  useEffect(() => {
    if (!checkIn) return;
    setForm({
      jobPostingId: String(checkIn.jobPostingId),
      firstName: checkIn.firstName,
      middleName: checkIn.middleName ?? "",
      lastName: checkIn.lastName,
      mobileNumber: checkIn.mobileNumber ?? "",
      birthDate: checkIn.birthDate,
      gender: "",
      file: null,
    });
    readVersion.current += 1;
    setReadState("idle");
    setErrors({});
    setMatches([]);
    setExistingUser(null);
    setDismissedIds([]);
    lastCheckKey.current = "";
  }, [checkIn]);

  const isDirty = checkIn
    ? Boolean(form.file) ||
      form.firstName !== checkIn.firstName ||
      form.middleName !== (checkIn.middleName ?? "") ||
      form.lastName !== checkIn.lastName ||
      form.mobileNumber !== (checkIn.mobileNumber ?? "") ||
      form.birthDate !== checkIn.birthDate ||
      Boolean(form.gender)
    : Boolean(
        form.jobPostingId ||
          form.firstName ||
          form.middleName ||
          form.lastName ||
          form.mobileNumber ||
          form.birthDate ||
          form.gender ||
          form.file,
      );
  const hasBiodata = Boolean(checkIn?.biodata);
  const guard = useDirtyGuard({ isDirty: open && isDirty, message: "The walk-in has not been saved yet." });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const clearPreview = () => {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  };

  // A preview that finishes loading after the dialog closed must not leave an object URL behind.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    if (!open) clearPreview();
  }, [open]);

  useEffect(() => () => clearPreview(), []);

  const viewApplicantFile = async () => {
    if (!checkIn?.biodata) return;
    setLoadingPreview(true);
    try {
      const blob = await taApi.getCheckInBiodata(checkIn.id);
      if (!openRef.current) return;
      const url = URL.createObjectURL(blob);
      if (blob.type === "application/pdf" || checkIn.biodata.mimeType === "application/pdf") {
        window.open(url, "_blank", "noopener");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        setPreviewMime(blob.type || checkIn.biodata.mimeType);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
      }
    } catch (error) {
      notify.error("Could not open the file", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const reset = () => {
    clearPreview();
    setForm(EMPTY_FORM);
    setErrors({});
    setMatches([]);
    setExistingUser(null);
    setDismissedIds([]);
    setReadState("idle");
    readVersion.current += 1;
    lastCheckKey.current = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const requestClose = async () => {
    if (createMutation.isPending) return;
    if (!(await guard.confirmDiscard())) return;
    reset();
    onClose();
  };

  const runDuplicateCheck = async (values: FormState = formRef.current) => {
    if (existingUser) return;
    const params = duplicateParamsFor(values);
    if (!params) return;
    const key = JSON.stringify(params);
    if (key === lastCheckKey.current) return;
    lastCheckKey.current = key;
    setChecking(true);
    try {
      const result = await taApi.checkWalkInDuplicate(params);
      setMatches(result.matches ?? []);
    } catch {
      // The check is a helper. Saving still works, and the server rejects true duplicate applications.
      setMatches([]);
    } finally {
      setChecking(false);
    }
  };

  const readBiodata = async (file: File) => {
    const version = ++readVersion.current;
    setReadState("reading");
    try {
      const read = await taApi.readWalkInBiodata(file);
      if (version !== readVersion.current) return;
      if (read.status !== "read") {
        setReadState("unreadable");
        return;
      }
      // Only empty fields are filled: anything the TA typed (even while the file was being read) stays.
      const { next, filled } = fillEmptyFields(formRef.current, read);
      let merged = next;
      let jobFilled = false;
      if (!checkIn && !merged.jobPostingId && read.suggestedJobId) {
        merged = { ...merged, jobPostingId: String(read.suggestedJobId) };
        jobFilled = true;
      }
      if (filled || jobFilled) {
        setForm(merged);
        setErrors({});
      }
      setReadState(filled || jobFilled ? "filled" : "idle");
      void runDuplicateCheck(merged);
    } catch {
      // Includes "too many reads right now". The TA can type the details; saving still works.
      if (version === readVersion.current) setReadState("unreadable");
    }
  };

  const handleFileChange = (file: File | null) => {
    set("file", file);
    if (!file) {
      readVersion.current += 1;
      setReadState("idle");
      return;
    }
    // A file the form would refuse is not sent for reading; submit shows the reason.
    if (!fileSchema.safeParse(file).success) {
      readVersion.current += 1;
      setReadState("idle");
      return;
    }
    void readBiodata(file);
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => (checkIn ? taApi.confirmCheckIn(checkIn.id, data) : taApi.createWalkIn(data)),
    onSuccess: (slip) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      if (checkIn) queryClient.invalidateQueries({ queryKey: ["ta", "check-ins"] });
      notify.success("Walk-in saved", `${slip.applicantName} is now in the pipeline.`);
      reset();
      onClose();
      onCreated(slip);
    },
    onError: (error) => {
      if (checkIn && error instanceof ApiError && error.status === 409) {
        notify.error("Check-in already handled", "Another recruiter already handled this check-in.");
        queryClient.invalidateQueries({ queryKey: ["ta", "check-ins"] });
        reset();
        onClose();
        return;
      }
      const fieldErrors = fieldErrorsFrom(error);
      if (Object.keys(fieldErrors).length > 0) setErrors((prev) => ({ ...prev, ...fieldErrors }));
      else notify.error("Could not save the walk-in", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, file: form.file ?? undefined });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (!next[field]) next[field] = issue.message;
      }
      if (!form.file && !hasBiodata && !next.file) next.file = "Add a photo or PDF of the resume.";
      setErrors(next);
      return;
    }
    if (!parsed.data.file && !hasBiodata) {
      setErrors({ file: "Add a photo or PDF of the resume." });
      return;
    }
    const body = new FormData();
    if (parsed.data.file) body.append("file", parsed.data.file);
    // A check-in already names its job; the server rejects a job id in the confirm request.
    if (!checkIn) body.append("jobPostingId", parsed.data.jobPostingId);
    body.append("firstName", parsed.data.firstName);
    if (parsed.data.middleName) body.append("middleName", parsed.data.middleName);
    body.append("lastName", parsed.data.lastName);
    if (parsed.data.mobileNumber) body.append("mobileNumber", parsed.data.mobileNumber);
    if (parsed.data.birthDate) body.append("birthDate", parsed.data.birthDate);
    body.append("gender", parsed.data.gender);
    if (existingUser) body.append("existingUserId", existingUser.userId);
    createMutation.mutate(body);
  };

  const visibleMatches = existingUser ? [] : matches.filter((m) => !dismissedIds.includes(m.userId));

  return (
    <>
      <Dialog
        open={open}
        onClose={() => void requestClose()}
        title={checkIn ? `Confirm check-in ${checkIn.queueNumber}` : "Encode walk-in"}
        description={
          checkIn
            ? "Check their ID, correct any detail, then photograph the resume."
            : "Add the resume first. The details fill in from it."
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {checkIn ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-slate-600">Job opening</p>
              <p className="text-sm font-semibold text-slate-900">{checkIn.jobTitle}</p>
              {checkIn.clientName && <p className="text-xs text-slate-600">{checkIn.clientName}</p>}
              {checkIn.jobOwnerId && checkIn.jobOwnerId !== myId && (
                <p className="text-xs text-slate-600">
                  {checkIn.jobOwnerName
                    ? `Goes to ${checkIn.jobOwnerName}'s list after you confirm.`
                    : "Goes to the recruiter who owns this job after you confirm."}
                </p>
              )}
            </div>
          ) : jobsQuery.isError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <span>Could not load the open jobs.</span>
              <Button type="button" variant="outline" size="sm" loading={jobsQuery.isFetching} onClick={() => void jobsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
          <ComboBox
            id="walk-in-job"
            label="Job opening"
            required
            placeholder="Search open jobs"
            options={jobOptions}
            value={form.jobPostingId}
            onChange={(v) => set("jobPostingId", v)}
            loading={jobsQuery.isLoading}
            emptyText="No open jobs. Open a job first."
            error={errors.jobPostingId}
          />
          )}

          {checkIn?.biodata && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-words text-sm text-slate-900">
                  Applicant attached: <strong>{checkIn.biodata.fileName}</strong> ({formatFileSize(checkIn.biodata.sizeBytes)})
                </p>
                <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-8" loading={loadingPreview} onClick={() => void viewApplicantFile()}>
                  View
                </Button>
              </div>
              {previewUrl && previewMime.startsWith("image/") && (
                <img src={previewUrl} alt="Resume the applicant attached" className="max-h-80 w-full rounded border border-slate-200 bg-white object-contain" />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="walk-in-biodata" className="block text-xs font-medium text-slate-600">
              {hasBiodata ? "Replace resume (optional)" : "Resume photo or PDF"}
              {!hasBiodata && <span className="ml-0.5 text-rose-500">*</span>}
            </label>
            <input
              ref={fileInputRef}
              id="walk-in-biodata"
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              aria-invalid={errors.file ? true : undefined}
              aria-describedby={errors.file ? "walk-in-biodata-error" : "walk-in-biodata-help"}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className={`block w-full min-h-11 md:min-h-10 rounded-md border bg-white text-sm text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 file:mr-3 file:h-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 ${
                errors.file ? "border-rose-400 bg-rose-50/20 focus-visible:ring-rose-600" : "border-slate-300 hover:border-slate-400"
              }`}
            />
            {errors.file ? (
              <p id="walk-in-biodata-error" role="alert" className="text-xs font-medium text-rose-600">
                {errors.file}
              </p>
            ) : readState === "reading" ? (
              <p id="walk-in-biodata-help" role="status" className="text-xs text-slate-600">
                Reading resume…
              </p>
            ) : readState === "filled" ? (
              <p id="walk-in-biodata-help" role="status" className="text-xs text-slate-600">
                Filled from the resume. Check before saving.
              </p>
            ) : readState === "unreadable" ? (
              <p id="walk-in-biodata-help" role="status" className="text-xs text-slate-600">
                {UNREADABLE_MESSAGE}
              </p>
            ) : (
              <p id="walk-in-biodata-help" className="text-xs text-slate-500">
                {hasBiodata ? "Leave empty to use the applicant's file. " : ""}The match score is calculated from this file.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              id="walk-in-first-name"
              label="First name"
              required
              nameInput
              autoComplete="off"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              error={errors.firstName}
            />
            <Input
              id="walk-in-middle-name"
              label="Middle name"
              nameInput
              autoComplete="off"
              value={form.middleName}
              onChange={(e) => set("middleName", e.target.value)}
              error={errors.middleName}
            />
            <div onBlur={() => void runDuplicateCheck()}>
              <Input
                id="walk-in-last-name"
                label="Last name"
                required
                nameInput
                autoComplete="off"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                error={errors.lastName}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div onBlur={() => void runDuplicateCheck()}>
              <PhoneInput
                id="walk-in-mobile"
                label="Mobile number (optional)"
                mobileOnly
                value={form.mobileNumber}
                onChange={(v) => set("mobileNumber", v)}
                helperText="Needed to text offers later."
                error={errors.mobileNumber}
              />
            </div>
            <div onBlur={() => void runDuplicateCheck()}>
              <DateField
                id="walk-in-birth-date"
                label="Birth date"
                required
                min={yearsAgo(MAX_AGE + 1)}
                max={yearsAgo(MIN_AGE)}
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
                error={errors.birthDate}
              />
            </div>
            <Select
              id="walk-in-gender"
              label="Gender"
              required
              placeholder="Choose"
              options={GENDER_SELECT_OPTIONS}
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              error={errors.gender}
            />
          </div>

          {checking && (
            <p role="status" className="text-sm text-slate-600">
              Checking for an existing record...
            </p>
          )}

          {existingUser && <ExistingRecordNotice match={existingUser} onUndo={() => setExistingUser(null)} />}

          <WalkInMatchList
            matches={visibleMatches}
            onUse={setExistingUser}
            onDismiss={(match) => setDismissedIds((prev) => [...prev, match.userId])}
          />

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              {checkIn ? "Confirm and print slip" : "Save and print slip"}
            </Button>
          </div>
        </form>
      </Dialog>
      {guard.discardDialog}
    </>
  );
};
