import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { taApi } from "../../../lib/api/ta.api";
import { Button, ComboBox, Dialog, Input, PhoneInput } from "../../ui";
import { DateField } from "../../common/DateField";
import { notify, fieldErrorsFrom } from "../../../lib/feedback";
import { useDirtyGuard } from "../../../hooks/useDirtyGuard";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../../lib/query-policies";
import { validatePhilippineMobile } from "../../../lib/phone-utils";
import { getManilaToday } from "../../../lib/field-limits";
import { formatTaStatus } from "../../../lib/ta-copy";
import type { WalkInMatch, WalkInSlip } from "../../../lib/types/application.types";

interface EncodeWalkInDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (slip: WalkInSlip) => void;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const schema = z.object({
  jobPostingId: z.string().min(1, "Choose a job opening."),
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
  lastName: z.string().trim().min(1, "Enter a last name.").max(100),
  middleName: z.string().trim().max(100),
  mobileNumber: z.string().refine((v) => validatePhilippineMobile(v).isValid, "Enter an 11-digit mobile number starting with 09."),
  birthDate: z.string().refine((v) => !v || v <= getManilaToday(), "Birth date cannot be in the future."),
  file: z
    .instanceof(File, { message: "Add a photo or PDF of the biodata." })
    .refine((f) => f.size <= MAX_FILE_BYTES, "The file is over 5 MB. Retake the photo or use a smaller file.")
    .refine((f) => ACCEPTED_TYPES.includes(f.type), "Use a JPEG, PNG or WEBP photo, or a PDF."),
});

interface FormState {
  jobPostingId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobileNumber: string;
  birthDate: string;
  file: File | null;
}

const EMPTY_FORM: FormState = {
  jobPostingId: "",
  firstName: "",
  middleName: "",
  lastName: "",
  mobileNumber: "",
  birthDate: "",
  file: null,
};

export const EncodeWalkInDialog: React.FC<EncodeWalkInDialogProps> = ({ open, onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<WalkInMatch[]>([]);
  const [existingUser, setExistingUser] = useState<WalkInMatch | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const lastCheckKey = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "dropdown"],
    queryFn: ({ signal }) => taApi.listJobs({}, { signal }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
    enabled: open,
  });

  const jobOptions = useMemo(
    () =>
      (jobsQuery.data ?? [])
        .filter((job) => job.status === "OPEN")
        .map((job) => ({
          value: String(job.id),
          label: job.title,
          subtitle: [job.mrf?.client?.name, job.location].filter(Boolean).join(" · ") || undefined,
        })),
    [jobsQuery.data],
  );

  const isDirty = Boolean(
    form.jobPostingId || form.firstName || form.middleName || form.lastName || form.mobileNumber || form.birthDate || form.file,
  );
  const guard = useDirtyGuard({ isDirty: open && isDirty, message: "The walk-in has not been saved yet." });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setMatches([]);
    setExistingUser(null);
    setDismissedIds([]);
    lastCheckKey.current = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const requestClose = async () => {
    if (createMutation.isPending) return;
    if (!(await guard.confirmDiscard())) return;
    reset();
    onClose();
  };

  const runDuplicateCheck = async () => {
    if (existingUser) return;
    const phoneOk = form.mobileNumber && validatePhilippineMobile(form.mobileNumber).isComplete;
    const nameOk = form.firstName.trim() && form.lastName.trim();
    if (!phoneOk && !nameOk) return;
    const params = {
      phone: phoneOk ? form.mobileNumber : undefined,
      firstName: nameOk ? form.firstName.trim() : undefined,
      lastName: nameOk ? form.lastName.trim() : undefined,
      birthDate: form.birthDate || undefined,
    };
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

  const createMutation = useMutation({
    mutationFn: (data: FormData) => taApi.createWalkIn(data),
    onSuccess: (slip) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
      notify.success("Walk-in saved", `${slip.applicantName} is now in the pipeline.`);
      reset();
      onClose();
      onCreated(slip);
    },
    onError: (error) => {
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
      setErrors(next);
      return;
    }
    const body = new FormData();
    body.append("file", parsed.data.file);
    body.append("jobPostingId", parsed.data.jobPostingId);
    body.append("firstName", parsed.data.firstName);
    if (parsed.data.middleName) body.append("middleName", parsed.data.middleName);
    body.append("lastName", parsed.data.lastName);
    if (parsed.data.mobileNumber) body.append("mobileNumber", parsed.data.mobileNumber);
    if (parsed.data.birthDate) body.append("birthDate", parsed.data.birthDate);
    if (existingUser) body.append("existingUserId", existingUser.userId);
    createMutation.mutate(body);
  };

  const visibleMatches = existingUser ? [] : matches.filter((m) => !dismissedIds.includes(m.userId));

  return (
    <>
      <Dialog
        open={open}
        onClose={() => void requestClose()}
        title="Encode walk-in"
        description="Enter the applicant and photograph their biodata."
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {jobsQuery.isError ? (
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

          <div className="grid gap-3 sm:grid-cols-2">
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
                label="Birth date (optional)"
                max={getManilaToday()}
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
                error={errors.birthDate}
              />
            </div>
          </div>

          {checking && (
            <p role="status" className="text-sm text-slate-600">
              Checking for an existing record...
            </p>
          )}

          {existingUser && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-navy-line bg-navy-soft px-3 py-2 text-sm text-navy">
              <span>
                Using the existing record for <strong>{existingUser.fullName}</strong>. Blank profile fields get filled in.
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExistingUser(null)}>
                Undo
              </Button>
            </div>
          )}

          {visibleMatches.length > 0 && (
            <div role="group" aria-label="Possible matches" className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">
                {visibleMatches.length === 1 ? "This person may already be in MEGS." : "These people may already be in MEGS."}
              </p>
              <ul className="space-y-2">
                {visibleMatches.map((match) => (
                  <li key={match.userId} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 pt-2 first:border-t-0 first:pt-0">
                    <div className="min-w-0 text-sm text-slate-900">
                      <p className="font-medium">
                        {match.fullName}
                        {match.maskedPhone ? <span className="font-normal text-slate-700"> · {match.maskedPhone}</span> : null}
                      </p>
                      <p className="text-slate-700">
                        {match.latestApplication
                          ? `Last applied for ${match.latestApplication.jobTitle} (${formatTaStatus(match.latestApplication.status)})`
                          : "No applications yet"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 md:min-h-8"
                        onClick={() => setDismissedIds((prev) => [...prev, match.userId])}
                      >
                        Different person
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 md:min-h-8"
                        onClick={() => {
                          setExistingUser(match);
                        }}
                      >
                        Use this person
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="walk-in-biodata" className="block text-xs font-medium text-slate-600">
              Biodata photo or PDF<span className="ml-0.5 text-rose-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              id="walk-in-biodata"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              aria-invalid={errors.file ? true : undefined}
              aria-describedby={errors.file ? "walk-in-biodata-error" : "walk-in-biodata-help"}
              onChange={(e) => set("file", e.target.files?.[0] ?? null)}
              className={`block w-full min-h-11 md:min-h-10 rounded-md border bg-white text-sm text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 file:mr-3 file:h-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 ${
                errors.file ? "border-rose-400 bg-rose-50/20 focus-visible:ring-rose-600" : "border-slate-300 hover:border-slate-400"
              }`}
            />
            {errors.file ? (
              <p id="walk-in-biodata-error" role="alert" className="text-xs font-medium text-rose-600">
                {errors.file}
              </p>
            ) : (
              <p id="walk-in-biodata-help" className="text-xs text-slate-500">
                The match score is calculated from this file.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Save and print slip
            </Button>
          </div>
        </form>
      </Dialog>
      {guard.discardDialog}
    </>
  );
};
