import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { Button, ComboBox, Dialog, Input, PhoneInput, Select } from "../../ui";
import { DateField } from "../../common/DateField";
import { fieldErrorsFrom, formatErrorMessage, notify } from "../../../lib/feedback";
import { useDirtyGuard } from "../../../hooks/useDirtyGuard";
import { MAX_AGE, MIN_AGE, yearsAgo } from "../../../lib/walk-in-age";
import type { WalkInBiodataRead, WalkInMatch, WalkInSlip } from "../../../lib/types/application.types";
import {
  ACCEPTED_TYPES,
  ACCEPT_ATTRIBUTE,
  FILE_TOO_BIG_MESSAGE,
  FILE_TYPE_MESSAGE,
  GENDER_SELECT_OPTIONS,
  MAX_FILE_BYTES,
  UNREADABLE_MESSAGE,
  duplicateParamsFor,
  fillEmptyFields,
  useOpenJobOptions,
  walkInIdentitySchema,
  type IdentityFields,
} from "./walkInShared";
import { ExistingRecordNotice, WalkInMatchList } from "./WalkInMatchList";
import { WalkInSlipSheetDialog } from "./WalkInSlipSheet";

export const MAX_BATCH_FILES = 15;
/** The server limits bio-data reads per user, so only a couple run at once. */
const READ_CONCURRENCY = 2;

type JobSource = "none" | "batch" | "suggested" | "manual";

interface RowResult {
  status: "idle" | "saving" | "done" | "error";
  slip?: WalkInSlip;
  message?: string;
}

interface BatchRow extends IdentityFields {
  id: string;
  file: File;
  previewUrl: string;
  read: "queued" | "reading" | "read" | "unreadable";
  /** "Position applied for" as written on the bio-data. */
  positionApplied: string;
  jobPostingId: string;
  jobSource: JobSource;
  existingUser: WalkInMatch | null;
  matches: WalkInMatch[];
  dismissedIds: string[];
  checking: boolean;
  result: RowResult;
}

/** The first problem for each field, in plain words. Empty when the row can be encoded. */
const rowProblems = (row: BatchRow): string[] => {
  const parsed = walkInIdentitySchema.safeParse(row);
  if (parsed.success) return [];
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0]);
    if (seen.has(field)) continue;
    seen.add(field);
    problems.push(issue.message);
  }
  return problems;
};

/** The row after a bio-data read: empty fields filled, job suggested unless the TA already chose one. */
const applyRead = (row: BatchRow, read: WalkInBiodataRead | null): BatchRow => {
  if (!read || read.status !== "read") return { ...row, read: "unreadable" };
  const { next } = fillEmptyFields(row, read);
  const suggested = read.suggestedJobId && row.jobSource !== "manual";
  return {
    ...next,
    read: "read",
    positionApplied: read.positionApplied?.trim() ?? "",
    jobPostingId: suggested ? String(read.suggestedJobId) : row.jobPostingId,
    jobSource: suggested ? "suggested" : row.jobSource,
  };
};

const isPdf = (file: File) => file.type === "application/pdf";

interface RowViewProps {
  row: BatchRow;
  jobOptions: { value: string; label: string; subtitle?: string }[];
  jobsLoading: boolean;
  /** Typing is locked while the batch is saving, and for rows that are already encoded. */
  locked: boolean;
  onChange: (patch: Partial<BatchRow>) => void;
  onJobChange: (value: string) => void;
  onCheck: () => void;
  onRemove: () => void;
}

const RowView: React.FC<RowViewProps> = ({ row, jobOptions, jobsLoading, locked, onChange, onJobChange, onCheck, onRemove }) => {
  const done = row.result.status === "done";
  const disabled = locked || done;
  const waiting = row.read === "queued" || row.read === "reading";
  const problems = !waiting && !done ? rowProblems(row) : [];
  const visibleMatches = row.existingUser ? [] : row.matches.filter((m) => !row.dismissedIds.includes(m.userId));
  const idFor = (name: string) => `batch-${row.id}-${name}`;

  return (
    <li role="group" aria-label={`Walk-in from ${row.file.name}`} className="grid gap-3 py-4 md:grid-cols-[4.5rem_minmax(0,1fr)]">
      <button
        type="button"
        aria-label={`View ${row.file.name} larger`}
        onClick={() => window.open(row.previewUrl, "_blank", "noopener")}
        className="flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1"
      >
        {isPdf(row.file) ? "PDF" : <img src={row.previewUrl} alt="" className="h-full w-full object-cover" />}
      </button>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{row.file.name}</p>
            {waiting && (
              <p role="status" className="text-xs text-slate-600">
                Reading…
              </p>
            )}
            {row.read === "unreadable" && <p className="text-xs text-slate-600">{UNREADABLE_MESSAGE}</p>}
            {row.read === "read" && row.positionApplied && !done && (
              <p className="text-xs text-slate-600">From bio-data: {row.positionApplied}</p>
            )}
            {done && row.result.slip && (
              <p role="status" className="text-xs font-medium text-emerald-800">
                Encoded. Tracking code {row.result.slip.trackingCode}
              </p>
            )}
            {row.result.status === "saving" && (
              <p role="status" className="text-xs text-slate-600">
                Saving…
              </p>
            )}
            {row.result.status === "error" && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                Not saved. {row.result.message}
              </p>
            )}
          </div>
          {!done && (
            <Button type="button" variant="ghost" size="sm" className="min-h-11 md:min-h-8" disabled={locked} onClick={onRemove} aria-label={`Remove ${row.file.name}`}>
              Remove
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            id={idFor("first-name")}
            label="First name"
            required
            nameInput
            autoComplete="off"
            disabled={disabled}
            value={row.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
          />
          <Input
            id={idFor("middle-name")}
            label="Middle name"
            nameInput
            autoComplete="off"
            disabled={disabled}
            value={row.middleName}
            onChange={(e) => onChange({ middleName: e.target.value })}
          />
          <div onBlur={onCheck}>
            <Input
              id={idFor("last-name")}
              label="Last name"
              required
              nameInput
              autoComplete="off"
              disabled={disabled}
              value={row.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div onBlur={onCheck}>
            <PhoneInput
              id={idFor("mobile")}
              label="Mobile number (optional)"
              mobileOnly
              disabled={disabled}
              value={row.mobileNumber}
              onChange={(v) => onChange({ mobileNumber: v })}
            />
          </div>
          <div onBlur={onCheck}>
            <DateField
              id={idFor("birth-date")}
              label="Birth date"
              required
              min={yearsAgo(MAX_AGE + 1)}
              max={yearsAgo(MIN_AGE)}
              disabled={disabled}
              value={row.birthDate}
              onChange={(e) => onChange({ birthDate: e.target.value })}
            />
          </div>
          <Select
            id={idFor("gender")}
            label="Gender"
            required
            placeholder="Choose"
            options={GENDER_SELECT_OPTIONS}
            disabled={disabled}
            value={row.gender}
            onChange={(e) => onChange({ gender: e.target.value })}
          />
          <ComboBox
            id={idFor("job")}
            label="Job opening"
            required
            placeholder="Search open jobs"
            options={jobOptions}
            value={row.jobPostingId}
            onChange={onJobChange}
            disabled={disabled}
            loading={jobsLoading}
            emptyText="No open jobs. Open a job first."
          />
        </div>

        {problems.length > 0 && <p className="text-xs text-slate-600">Still needed: {problems.join(" ")}</p>}

        {row.checking && (
          <p role="status" className="text-sm text-slate-600">
            Checking for an existing record...
          </p>
        )}
        {row.existingUser && !done && <ExistingRecordNotice match={row.existingUser} onUndo={() => onChange({ existingUser: null })} />}
        {!done && (
          <WalkInMatchList
            matches={visibleMatches}
            onUse={(match) => onChange({ existingUser: match })}
            onDismiss={(match) => onChange({ dismissedIds: [...row.dismissedIds, match.userId] })}
          />
        )}
      </div>
    </li>
  );
};

interface EncodeSeveralWalkInsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const EncodeSeveralWalkInsDialog: React.FC<EncodeSeveralWalkInsDialogProps> = ({ open, onClose }) => {
  const queryClient = useQueryClient();
  const { jobsQuery, jobOptions } = useOpenJobOptions(open);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [batchJob, setBatchJob] = useState("");
  const [notice, setNotice] = useState<string[]>([]);
  const [encoding, setEncoding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSeen, setSheetSeen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rows live in a ref as well, so the read queue and the save loop always see the latest list.
  const rowsRef = useRef<BatchRow[]>([]);
  const batchJobRef = useRef("");
  const readQueue = useRef<string[]>([]);
  const activeReads = useRef(0);
  const alive = useRef(true);
  const nextId = useRef(1);
  const checkKeys = useRef(new Map<string, string>());

  const updateRows = (fn: (current: BatchRow[]) => BatchRow[]) => {
    const next = fn(rowsRef.current);
    rowsRef.current = next;
    setRows(next);
  };
  const patchRow = (id: string, patch: Partial<BatchRow> | ((row: BatchRow) => BatchRow)) =>
    updateRows((current) => current.map((r) => (r.id === id ? (typeof patch === "function" ? patch(r) : { ...r, ...patch }) : r)));

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const row of rowsRef.current) URL.revokeObjectURL(row.previewUrl);
    };
  }, []);

  const doneSlips = rows.flatMap((r) => (r.result.status === "done" && r.result.slip ? [r.result.slip] : []));
  const pending = rows.filter((r) => r.result.status !== "done");
  const isDirty = pending.length > 0 || (doneSlips.length > 0 && !sheetSeen);
  const guard = useDirtyGuard({ isDirty: open && isDirty, message: "Some walk-ins are not saved, or their slips are not printed yet." });

  const checkDuplicates = async (row: BatchRow) => {
    if (row.existingUser || row.result.status === "done") return;
    const params = duplicateParamsFor(row);
    if (!params) return;
    const key = JSON.stringify(params);
    if (checkKeys.current.get(row.id) === key) return;
    checkKeys.current.set(row.id, key);
    patchRow(row.id, { checking: true });
    let matches: WalkInMatch[] = [];
    try {
      matches = (await taApi.checkWalkInDuplicate(params)).matches ?? [];
    } catch {
      // The check is a helper. Saving still works, and the server rejects true duplicate applications.
    }
    if (alive.current) patchRow(row.id, { matches, checking: false });
  };

  const finishRead = (id: string, read: WalkInBiodataRead | null) => {
    if (!alive.current) return;
    const current = rowsRef.current.find((r) => r.id === id);
    if (!current) return;
    // Rows only get empty fields filled, so anything typed while the file was being read stays.
    patchRow(id, (row) => applyRead(row, read));
    void checkDuplicates(applyRead(current, read));
  };

  const pumpReads = () => {
    while (activeReads.current < READ_CONCURRENCY && readQueue.current.length > 0) {
      const id = readQueue.current.shift() as string;
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row) continue;
      activeReads.current += 1;
      patchRow(id, { read: "reading" });
      // Any failure, including "too many reads right now", leaves the row for typing. Nothing is retried.
      taApi
        .readWalkInBiodata(row.file)
        .then((read) => finishRead(id, read))
        .catch(() => finishRead(id, null))
        .finally(() => {
          activeReads.current -= 1;
          pumpReads();
        });
    }
  };

  const addFiles = (files: File[]) => {
    const messages: string[] = [];
    const accepted: File[] = [];
    let room = MAX_BATCH_FILES - rowsRef.current.length;
    let leftOut = 0;
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        messages.push(`${file.name}: ${FILE_TYPE_MESSAGE}`);
      } else if (file.size > MAX_FILE_BYTES) {
        messages.push(`${file.name}: ${FILE_TOO_BIG_MESSAGE}`);
      } else if (room <= 0) {
        leftOut += 1;
      } else {
        accepted.push(file);
        room -= 1;
      }
    }
    if (leftOut > 0) messages.push(`Only ${MAX_BATCH_FILES} files at a time. ${leftOut} left out.`);
    setNotice(messages);
    if (accepted.length === 0) return;

    const added: BatchRow[] = accepted.map((file) => ({
      id: String(nextId.current++),
      file,
      previewUrl: URL.createObjectURL(file),
      read: "queued",
      positionApplied: "",
      firstName: "",
      middleName: "",
      lastName: "",
      mobileNumber: "",
      birthDate: "",
      gender: "",
      jobPostingId: batchJobRef.current,
      jobSource: batchJobRef.current ? "batch" : "none",
      existingUser: null,
      matches: [],
      dismissedIds: [],
      checking: false,
      result: { status: "idle" },
    }));
    updateRows((current) => [...current, ...added]);
    readQueue.current.push(...added.map((r) => r.id));
    pumpReads();
  };

  const removeRow = (id: string) => {
    const row = rowsRef.current.find((r) => r.id === id);
    if (row) URL.revokeObjectURL(row.previewUrl);
    checkKeys.current.delete(id);
    readQueue.current = readQueue.current.filter((queued) => queued !== id);
    updateRows((current) => current.filter((r) => r.id !== id));
  };

  const changeBatchJob = (value: string) => {
    batchJobRef.current = value;
    setBatchJob(value);
    // Rows the TA or the bio-data already chose a job for keep it.
    updateRows((current) =>
      current.map((r) =>
        r.jobSource === "none" || r.jobSource === "batch"
          ? { ...r, jobPostingId: value, jobSource: value ? "batch" : "none" }
          : r,
      ),
    );
  };

  const changeRow = (id: string, patch: Partial<BatchRow>) => {
    patchRow(id, patch);
    // Any edit to a row that failed to save clears the old error.
    patchRow(id, (row) => (row.result.status === "error" ? { ...row, result: { status: "idle" } } : row));
  };

  const readingCount = rows.filter((r) => r.read === "queued" || r.read === "reading").length;
  const incompleteCount = pending.filter((r) => rowProblems(r).length > 0).length;
  const canEncode = pending.length > 0 && readingCount === 0 && incompleteCount === 0 && !encoding;

  const encodeAll = async () => {
    setEncoding(true);
    let saved = 0;
    let failed = 0;
    for (const id of rowsRef.current.filter((r) => r.result.status !== "done").map((r) => r.id)) {
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row) continue;
      patchRow(id, { result: { status: "saving" } });
      const body = new FormData();
      body.append("file", row.file);
      body.append("jobPostingId", row.jobPostingId);
      body.append("firstName", row.firstName.trim());
      if (row.middleName.trim()) body.append("middleName", row.middleName.trim());
      body.append("lastName", row.lastName.trim());
      if (row.mobileNumber) body.append("mobileNumber", row.mobileNumber);
      body.append("birthDate", row.birthDate);
      body.append("gender", row.gender);
      if (row.existingUser) body.append("existingUserId", row.existingUser.userId);
      try {
        const slip = await taApi.createWalkIn(body);
        saved += 1;
        if (alive.current) patchRow(id, { result: { status: "done", slip } });
      } catch (error) {
        failed += 1;
        const message = Object.values(fieldErrorsFrom(error))[0] ?? formatErrorMessage(error);
        if (alive.current) patchRow(id, { result: { status: "error", message } });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
    queryClient.invalidateQueries({ queryKey: ["ta", "analytics"] });
    if (alive.current) setEncoding(false);
    if (failed === 0) notify.success("Walk-ins saved", `${saved} ${saved === 1 ? "applicant is" : "applicants are"} now in the pipeline.`);
    else notify.warning(`${saved} saved, ${failed} not saved`, "Fix the marked rows, then encode again.");
  };

  const requestClose = async () => {
    if (encoding) return;
    if (!(await guard.confirmDiscard())) return;
    onClose();
  };

  const full = rows.length >= MAX_BATCH_FILES;
  const blockedReason =
    pending.length === 0
      ? ""
      : readingCount > 0
        ? `Waiting for ${readingCount} ${readingCount === 1 ? "file" : "files"} to be read.`
        : incompleteCount > 0
          ? `${incompleteCount} ${incompleteCount === 1 ? "row needs" : "rows need"} details before you can encode.`
          : "";

  return (
    <>
      <Dialog
        open={open && !sheetOpen}
        onClose={() => void requestClose()}
        title="Encode several walk-ins"
        description="Add the biodata files. The details fill in from each one. Check every row, then encode all."
        size="xl"
        className="lg:max-w-6xl"
      >
        <div className="space-y-4">
          {jobsQuery.isError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <span>Could not load the open jobs.</span>
              <Button type="button" variant="outline" size="sm" loading={jobsQuery.isFetching} onClick={() => void jobsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <ComboBox
                id="batch-job"
                label="Job for this batch (optional)"
                placeholder="Search open jobs"
                options={jobOptions}
                value={batchJob}
                onChange={changeBatchJob}
                clearable
                disabled={encoding}
                loading={jobsQuery.isLoading}
                emptyText="No open jobs. Open a job first."
                helperText="Each row starts with this job. You can change a row."
              />
              <div className="space-y-1.5">
                <label htmlFor="batch-files" className="block text-xs font-medium text-slate-600">
                  Biodata photos or PDFs
                </label>
                <input
                  ref={fileInputRef}
                  id="batch-files"
                  type="file"
                  multiple
                  accept={ACCEPT_ATTRIBUTE}
                  disabled={full || encoding}
                  aria-describedby="batch-files-help"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []));
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="block w-full min-h-11 md:min-h-10 rounded-md border border-slate-300 bg-white text-sm text-slate-900 transition-colors hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-100 file:mr-3 file:h-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800"
                />
                <p id="batch-files-help" className="text-xs text-slate-500">
                  Up to {MAX_BATCH_FILES} files, 5 MB each. {rows.length > 0 ? `${rows.length} added.` : ""}
                </p>
              </div>
            </div>
          )}

          {notice.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {notice.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          {rows.length > 0 && (
            <ul className="divide-y divide-slate-200 border-y border-slate-200">
              {rows.map((row) => (
                <RowView
                  key={row.id}
                  row={row}
                  jobOptions={jobOptions}
                  jobsLoading={jobsQuery.isLoading}
                  locked={encoding}
                  onChange={(patch) => changeRow(row.id, patch)}
                  onJobChange={(value) => changeRow(row.id, { jobPostingId: value, jobSource: "manual" })}
                  onCheck={() => {
                    const latest = rowsRef.current.find((r) => r.id === row.id);
                    if (latest) void checkDuplicates(latest);
                  }}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
            {blockedReason && (
              <p role="status" className="mr-auto text-sm text-slate-600">
                {blockedReason}
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={encoding}>
              {doneSlips.length > 0 && pending.length === 0 ? "Close" : "Cancel"}
            </Button>
            {doneSlips.length > 0 && (
              <Button
                type="button"
                variant={pending.length > 0 ? "outline" : "primary"}
                disabled={encoding}
                onClick={() => {
                  setSheetSeen(true);
                  setSheetOpen(true);
                }}
              >
                Print all slips
              </Button>
            )}
            {pending.length > 0 && (
              <Button type="button" disabled={!canEncode} loading={encoding} onClick={() => void encodeAll()}>
                {doneSlips.length > 0 ? "Encode remaining" : "Encode all"}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
      <WalkInSlipSheetDialog open={open && sheetOpen} slips={doneSlips} onClose={() => setSheetOpen(false)} />
      {guard.discardDialog}
    </>
  );
};
