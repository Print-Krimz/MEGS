import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../lib/api/client";
import { taApi } from "../../../lib/api/ta.api";
import { Button, Dialog } from "../../ui";
import { fieldErrorsFrom, formatErrorMessage, notify } from "../../../lib/feedback";
import { useDirtyGuard } from "../../../hooks/useDirtyGuard";
import { normalizeCompanyName } from "../../../lib/mrf-schedule";
import { plural } from "../../../lib/plural";
import type { ClientFileReading, ClientReadFieldKey } from "../../../lib/types/client.types";
import {
  ClientFields,
  emptyClientDraft,
  errorKeysFor,
  toCreateClientDto,
  validateClientDraft,
  withoutErrors,
  type ClientDraft,
  type ClientFieldNotes,
} from "./ClientFields";

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
/** Error keys that have an input (or the address block) on the form. Other server errors show in the row message. */
const INLINE_KEYS = ["name", "tradeName", "industry", "contactName", "contactEmail", "contactPhone", "street", "address", "postalCode", "province", "city", "barangay"];
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

interface DuplicateNotice {
  label: string;
  /** Set when the match is one of this TA's own clients, so the notice can link to it. */
  clientId?: number;
}

interface BatchRow {
  id: string;
  file: File;
  read: "queued" | "reading" | "read" | "unreadable" | "limit";
  draft: ClientDraft;
  issues: ClientFileReading["issues"];
  serverErrors: Record<string, string>;
  duplicate: DuplicateNotice | null;
  expanded: boolean;
  status: "idle" | "saving" | "done" | "error";
  message?: string;
  savedClient?: { id: number; name: string };
}

const isAcceptedFile = (file: File) => ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.test(file.name);

const isWaiting = (row: BatchRow) => row.read === "queued" || row.read === "reading";

const draftFromReading = (read: ClientFileReading): ClientDraft => {
  const next = { ...emptyClientDraft };
  for (const [key, value] of Object.entries(read.fields ?? {})) {
    if (key in next && typeof value === "string") next[key as keyof ClientDraft] = value.trim();
  }
  return next;
};

/** Company names on a row, normalized, for spotting the same company twice in one batch. */
const companyKeys = (draft: ClientDraft) =>
  [draft.name, draft.tradeName].map((value) => normalizeCompanyName(value)).filter(Boolean);

/** Row id -> the number of the earlier row it repeats. Only the second and later rows are flagged. */
const batchDuplicates = (rows: BatchRow[]): Map<string, number> => {
  const seen = new Map<string, number>();
  const flagged = new Map<string, number>();
  rows.forEach((row, index) => {
    const keys = companyKeys(row.draft);
    const earlier = keys.map((key) => seen.get(key)).find((n) => n !== undefined);
    if (earlier !== undefined) flagged.set(row.id, earlier);
    for (const key of keys) if (!seen.has(key)) seen.set(key, index + 1);
  });
  return flagged;
};

/** Notes from the read, shown only while they still apply to what is in the field. */
const notesFor = (row: BatchRow): ClientFieldNotes => {
  const notes: ClientFieldNotes = {};
  for (const [key, issue] of Object.entries(row.issues ?? {}) as Array<[ClientReadFieldKey, keyof typeof NOTE_TEXT]>) {
    const filled = Boolean(row.draft[key as keyof ClientDraft]?.trim());
    if (issue === "uncertain" ? filled : !filled) notes[key] = NOTE_TEXT[issue];
  }
  return notes;
};

interface RowViewProps {
  row: BatchRow;
  number: number;
  batchDuplicateOf?: number;
  locked: boolean;
  onChange: (patch: Partial<ClientDraft>) => void;
  onCheck: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

const RowView: React.FC<RowViewProps> = ({ row, number, batchDuplicateOf, locked, onChange, onCheck, onToggle, onRemove }) => {
  const done = row.status === "done";
  const waiting = isWaiting(row);
  const errors = { ...(waiting || done ? {} : validateClientDraft(row.draft)), ...row.serverErrors };
  const idPrefix = `files-row-${row.id}`;
  const bodyId = `${idPrefix}-body`;

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
          {done && row.savedClient && (
            <p role="status" className="text-xs font-medium text-emerald-800">
              Added.{" "}
              <Link
                to="/ta/clients/$clientId"
                params={{ clientId: String(row.savedClient.id) }}
                className="underline underline-offset-2 focus-ring"
              >
                {row.savedClient.name}
              </Link>
            </p>
          )}
          {row.status === "error" && !row.duplicate && (
            <p role="alert" className="text-xs font-medium text-rose-700">
              Not saved.{" "}
              {[row.message, ...Object.entries(row.serverErrors).filter(([k, m]) => !INLINE_KEYS.includes(k) && m !== row.message).map(([, m]) => m)]
                .filter(Boolean)
                .join(" ")}
            </p>
          )}
          {!done && (row.duplicate || batchDuplicateOf !== undefined) && (
            <p role="alert" className="text-xs font-medium text-rose-700">
              {row.duplicate ? (
                row.duplicate.clientId !== undefined ? (
                  <>
                    Already a client:{" "}
                    <Link
                      to="/ta/clients/$clientId"
                      params={{ clientId: String(row.duplicate.clientId) }}
                      className="underline underline-offset-2 focus-ring"
                    >
                      {row.duplicate.label}
                    </Link>
                  </>
                ) : (
                  row.duplicate.label.replace(/\.$/, "")
                )
              ) : (
                `Same company as row ${batchDuplicateOf}`
              )}
              . This row won't be added.
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
        <div id={bodyId} hidden={!row.expanded} onBlur={onCheck}>
          <ClientFields
            idPrefix={idPrefix}
            value={row.draft}
            errors={errors}
            notes={notesFor(row)}
            disabled={locked || row.status === "saving"}
            onChange={onChange}
          />
        </div>
      )}
    </li>
  );
};

interface AddClientsFromFilesDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AddClientsFromFilesDialog: React.FC<AddClientsFromFilesDialogProps> = ({ open, onClose }) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [notice, setNotice] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Rows live in a ref as well, so the read queue and the save loop always see the latest list.
  const rowsRef = useRef<BatchRow[]>([]);
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
      // Closing the dialog stops reads that have not started, so they do not use up the hourly AI limit.
      readQueue.current = [];
    };
  }, []);

  const pending = rows.filter((r) => r.status !== "done");
  const guard = useDirtyGuard({ isDirty: open && pending.length > 0, message: "Some clients are not added yet." });

  const checkDuplicate = async (row: BatchRow) => {
    if (row.status === "done") return;
    const name = row.draft.name.trim();
    const tradeName = row.draft.tradeName.trim();
    const key = JSON.stringify([normalizeCompanyName(name), normalizeCompanyName(tradeName)]);
    if (checkKeys.current.get(row.id) === key) return;
    checkKeys.current.set(row.id, key);
    if (!name && !tradeName) {
      patchRow(row.id, { duplicate: null });
      return;
    }
    let match: { id: number; name: string; yours: boolean } | null = null;
    try {
      match = (await taApi.checkClientDuplicate({ name, tradeName })).match;
    } catch {
      // The check is a helper. Saving still works, and the server rejects a true duplicate.
      checkKeys.current.delete(row.id);
      return;
    }
    if (!alive.current || checkKeys.current.get(row.id) !== key) return;
    patchRow(row.id, { duplicate: match ? { label: match.name, clientId: match.yours ? match.id : undefined } : null });
  };

  const finishRead = (id: string, outcome: ClientFileReading | "limit" | null) => {
    if (!alive.current) return;
    const current = rowsRef.current.find((r) => r.id === id);
    if (!current) return;
    const readOk = outcome && outcome !== "limit" && outcome.status === "SUCCESS" ? outcome : null;
    // Rows only get empty fields filled, so anything typed while the file was being read stays.
    const apply = (row: BatchRow): BatchRow => {
      if (!readOk) return { ...row, read: outcome === "limit" ? "limit" : "unreadable" };
      const read = draftFromReading(readOk);
      const draft = { ...row.draft };
      for (const key of Object.keys(draft) as Array<keyof ClientDraft>) if (!draft[key].trim()) draft[key] = read[key];
      return { ...row, read: "read", draft, issues: readOk.issues ?? {} };
    };
    patchRow(id, apply);
    void checkDuplicate(apply(current));
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
        .readClientFile(row.file)
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
      draft: { ...emptyClientDraft },
      issues: {},
      serverErrors: {},
      duplicate: null,
      expanded: true,
      status: "idle",
    }));
    updateRows((current) => [...current, ...added]);
    readQueue.current.push(...added.map((r) => r.id));
    pumpReads();
  };

  const removeRow = (id: string) => {
    checkKeys.current.delete(id);
    readQueue.current = readQueue.current.filter((queued) => queued !== id);
    updateRows((current) => current.filter((r) => r.id !== id));
  };

  const changeRow = (id: string, patch: Partial<ClientDraft>) => {
    const namesChanged = "name" in patch || "tradeName" in patch;
    if (namesChanged) checkKeys.current.delete(id);
    patchRow(id, (row) => ({
      ...row,
      draft: { ...row.draft, ...patch },
      // Errors for fields with no input on the form (shown in the row message) go on any edit.
      serverErrors: withoutErrors(row.serverErrors, [
        ...errorKeysFor(patch),
        ...(namesChanged ? ["name", "tradeName"] : []),
        ...Object.keys(row.serverErrors).filter((k) => !INLINE_KEYS.includes(k)),
      ]),
      // A changed name is checked again when the TA leaves the field.
      duplicate: namesChanged ? null : row.duplicate,
      // Any edit to a row that failed to save clears the old error.
      status: row.status === "error" ? "idle" : row.status,
      message: row.status === "error" ? undefined : row.message,
    }));
  };

  const duplicateOf = batchDuplicates(rows);
  const isReady = (row: BatchRow) =>
    row.status !== "done" &&
    row.status !== "saving" &&
    !isWaiting(row) &&
    !row.duplicate &&
    !duplicateOf.has(row.id) &&
    Object.keys(row.serverErrors).length === 0 &&
    Object.keys(validateClientDraft(row.draft)).length === 0;

  const readingCount = rows.filter(isWaiting).length;
  const readyCount = rows.filter(isReady).length;
  const savingCount = rows.filter((r) => r.status === "saving").length;
  const needFixCount = pending.length - readyCount - readingCount - savingCount;
  const canAdd = readyCount > 0 && !saving;

  const addingRef = useRef(false);
  const addAll = async () => {
    if (addingRef.current) return;
    addingRef.current = true;
    setSaving(true);
    let saved = 0;
    let failed = 0;
    const ids = rowsRef.current
      .filter(isReady)
      .map((r) => r.id);
    for (const id of ids) {
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row) continue;
      patchRow(id, { status: "saving", message: undefined });
      try {
        const client = await taApi.createClient(toCreateClientDto(row.draft));
        saved += 1;
        if (alive.current) patchRow(id, { status: "done", savedClient: { id: client.id, name: client.name } });
      } catch (error) {
        failed += 1;
        const fieldErrors = fieldErrorsFrom(error);
        const message = Object.values(fieldErrors)[0] ?? formatErrorMessage(error);
        const conflict = error instanceof ApiError && error.status === 409;
        if (alive.current) {
          patchRow(id, {
            status: "error",
            message,
            serverErrors: conflict ? {} : fieldErrors,
            duplicate: conflict ? { label: message } : null,
          });
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["ta", "clients"] });
    addingRef.current = false;
    if (alive.current) setSaving(false);
    if (saved > 0 && failed === 0) notify.success(`${plural(saved, "client")} added`);
    else if (saved > 0) notify.warning(`${saved} added, ${failed} need fixes`, "Fix the marked rows, then add again.");
    else if (failed > 0) notify.error(`${plural(failed, "client")} not added`, "Fix the marked rows, then add again.");
  };

  const requestClose = async () => {
    if (saving) return;
    if (!(await guard.confirmDiscard())) return;
    onClose();
  };

  const full = rows.length >= MAX_BATCH_FILES;
  const blockedReason =
    pending.length === 0
      ? ""
      : readingCount > 0
        ? `Waiting for ${plural(readingCount, "file")} to be read.`
        : needFixCount > 0
          ? `${plural(needFixCount, "row")} can't be added yet. Fix or remove ${needFixCount === 1 ? "it" : "them"}.`
          : "";

  return (
    <>
      <Dialog
        open={open}
        onClose={() => void requestClose()}
        title="Add clients from files"
        description="Add one file per client. The details fill in from each file. Check each row, then add."
        size="xl"
        className="lg:max-w-6xl"
      >
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              if (full || saving) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!full && !saving) addFiles(Array.from(e.dataTransfer.files ?? []));
            }}
            className={`rounded-md border-2 border-dashed px-4 text-center transition-colors ${
              rows.length === 0 ? "flex min-h-64 flex-col items-center justify-center gap-2 py-10" : "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-3"
            } ${dragging ? "border-navy bg-navy-soft" : "border-slate-300 bg-slate-50"}`}
          >
            <label htmlFor="client-files" className={rows.length === 0 ? "text-base font-medium text-slate-900" : "text-sm font-medium text-slate-800"}>
              {rows.length === 0 ? "Drop client files here" : "Add more files"}
              <span className="sr-only"> (PDF, Word or photo files)</span>
            </label>
            <input
              ref={fileInputRef}
              id="client-files"
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              disabled={full || saving}
              aria-describedby="client-files-help"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="sr-only"
            />
            <Button type="button" variant="outline" size={rows.length === 0 ? "md" : "sm"} disabled={full || saving} onClick={() => fileInputRef.current?.click()}>
              Choose files
            </Button>
            <p id="client-files-help" className="text-xs text-slate-500">
              PDF, Word or photo files, up to {MAX_BATCH_FILES} files, 5 MB each.{rows.length > 0 ? ` ${rows.length} added.` : ""}
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
                  batchDuplicateOf={duplicateOf.get(row.id)}
                  locked={saving}
                  onChange={(patch) => changeRow(row.id, patch)}
                  onCheck={() => {
                    const latest = rowsRef.current.find((r) => r.id === row.id);
                    if (latest) void checkDuplicate(latest);
                  }}
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
                {readyCount > 0 ? `Add ${plural(readyCount, "client")}` : "Add clients"}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
      {guard.discardDialog}
    </>
  );
};
