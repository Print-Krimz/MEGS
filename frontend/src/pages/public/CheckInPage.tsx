import React, { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { publicApi } from "../../lib/api/public.api";
import { Button, Input, PhoneInput } from "../../components/ui";
import { DateField } from "../../components/common/DateField";
import { TurnstileWidget, type TurnstileWidgetRef } from "../../components/common";
import { TrackingView } from "../../components/public/TrackingView";
import { MAX_AGE, MIN_AGE, yearsAgo } from "../../lib/walk-in-age";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useSecurityControls } from "../../hooks/useSecurityControls";
import { validatePhilippineMobile } from "../../lib/phone-utils";
import { validateDateOfBirth } from "../../lib/statutory-validation";
import { fieldErrorsFrom, notify } from "../../lib/feedback";
import type { CheckInJob } from "../../lib/types/public.types";
import { ConnectionProblem, LinkProblem, PublicShell, PublicSkeleton, isDeadLink } from "./PublicShell";

const POLL_MS = 15_000;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const Accent: React.FC = () => <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-primary" />;

const jobSubtitle = (job: Pick<CheckInJob, "clientName" | "location">) =>
  [job.clientName, job.location].filter(Boolean).join(" · ");

/** Step 1: every open job, searchable, as large tappable rows. */
const JobStep: React.FC<{ onPick: (job: CheckInJob) => void }> = ({ onPick }) => {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  const query = useQuery({
    queryKey: ["public", "check-in", "jobs", q],
    queryFn: ({ signal }) => publicApi.getCheckInJobs(q, { signal }),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const jobs = query.data?.jobs ?? [];

  return (
    <div className="space-y-5">
      <div>
        <Accent />
        <h1 className="font-display text-2xl leading-tight text-secondary sm:text-3xl">Check in</h1>
        <p className="mt-1 text-base text-muted-foreground">Choose the job you are applying for.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="check-in-search" className="sr-only">
          Search jobs
        </label>
        <input
          id="check-in-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by job, company or place"
          className="min-h-12 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {query.isLoading ? (
        <PublicSkeleton />
      ) : query.isError ? (
        <ConnectionProblem onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : jobs.length === 0 ? (
        <p role="status" className="rounded-lg border border-border bg-background p-4 text-base text-muted-foreground">
          {q ? "No jobs match your search. Try a different word." : "There are no open jobs right now. Ask the recruiter at the desk."}
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Open jobs">
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onPick(job)}
                className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-secondary">{job.title}</span>
                  {jobSubtitle(job) && <span className="block text-sm text-muted-foreground">{jobSubtitle(job)}</span>}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  mobileNumber: string;
  birthDate: string;
}

const EMPTY: FormState = { firstName: "", middleName: "", lastName: "", mobileNumber: "", birthDate: "" };

/** Step 2: the applicant's details. Submitting moves to the queue screen. */
const DetailsStep: React.FC<{ job: CheckInJob; onBack: () => void; onAlready: (queueNumber: string) => void }> = ({
  job,
  onBack,
  onAlready,
}) => {
  const navigate = useNavigate();
  const controls = useSecurityControls();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const isCaptchaDisabled =
    import.meta.env.VITE_DISABLE_CAPTCHA === "true" || (controls.data?.captchaDisabled === true && !controls.isError);
  const isCaptchaRequired = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY) && !isCaptchaDisabled && import.meta.env.MODE !== "test";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const mutation = useMutation({
    mutationFn: () =>
      publicApi.submitCheckIn({
        jobPostingId: job.id,
        firstName: form.firstName.trim(),
        ...(form.middleName.trim() ? { middleName: form.middleName.trim() } : {}),
        lastName: form.lastName.trim(),
        ...(form.mobileNumber ? { mobileNumber: form.mobileNumber } : {}),
        birthDate: form.birthDate,
        ...(file ? { file } : {}),
        turnstileToken,
      }),
    onSuccess: (result) => {
      if (result.alreadyCheckedIn) {
        onAlready(result.queueNumber);
        return;
      }
      // The link in the address bar is how this phone finds its place in the queue again.
      void navigate({
        to: "/check-in/$publicId",
        params: { publicId: result.publicId },
        search: { token: result.viewToken },
        replace: true,
      });
    },
    onError: (error) => {
      turnstileRef.current?.reset();
      setTurnstileToken("");
      const fieldErrors = fieldErrorsFrom(error);
      if (Object.keys(fieldErrors).length > 0) setErrors((prev) => ({ ...prev, ...fieldErrors }));
      else notify.error("Could not check you in", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Enter your first name.";
    if (!form.lastName.trim()) next.lastName = "Enter your last name.";
    if (form.mobileNumber && !validatePhilippineMobile(form.mobileNumber).isValid) {
      next.mobileNumber = "Enter an 11-digit mobile number starting with 09, or leave it blank.";
    }
    if (!form.birthDate) next.birthDate = "Enter your birth date.";
    else if (validateDateOfBirth(form.birthDate, { minAge: MIN_AGE, maxAge: MAX_AGE })) {
      next.birthDate = `You must be ${MIN_AGE} to ${MAX_AGE} years old to apply.`;
    }
    if (file && file.size > MAX_FILE_BYTES) next.file = "The file is over 5 MB. Retake the photo or use a smaller file.";
    else if (file && !ACCEPTED_TYPES.includes(file.type)) next.file = "Use a JPEG, PNG or WEBP photo, or a PDF.";
    if (isCaptchaRequired && !turnstileToken) next.turnstile = "Complete the security check.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <Accent />
        <h1 className="font-display text-2xl leading-tight text-secondary sm:text-3xl">Your details</h1>
        <div className="mt-3 rounded-lg border border-border bg-background px-4 py-3">
          <p className="text-sm text-muted-foreground">Applying for</p>
          <p className="text-base font-semibold text-secondary">{job.title}</p>
          {jobSubtitle(job) && <p className="text-sm text-muted-foreground">{jobSubtitle(job)}</p>}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <Input
          id="check-in-first-name"
          label="First name"
          required
          nameInput
          autoComplete="given-name"
          value={form.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          error={errors.firstName}
        />
        <Input
          id="check-in-middle-name"
          label="Middle name (optional)"
          nameInput
          autoComplete="additional-name"
          value={form.middleName}
          onChange={(e) => set("middleName", e.target.value)}
        />
        <Input
          id="check-in-last-name"
          label="Last name"
          required
          nameInput
          autoComplete="family-name"
          value={form.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          error={errors.lastName}
        />
        <PhoneInput
          id="check-in-mobile"
          label="Mobile number (optional)"
          mobileOnly
          value={form.mobileNumber}
          onChange={(v) => set("mobileNumber", v)}
          helperText="We use it to text you about job offers."
          error={errors.mobileNumber}
        />
        <DateField
          id="check-in-birth-date"
          label="Birth date"
          required
          min={yearsAgo(MAX_AGE + 1)}
          max={yearsAgo(MIN_AGE)}
          help={`${MIN_AGE} to ${MAX_AGE} years old.`}
          value={form.birthDate}
          onChange={(e) => set("birthDate", e.target.value)}
          error={errors.birthDate}
        />
        <div className="space-y-1.5">
          <label htmlFor="check-in-biodata" className="block text-sm font-medium text-foreground">
            Biodata photo or PDF (optional)
          </label>
          <input
            ref={fileInputRef}
            id="check-in-biodata"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-invalid={errors.file ? true : undefined}
            aria-describedby={errors.file ? "check-in-biodata-error" : "check-in-biodata-help"}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              if (errors.file) setErrors((prev) => ({ ...prev, file: "" }));
            }}
            className={`block min-h-12 w-full rounded-lg border bg-background text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary file:mr-3 file:h-full file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium ${
              errors.file ? "border-rose-400" : "border-border"
            }`}
          />
          {file && (
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-foreground">{file.name}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0"
                disabled={mutation.isPending}
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  setErrors((prev) => ({ ...prev, file: "" }));
                }}
              >
                Remove
              </Button>
            </div>
          )}
          {errors.file ? (
            <p id="check-in-biodata-error" role="alert" className="text-xs font-medium text-rose-600">
              {errors.file}
            </p>
          ) : (
            <p id="check-in-biodata-help" className="text-sm text-muted-foreground">
              Take a clear photo of your biodata, or skip this and bring the paper to the desk.
            </p>
          )}
        </div>
        {!isCaptchaDisabled && (
          <div className="space-y-1.5">
            <TurnstileWidget
              ref={turnstileRef}
              action="check-in"
              onSuccess={(token) => {
                setTurnstileToken(token);
                setErrors((prev) => ({ ...prev, turnstile: "" }));
              }}
              onExpire={() => setTurnstileToken("")}
            />
            {errors.turnstile && (
              <p role="alert" className="text-xs font-medium text-rose-600">
                {errors.turnstile}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" className="min-h-12" onClick={onBack} disabled={mutation.isPending}>
          Back
        </Button>
        <Button type="submit" size="lg" className="min-h-12 flex-1" loading={mutation.isPending}>
          Get my number
        </Button>
      </div>
    </form>
  );
};

/** Queue screen. Polls until the recruiter confirms or closes the check-in. */
const QueueScreen: React.FC<{ publicId: string; token: string | undefined }> = ({ publicId, token }) => {
  const query = useQuery({
    queryKey: ["public", "check-in", "status", publicId, token],
    queryFn: ({ signal }) => publicApi.getCheckInStatus(publicId, token ?? "", { signal }),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data || data.status !== "PENDING") return false;
      return new Date(data.expiresAt).getTime() > Date.now() ? POLL_MS : false;
    },
  });
  const data = query.data;
  const closedCopy = "This check-in is closed. Ask the recruiter at the desk.";

  if (!token || (query.isError && isDeadLink(query.error))) {
    return <LinkProblem title="Check-in closed" message={closedCopy} />;
  }
  if (query.isError && !data) return <ConnectionProblem onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  if (!data) return <PublicSkeleton />;

  if (data.status === "DISMISSED" || (data.status === "PENDING" && new Date(data.expiresAt).getTime() <= Date.now())) {
    return <LinkProblem title="Check-in closed" message={closedCopy} />;
  }
  if (data.status === "CONFIRMED" && data.tracking) return <TrackingView data={data.tracking} />;

  return (
    <div className="space-y-5">
      <div>
        <Accent />
        <h1 className="font-display text-2xl leading-tight text-secondary sm:text-3xl">
          {data.status === "CONFIRMED" ? "You are checked in" : "You're in the queue"}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">{data.jobTitle}</p>
      </div>

      <section aria-label="Your queue number" className="rounded-lg border border-border bg-background px-4 py-8 text-center">
        <p className="font-display text-7xl font-bold leading-none tabular-nums tracking-wide text-secondary sm:text-8xl">
          {data.queueNumber}
        </p>
        <p className="mt-4 text-lg font-semibold text-foreground">Show this number at the desk</p>
      </section>

      <p role="status" aria-live="polite" className="text-base text-muted-foreground">
        {data.status === "CONFIRMED"
          ? "A recruiter confirmed your check-in. Your progress will appear here."
          : query.isError
            ? "Could not refresh just now. Your number is still valid."
            : "Keep this page open or bookmark it. Your number stays here."}
      </p>
    </div>
  );
};

/** Routes: /check-in (job, details) and /check-in/$publicId?token= (queue number, then tracker). */
export const CheckInPage: React.FC = () => {
  const { publicId } = useParams({ strict: false }) as { publicId?: string };
  const { token } = useSearch({ strict: false }) as { token?: string };
  const [job, setJob] = useState<CheckInJob | null>(null);
  const [already, setAlready] = useState<string | null>(null);

  return (
    <PublicShell>
      {already ? (
        <div className="space-y-5">
          <div>
            <Accent />
            <h1 className="font-display text-2xl leading-tight text-secondary sm:text-3xl">You already checked in today</h1>
          </div>
          <section aria-label="Your queue number" className="rounded-lg border border-border bg-background px-4 py-8 text-center">
            <p className="text-base text-muted-foreground">Your number is</p>
            <p className="mt-2 font-display text-7xl font-bold leading-none tabular-nums tracking-wide text-secondary sm:text-8xl">
              {already}
            </p>
            <p className="mt-4 text-lg font-semibold text-foreground">Show it at the desk.</p>
          </section>
        </div>
      ) : publicId ? (
        <QueueScreen publicId={publicId} token={token} />
      ) : job ? (
        <DetailsStep job={job} onBack={() => setJob(null)} onAlready={setAlready} />
      ) : (
        <JobStep onPick={setJob} />
      )}
    </PublicShell>
  );
};

export default CheckInPage;
