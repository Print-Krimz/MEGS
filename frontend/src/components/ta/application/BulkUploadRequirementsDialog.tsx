import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Select } from "../../ui";
import { taApi, type BulkUploadResult } from "../../../lib/api/ta.api";
import { formatErrorMessage } from "../../../lib/feedback";
import type { RequirementRowData } from "./RequirementRow";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const BULK_MAX_FILES = 10;

interface PickedFile {
  key: number;
  file: File;
  requirementId: number | "";
  previewUrl: string | null;
}

export interface BulkUploadRequirementsDialogProps {
  applicationId: string | number;
  /** Only requirements that can take a file are offered. */
  requirements: RequirementRowData[];
  onClose: () => void;
  /** Called with the requirement ids that were stored, so the tab can offer a quick review. */
  onUploaded: (requirementIds: number[]) => void;
  /** Opens the existing review dialog on the first stored document. */
  onReviewNow: (requirementId: number) => void;
}

/** A requirement can take a file unless it is already approved (the row menu hides Upload for those too). */
export const canTakeUpload = (req: RequirementRowData) => req.reviewStatus !== "APPROVED";

const fileProblem = (file: File): string | null =>
  file.size > MAX_FILE_BYTES ? "Over 5 MB. Retake the photo or use a smaller file." : !ACCEPTED_TYPES.includes(file.type) ? "Use a JPEG, PNG or WEBP photo, or a PDF." : null;

/** Saves several scanned documents at once. Mount it only while open. */
export const BulkUploadRequirementsDialog: React.FC<BulkUploadRequirementsDialogProps> = ({ applicationId, requirements, onClose, onUploaded, onReviewNow }) => {
  const queryClient = useQueryClient();
  const nextKey = useRef(1);
  const [items, setItems] = useState<PickedFile[]>([]);
  const [pickError, setPickError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkUploadResult[] | null>(null);

  // Free the image previews when the dialog closes.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl)), []);

  const options = useMemo(() => requirements.filter(canTakeUpload), [requirements]);
  const labelOf = (id: number) => requirements.find((r) => r.id === id)?.documentLabel ?? "Requirement";

  const upload = useMutation({
    mutationFn: () => taApi.bulkUploadComplianceDocuments(applicationId, items.map((i) => ({ file: i.file, requirementId: i.requirementId as number }))),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(applicationId)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      setResults(data.results);
      const stored = data.results.filter((r) => r.status === "uploaded").map((r) => r.requirementId);
      if (stored.length > 0) onUploaded(stored);
    },
    onError: (err: unknown) => setServerError(formatErrorMessage(err)),
  });

  const addFiles = (list: FileList | null) => {
    setServerError(null);
    const incoming = Array.from(list ?? []);
    const room = BULK_MAX_FILES - items.length;
    const accepted = incoming.slice(0, Math.max(room, 0));
    const problem = incoming.length > accepted.length ? `Up to ${BULK_MAX_FILES} files at a time.` : accepted.map((f) => fileProblem(f)).find(Boolean) ?? null;
    setPickError(problem);
    setItems((prev) => [
      ...prev,
      ...accepted
        .filter((f) => !fileProblem(f))
        .map((file) => ({ key: nextKey.current++, file, requirementId: "" as const, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null })),
    ]);
  };

  const remove = (key: number) =>
    setItems((prev) => {
      const gone = prev.find((i) => i.key === key);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((i) => i.key !== key);
    });

  const choose = (key: number, value: string) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, requirementId: value ? Number(value) : "" } : i)));

  const allMatched = items.length > 0 && items.every((i) => i.requirementId !== "");
  const failed = results?.filter((r) => r.status === "failed") ?? [];
  const storedCount = (results?.length ?? 0) - failed.length;

  // Step 2: what was stored.
  if (results) {
    return (
      <Dialog open onClose={onClose} title="Documents uploaded" description={storedCount > 0 ? "Saved as Submitted. None are approved until you review them." : undefined}>
        <div className="space-y-4">
          <ul className="divide-y divide-slate-100 border border-slate-200 text-sm" aria-label="Upload results">
            {results.map((r) => (
              <li key={r.requirementId} className="flex flex-col gap-0.5 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-slate-900">{labelOf(r.requirementId)}</span>
                {r.status === "uploaded" ? (
                  <span className="text-emerald-800">Submitted</span>
                ) : (
                  <span role="alert" className="text-rose-700">Not uploaded: {r.error}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              {storedCount > 0 ? "Review later" : "Close"}
            </Button>
            {storedCount > 0 && (
              <Button variant="primary" size="sm" onClick={() => onReviewNow(results.find((r) => r.status === "uploaded")!.requirementId)}>
                Review documents
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    );
  }

  const error = pickError ?? serverError;

  return (
    <Dialog
      open
      size="lg"
      onClose={upload.isPending ? () => undefined : onClose}
      title="Upload several documents"
      description="Add the scans, then match each one to a requirement. They are saved to the applicant's record as Submitted."
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="bulk-upload-files" className="block text-xs font-medium text-slate-600">
            Photos or PDFs
          </label>
          <input
            id="bulk-upload-files"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-describedby={error ? "bulk-upload-error" : "bulk-upload-help"}
            disabled={items.length >= BULK_MAX_FILES}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            className="block w-full min-h-11 md:min-h-10 rounded-md border border-slate-300 bg-white text-sm text-slate-900 hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 file:mr-3 file:h-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800"
          />
          {error ? (
            <p id="bulk-upload-error" role="alert" className="text-xs font-medium text-rose-600">{error}</p>
          ) : (
            <p id="bulk-upload-help" className="text-xs text-slate-500">JPEG, PNG, WEBP or PDF, up to 5 MB each, {BULK_MAX_FILES} files at most.</p>
          )}
        </div>

        {items.length > 0 && (
          <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto border border-slate-200" aria-label="Files to upload">
            {items.map((item) => (
              <li key={item.key} className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt="" className="h-12 w-12 shrink-0 rounded border border-slate-200 object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">PDF</span>
                  )}
                  <span className="min-w-0 truncate text-sm text-slate-900" title={item.file.name}>{item.file.name}</span>
                </div>
                <div className="flex items-center gap-2 sm:w-64">
                  <Select
                    aria-label={`Requirement for ${item.file.name}`}
                    placeholder="Choose requirement"
                    value={item.requirementId === "" ? "" : String(item.requirementId)}
                    onChange={(e) => choose(item.key, e.target.value)}
                    options={options.map((r) => ({
                      value: r.id,
                      label: r.documentLabel,
                      disabled: r.id !== item.requirementId && items.some((other) => other.requirementId === r.id),
                    }))}
                  />
                  <Button variant="ghost" size="sm" aria-label={`Remove ${item.file.name}`} onClick={() => remove(item.key)} disabled={upload.isPending}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={upload.isPending}
            disabled={!allMatched}
            onClick={() => {
              setServerError(null);
              upload.mutate();
            }}
          >
            {items.length > 1 ? `Upload ${items.length} documents` : "Upload"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
