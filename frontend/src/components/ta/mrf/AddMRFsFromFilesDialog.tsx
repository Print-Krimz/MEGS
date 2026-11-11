import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../lib/api/client";
import { taApi, type MRFFileField, type MRFFileReading } from "../../../lib/api/ta.api";
import { DateField } from "../../common";
import { Button, Dialog, Input, Select, Textarea, ComboBox } from "../../ui";
import { FieldWarning } from "../FieldWarning";
import { fieldErrorsFrom, formatErrorMessage, notify } from "../../../lib/feedback";
import { useDirtyGuard } from "../../../hooks/useDirtyGuard";
import { EMPLOYMENT_TYPE_OPTIONS } from "../../../lib/hr-constants";
import { getManilaToday, salaryTextError, salaryRangeError } from "../../../lib/field-limits";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../../lib/query-policies";
import { validateStandardText, validateProseText } from "../../../lib/statutory-validation";
import {
  REQUEST_REASON_LABELS,
  WORK_DAYS_LABELS,
  WORK_SHIFT_LABELS,
  normalizeCompanyName,
  workHoursLabel,
} from "../../../lib/mrf-schedule";
import { plural } from "../../../lib/plural";
import type { CreateMRFDto } from "../../../lib/types/ta.types";

export const MAX_BATCH_FILES = 10;
/** The server limits AI reads per user, so only a couple run at once. */
const READ_CONCURRENCY = 2;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPT_ATTRIBUTE =
  "application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const ACCEPTED_EXTENSIONS = /\.(pdf|docx?|jpe?g|png|webp)$/i;

const FILE_TYPE_MESSAGE = "Use a PDF, Word file, or JPG, PNG or WEBP photo.";
const FILE_TOO_BIG_MESSAGE = "The file is over 5 MB. Use a smaller file.";
const UNREADABLE_MESSAGE = "Couldn't read this file. Fill the fields by hand.";
const LIMIT_MESSAGE = "Hourly AI limit reached. Fill this row by hand or try later.";
const NOTE_TEXT = {
  uncertain: "Check this — read from the file.",
  invalid: "Couldn't read a valid value. Enter it manually.",
  missing: "Not found in the file.",
} as const;

/** The fields a row lets the TA edit. Everything else the AI read is kept as read. */
type DraftKey =
  | "title"
  | "description"
  | "headcount"
  | "priority"
  | "targetFillDate"
  | "location"
  | "employmentType"
  | "salaryRangeMin"
  | "salaryRangeMax";
type MRFDraft = Record<DraftKey, string>;
const DRAFT_KEYS: DraftKey[] = [
  "title",
  "description",
  "headcount",
  "priority",
  "targetFillDate",
  "location",
  "employmentType",
  "salaryRangeMin",
  "salaryRangeMax",
];

/** Page defaults count as empty: a read may replace them without asking. */
const DEFAULT_DRAFT: MRFDraft = {
  title: "",
  description: "",
  headcount: "1",
  priority: "NORMAL",
  targetFillDate: "",
  location: "",
  employmentType: "Contractual",
  salaryRangeMin: "",
  salaryRangeMax: "",
};

/** Error keys that have an input on the row. Other server errors show in the row message. */
const INLINE_KEYS: string[] = [...DRAFT_KEYS];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent (critical need)" },
];

type ExtraKey = Exclude<MRFFileField, DraftKey>;
/** Read-only values, in the order they are listed, with the labels the request form uses. */
const EXTRA_LABELS: Array<[ExtraKey, string]> = [
  ["ageMin", "Minimum age"],
  ["ageMax", "Maximum age"],
  ["genderPreference", "Gender preference"],
  ["tattooPolicy", "Tattoo policy"],
  ["workArrangement", "Work arrangement"],
  ["requiredSkills", "Skills"],
  ["requiredExperience", "Experience"],
  ["requiredEducation", "Education"],
  ["requiredCertifications", "Certifications and licenses"],
  ["department", "Department"],
  ["workShift", "Shift"],
  ["workDays", "Work days"],
  ["workHoursPerDay", "Hours per day"],
  ["workTime", "Work time"],
  ["requestReason", "Reason for request"],
  ["requestReasonNote", "Reason"],
];
type Extras = Partial<Record<ExtraKey, string | number>>;

interface BatchRow {
  id: string;
  file: File;
  read: "queued" | "reading" | "read" | "unreadable" | "limit";
  draft: MRFDraft;
  extras: Extras;
  companyName: string;
  issues: MRFFileReading["issues"];
  serverErrors: Record<string, string>;
  expanded: boolean;
  status: "idle" | "saving" | "done" | "error";
  message?: string;
  saved?: { id: number; title: string };
}

const isAcceptedFile = (file: File) => ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.test(file.name);

const isWaiting = (row: BatchRow) => row.read === "queued" || row.read === "reading";

/** "NO_VISIBLE" reads as "No visible". Free text is left alone. */
const readable = (value: string): string =>
  /^[A-Z_]+$/.test(value) ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") : value;

const extraDisplay = (key: ExtraKey, raw: string | number): string => {
  const value = String(raw).trim();
  if (key === "workShift") return WORK_SHIFT_LABELS[value as keyof typeof WORK_SHIFT_LABELS] ?? readable(value);
  if (key === "workDays") return WORK_DAYS_LABELS[value as keyof typeof WORK_DAYS_LABELS] ?? readable(value);
  if (key === "requestReason") return REQUEST_REASON_LABELS[value as keyof typeof REQUEST_REASON_LABELS] ?? readable(value);
  if (key === "workHoursPerDay" && value) return workHoursLabel(Number(value));
  return readable(value);
};

/** A draft field counts as empty when blank or still at its default. */
const isEmptyDraftField = (draft: MRFDraft, key: DraftKey) => {
  const value = draft[key].trim();
  return value === "" || value === DEFAULT_DRAFT[key];
};

const clientLabel = (client: { name: string; tradeName?: string | null }) =>
  client.tradeName ? `${client.name} (${client.tradeName})` : client.name;

/** Pure checks for one row. Empty when the row can be saved. */
const validateDraft = (draft: MRFDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!draft.title.trim()) errors.title = "Enter a request title.";
  else {
    const problem = validateStandardText(draft.title, "Request title", { maxLength: 200 });
    if (problem) errors.title = problem;
  }

  if (!draft.description.trim()) errors.description = "Describe the role and its responsibilities.";
  else {
    const problem = validateProseText(draft.description, "Job description and responsibilities", { maxLength: 10000 });
    if (problem) errors.description = problem;
  }

  const headcount = Number(draft.headcount);
  if (draft.headcount.trim() === "" || !Number.isInteger(headcount) || headcount < 1 || headcount > 1000) {
    errors.headcount = "Enter a whole number from 1 to 1,000.";
  }

  if (draft.location.trim()) {
    const problem = validateStandardText(draft.location, "Location", { maxLength: 200 });
    if (problem) errors.location = problem;
  }

  if (draft.targetFillDate && draft.targetFillDate < getManilaToday()) {
    errors.targetFillDate = "Choose today or a later date.";
  }

  const minProblem = salaryTextError(draft.salaryRangeMin);
  const maxProblem = salaryTextError(draft.salaryRangeMax);
  if (minProblem) errors.salaryRangeMin = minProblem;
  if (maxProblem) errors.salaryRangeMax = maxProblem;
  if (!minProblem && !maxProblem) {
    const rangeProblem = salaryRangeError(draft.salaryRangeMin, draft.salaryRangeMax);
    if (rangeProblem) errors.salaryRangeMax = rangeProblem;
  }

  return errors;
};

const emptyDraft = (): MRFDraft => ({ ...DEFAULT_DRAFT });

/** The company on the form, when it is neither the chosen client's name nor its brand name. */
const companyMismatch = (companyName: string, client?: { name: string; tradeName?: string | null }) => {
  const wanted = normalizeCompanyName(companyName);
  if (!wanted || !client) return false;
  return ![client.name, client.tradeName ?? ""].some((value) => normalizeCompanyName(value) === wanted);
};

/** Notes from the read, shown only while they still apply to what is in the field. */
const notesFor = (row: BatchRow): Partial<Record<DraftKey, string>> => {
  const notes: Partial<Record<DraftKey, string>> = {};
  for (const [key, issue] of Object.entries(row.issues ?? {}) as Array<[MRFFileField, keyof typeof NOTE_TEXT]>) {
    if (!DRAFT_KEYS.includes(key as DraftKey)) continue;
    const draftKey = key as DraftKey;
    if (issue === "uncertain" ? !isEmptyDraftField(row.draft, draftKey) : isEmptyDraftField(row.draft, draftKey)) {
      notes[draftKey] = NOTE_TEXT[issue];
    }
  }
  // One note is enough when no salary was found.
  if (notes.salaryRangeMax === NOTE_TEXT.missing && notes.salaryRangeMin === NOTE_TEXT.missing) delete notes.salaryRangeMax;
  return notes;
};

const toCreateDto = (clientId: number, row: BatchRow): CreateMRFDto => {
  const d = row.draft;
  return {
    ...(row.extras as Partial<CreateMRFDto>),
    clientId,
    title: d.title.trim(),
    description: d.description.trim(),
    headcount: Number(d.headcount),
    priority: d.priority as CreateMRFDto["priority"],
    location: d.location.trim() || undefined,
    targetFillDate: d.targetFillDate || undefined,
    employmentType: d.employmentType.trim() || undefined,
    salaryRangeMin: d.salaryRangeMin ? Number(d.salaryRangeMin) : undefined,
    salaryRangeMax: d.salaryRangeMax ? Number(d.salaryRangeMax) : undefined,
  };
};

const rowErrorText = (row: BatchRow): string => {
  const parts = [row.message, ...Object.entries(row.serverErrors).filter(([k]) => !INLINE_KEYS.includes(k)).map(([, m]) => m)]
    .filter((m): m is string => Boolean(m))
    .map((m) => m.replace(/\.+$/, ""));
  return `Not saved. ${Array.from(new Set(parts)).join(". ")}.`;
};

interface RowViewProps {
  row: BatchRow;
  number: number;
  client?: { name: string; tradeName?: string | null };
  locked: boolean;
  onChange: (patch: Partial<MRFDraft>) => void;
  onToggle: () => void;
  onRemove: () => void;
}

const RowView: React.FC<RowViewProps> = ({ row, number, client, locked, onChange, onToggle, onRemove }) => {
  const done = row.status === "done";
  const waiting = isWaiting(row);
  const errors = { ...(waiting || done ? {} : validateDraft(row.draft)), ...row.serverErrors };
  const notes = notesFor(row);
  const idPrefix = `mrf-files-row-${row.id}`;
  const bodyId = `${idPrefix}-body`;
  const disabled = locked || row.status === "saving";
  const mismatch = !done && !waiting && companyMismatch(row.companyName, client);
  const extras = EXTRA_LABELS.filter(([key]) => String(row.extras[key] ?? "").trim() !== "");
  const note = (key: DraftKey) => <FieldWarning show={Boolean(notes[key])}>{notes[key] ?? null}</FieldWarning>;

  return (
    <li aria-labelledby={`${idPrefix}-title`} className="space-y-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p id={`${idPrefix}-title`} className="truncate text-sm font-medium text-slate-900">
            {number}. {row.file.name}
          </p>
          {waiting && (
            <p role="status" className="text-xs text-slate-600">
              {row.read === "queued" ? "Waiting to be read…" : "Reading…"}
            </p>
          )}
          {row.read === "unreadable" && !done && <p className="text-xs text-slate-600">{UNREADABLE_MESSAGE}</p>}
          {row.read === "limit" && !done && <p className="text-xs text-slate-600">{LIMIT_MESSAGE}</p>}
          {row.status === "saving" && (
            <p role="status" className="text-xs text-slate-600">
              Saving…
            </p>
          )}
          {done && row.saved && (
            <p role="status" className="text-xs font-medium text-emerald-800">
              Added.{" "}
              <Link
                to="/ta/mrfs/$mrfId"
                params={{ mrfId: String(row.saved.id) }}
                className="underline underline-offset-2 focus-ring"
              >
                {row.saved.title}
              </Link>
            </p>
          )}
          {row.status === "error" && (
            <p role="alert" className="text-xs font-medium text-rose-700">
              {rowErrorText(row)}
            </p>
          )}
          {mismatch && client && (
            <p className="text-xs font-medium text-amber-800">
              This form names "{row.companyName}", not {client.name}.
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {!done && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 md:min-h-8"
              aria-expanded={row.expanded}
              aria-controls={bodyId}
              onClick={onToggle}
            >
              {row.expanded ? "Hide details" : "Show details"}
            </Button>
          )}
          {!done && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 md:min-h-8"
              disabled={locked}
              onClick={onRemove}
              aria-label={`Remove ${row.file.name}`}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {!done && (
        <div id={bodyId} hidden={!row.expanded} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Input
                id={`${idPrefix}-title-input`}
                label="Request title"
                value={row.draft.title}
                error={errors.title}
                disabled={disabled}
                onChange={(e) => onChange({ title: e.target.value })}
                required
              />
              {note("title")}
            </div>
            <div className="space-y-1.5">
              <Input
                id={`${idPrefix}-location`}
                label="Work site"
                placeholder="e.g. Calamba, Laguna"
                value={row.draft.location}
                error={errors.location}
                disabled={disabled}
                onChange={(e) => onChange({ location: e.target.value })}
              />
              {note("location")}
            </div>
          </div>
          <div className="space-y-1.5">
            <Textarea
              id={`${idPrefix}-description`}
              label="Job description and responsibilities"
              value={row.draft.description}
              error={errors.description}
              disabled={disabled}
              rows={3}
              maxLength={10000}
              onChange={(e) => onChange({ description: e.target.value })}
              required
            />
            {note("description")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Input
                id={`${idPrefix}-headcount`}
                label="Number of workers needed"
                type="number"
                min={1}
                max={1000}
                value={row.draft.headcount}
                error={errors.headcount}
                disabled={disabled}
                onChange={(e) => onChange({ headcount: e.target.value })}
                required
              />
              {note("headcount")}
            </div>
            <div className="space-y-1.5">
              <Select
                label="Priority"
                value={row.draft.priority}
                error={errors.priority}
                disabled={disabled}
                onChange={(e) => onChange({ priority: e.target.value })}
                options={PRIORITY_OPTIONS}
              />
              {note("priority")}
            </div>
            <div className="space-y-1.5">
              <DateField
                label="Target fill date"
                min={getManilaToday()}
                value={row.draft.targetFillDate}
                error={errors.targetFillDate}
                disabled={disabled}
                onChange={(e) => onChange({ targetFillDate: e.target.value })}
              />
              {note("targetFillDate")}
            </div>
            <div className="space-y-1.5">
              <ComboBox
                id={`${idPrefix}-employment`}
                label="Employment type"
                placeholder="Select employment type"
                value={row.draft.employmentType}
                error={errors.employmentType}
                disabled={disabled}
                onChange={(val) => onChange({ employmentType: val || "Contractual" })}
                options={EMPLOYMENT_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
                allowCustom
              />
              {note("employmentType")}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Input
                id={`${idPrefix}-salary-min`}
                label="Minimum monthly salary (PHP)"
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                value={row.draft.salaryRangeMin}
                error={errors.salaryRangeMin}
                disabled={disabled}
                onChange={(e) => onChange({ salaryRangeMin: e.target.value })}
              />
              {note("salaryRangeMin")}
            </div>
            <div className="space-y-1.5">
              <Input
                id={`${idPrefix}-salary-max`}
                label="Maximum monthly salary (PHP)"
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                value={row.draft.salaryRangeMax}
                error={errors.salaryRangeMax}
                disabled={disabled}
                onChange={(e) => onChange({ salaryRangeMax: e.target.value })}
              />
              {note("salaryRangeMax")}
            </div>
          </div>
          {extras.length > 0 && (
            <details className="rounded-md border border-slate-200 px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-slate-900 focus-ring md:min-h-9">
                Also read from the file
              </summary>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1 pb-3 text-sm sm:grid-cols-2">
                {extras.map(([key, label]) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-xs text-slate-600">{label}</dt>
                    <dd className="break-words text-slate-900">{extraDisplay(key, row.extras[key] as string | number)}</dd>
                  </div>
                ))}
              </dl>
              <p className="pb-3 text-xs text-slate-600">You can change these on the MRF after saving.</p>
            </details>
          )}
        </div>
      )}
    </li>
  );
};

interface AddMRFsFromFilesDialogProps {
  open: boolean;
  onClose: () => void;
  /** Preselects the client, for example when opened from a client page. */
  clientId?: number;
}

export const AddMRFsFromFilesDialog: React.FC<AddMRFsFromFilesDialogProps> = ({ open, onClose, clientId: presetClientId }) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [notice, setNotice] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<number>(presetClientId ?? 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Rows live in a ref as well, so the read queue and the save loop always see the latest list.
  const rowsRef = useRef<BatchRow[]>([]);
  const readQueue = useRef<string[]>([]);
  const activeReads = useRef(0);
  const alive = useRef(true);
  const nextId = useRef(1);
  const clientIdRef = useRef(clientId);
  clientIdRef.current = clientId;

  const clientsQuery = useQuery({
    queryKey: ["ta", "clients"],
    queryFn: taApi.listClients,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
    enabled: open,
  });
  const clients = clientsQuery.data || [];
  const selectedClient = clients.find((c) => c.id === clientId);

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
      // Closing the dialog stops reads that have not started, so they do not use up the hourly AI limit.
      readQueue.current = [];
    };
  }, []);

  const pending = rows.filter((r) => r.status !== "done");
  const anySaved = rows.some((r) => r.status === "done");
  const guard = useDirtyGuard({ isDirty: open && pending.length > 0, message: "Some MRFs are not added yet." });

  const finishRead = (id: string, outcome: MRFFileReading | "limit" | null) => {
    if (!alive.current) return;
    const readOk = outcome && outcome !== "limit" && outcome.status === "SUCCESS" ? outcome : null;
    // Rows only get empty fields filled, so anything typed while the file was being read stays.
    patchRow(id, (row) => {
      if (!readOk) return { ...row, read: outcome === "limit" ? "limit" : "unreadable" };
      const fields = (readOk.fields ?? {}) as Record<string, string | number | undefined>;
      const draft = { ...row.draft };
      for (const key of DRAFT_KEYS) {
        const value = fields[key];
        if (value !== undefined && value !== null && String(value).trim() && isEmptyDraftField(draft, key)) {
          draft[key] = String(value).trim();
        }
      }
      const extras: Extras = {};
      for (const [key] of EXTRA_LABELS) {
        const value = fields[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") extras[key] = value;
      }
      return { ...row, read: "read", draft, extras, companyName: readOk.companyName?.trim() ?? "", issues: readOk.issues ?? {} };
    });
  };

  const pumpReads = () => {
    if (!alive.current) return;
    while (activeReads.current < READ_CONCURRENCY && readQueue.current.length > 0) {
      const id = readQueue.current.shift() as string;
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row) continue;
      activeReads.current += 1;
      patchRow(id, { read: "reading" });
      // Any failure leaves the row for typing. Nothing is retried.
      taApi
        .readMRFFile(row.file)
        .then((read) => finishRead(id, read))
        .catch((error) => {
          const limited = error instanceof ApiError && error.status === 429;
          if (limited) {
            // The hourly limit is used up, so the rows still waiting are not sent.
            const waitingIds = readQueue.current;
            readQueue.current = [];
            if (alive.current) updateRows((current) => current.map((r) => (waitingIds.includes(r.id) ? { ...r, read: "limit" } : r)));
          }
          finishRead(id, limited ? "limit" : null);
        })
        .finally(() => {
          activeReads.current -= 1;
          pumpReads();
        });
    }
  };

  const addFiles = (files: File[]) => {
    if (!clientIdRef.current) return;
    const messages: string[] = [];
    const accepted: File[] = [];
    let room = MAX_BATCH_FILES - rowsRef.current.length;
    let leftOut = 0;
    for (const file of files) {
      if (!isAcceptedFile(file)) {
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
      read: "queued",
      draft: emptyDraft(),
      extras: {},
      companyName: "",
      issues: {},
      serverErrors: {},
      expanded: true,
      status: "idle",
    }));
    updateRows((current) => [...current, ...added]);
    readQueue.current.push(...added.map((r) => r.id));
    pumpReads();
  };

  const removeRow = (id: string) => {
    readQueue.current = readQueue.current.filter((queued) => queued !== id);
    updateRows((current) => current.filter((r) => r.id !== id));
  };

  const changeRow = (id: string, patch: Partial<MRFDraft>) => {
    const salaryChanged = "salaryRangeMin" in patch || "salaryRangeMax" in patch;
    patchRow(id, (row) => {
      // Errors for fields with no input on the row (shown in the row message) go on any edit.
      const stale = [
        ...Object.keys(patch),
        ...(salaryChanged ? ["salaryRangeMin", "salaryRangeMax"] : []),
        ...Object.keys(row.serverErrors).filter((k) => !INLINE_KEYS.includes(k)),
      ];
      const serverErrors = { ...row.serverErrors };
      for (const key of stale) delete serverErrors[key];
      return {
        ...row,
        draft: { ...row.draft, ...patch },
        serverErrors,
        // Any edit to a row that failed to save clears the old error.
        status: row.status === "error" ? "idle" : row.status,
        message: row.status === "error" ? undefined : row.message,
      };
    });
  };

  const isReady = (row: BatchRow) =>
    row.status !== "done" &&
    row.status !== "saving" &&
    !isWaiting(row) &&
    Object.keys(row.serverErrors).length === 0 &&
    Object.keys(validateDraft(row.draft)).length === 0;

  const readingCount = rows.filter(isWaiting).length;
  const readyCount = rows.filter(isReady).length;
  const savingCount = rows.filter((r) => r.status === "saving").length;
  const needFixCount = pending.length - readyCount - readingCount - savingCount;
  const canAdd = readyCount > 0 && !saving && Boolean(clientId);

  const addingRef = useRef(false);
  const addAll = async () => {
    if (addingRef.current) return;
    addingRef.current = true;
    setSaving(true);
    let saved = 0;
    let failed = 0;
    const ids = rowsRef.current.filter(isReady).map((r) => r.id);
    try {
      for (const id of ids) {
        const row = rowsRef.current.find((r) => r.id === id);
        if (!row) continue;
        patchRow(id, { status: "saving", message: undefined });
        try {
          const mrf = await taApi.createMRF(toCreateDto(clientIdRef.current, row));
          saved += 1;
          if (alive.current) patchRow(id, { status: "done", saved: { id: mrf.id, title: mrf.title } });
        } catch (error) {
          failed += 1;
          const fieldErrors = fieldErrorsFrom(error);
          const message = Object.values(fieldErrors)[0] ?? formatErrorMessage(error);
          if (alive.current) patchRow(id, { status: "error", message, serverErrors: fieldErrors });
        }
      }
    } finally {
      addingRef.current = false;
      if (alive.current) setSaving(false);
    }
    queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
    queryClient.invalidateQueries({ queryKey: ["ta", "clients"] });
    if (saved > 0 && failed === 0) notify.success(`${plural(saved, "MRF")} added`);
    else if (saved > 0) notify.warning(`${saved} added, ${failed} need fixes`, "Fix the marked rows, then add again.");
    else if (failed > 0) notify.error(`${plural(failed, "MRF")} not added`, "Fix the marked rows, then add again.");
  };

  const requestClose = async () => {
    if (saving) return;
    if (!(await guard.confirmDiscard())) return;
    onClose();
  };

  const full = rows.length >= MAX_BATCH_FILES;
  const pickerOff = full || saving || !clientId;
  const blockedReason =
    pending.length === 0
      ? ""
      : readingCount > 0
        ? `Waiting for ${plural(readingCount, "file")} to be read.`
        : needFixCount > 0
          ? `${plural(needFixCount, "row")} can't be added yet. Fix or remove ${needFixCount === 1 ? "it" : "them"}.`
          : "";

  const clientOptions = clients.map((c) => ({
    value: String(c.id),
    label: clientLabel(c),
    subtitle: `${c.industry || "General industry"} • ${[c.city, c.province].filter(Boolean).join(", ") || c.address || "Philippines"}`,
  }));

  return (
    <>
      <Dialog
        open={open}
        onClose={() => void requestClose()}
        title="Add MRFs from files"
        description="Choose a client, then add one file per request. The details fill in from each file. Check each row, then add."
        size="xl"
        className="lg:max-w-6xl"
      >
        <div className="space-y-4">
          <div className="max-w-md space-y-1.5">
            <ComboBox
              id="mrf-files-client"
              label="Client"
              placeholder="Search or select client account..."
              value={clientId ? String(clientId) : ""}
              onChange={(val) => setClientId(Number(val) || 0)}
              options={clientOptions}
              loading={clientsQuery.isLoading}
              emptyText="No client accounts match your search"
              disabled={saving || anySaved}
              required
            />
            {anySaved && <p className="text-xs text-slate-600">The client can't change after an MRF is added.</p>}
          </div>

          <div
            onDragOver={(e) => {
              if (pickerOff) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!pickerOff) addFiles(Array.from(e.dataTransfer.files ?? []));
            }}
            className={`rounded-md border-2 border-dashed px-4 text-center transition-colors ${
              rows.length === 0 ? "flex min-h-48 flex-col items-center justify-center gap-2 py-8" : "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-3"
            } ${dragging ? "border-navy bg-navy-soft" : "border-slate-300 bg-slate-50"}`}
          >
            <label htmlFor="mrf-files" className={rows.length === 0 ? "text-base font-medium text-slate-900" : "text-sm font-medium text-slate-800"}>
              {rows.length === 0 ? "Drop MRF files here" : "Add more files"}
              <span className="sr-only"> (PDF, Word or photo files)</span>
            </label>
            <input
              ref={fileInputRef}
              id="mrf-files"
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              disabled={pickerOff}
              aria-describedby="mrf-files-help"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="sr-only"
            />
            <Button type="button" variant="outline" size={rows.length === 0 ? "md" : "sm"} disabled={pickerOff} onClick={() => fileInputRef.current?.click()}>
              Choose files
            </Button>
            <p id="mrf-files-help" className="text-xs text-slate-500">
              {clientId
                ? `PDF, Word or photo files, up to ${MAX_BATCH_FILES} files, 5 MB each.${rows.length > 0 ? ` ${rows.length} added.` : ""}`
                : "Choose a client first."}
            </p>
          </div>

          {notice.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {notice.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          {rows.length > 0 && (
            <ul className="divide-y divide-slate-200 border-y border-slate-200">
              {rows.map((row, index) => (
                <RowView
                  key={row.id}
                  row={row}
                  number={index + 1}
                  client={selectedClient}
                  locked={saving}
                  onChange={(patch) => changeRow(row.id, patch)}
                  onToggle={() => patchRow(row.id, { expanded: !row.expanded })}
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
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {pending.length === 0 && rows.length > 0 ? "Close" : "Cancel"}
            </Button>
            {pending.length > 0 && (
              <Button type="button" disabled={!canAdd} loading={saving} onClick={() => void addAll()}>
                {readyCount > 0 ? `Add ${plural(readyCount, "MRF")}` : "Add MRFs"}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
      {guard.discardDialog}
    </>
  );
};
