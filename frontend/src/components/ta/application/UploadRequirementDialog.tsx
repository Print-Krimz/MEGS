import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog } from "../../ui";
import { taApi } from "../../../lib/api/ta.api";
import { notify, formatErrorMessage } from "../../../lib/feedback";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface UploadRequirementDialogProps {
  applicationId: string | number;
  requirement: { id: number; documentLabel: string };
  onClose: () => void;
}

/** Saves a document the applicant handed over in person. Mount it only while open. */
export const UploadRequirementDialog: React.FC<UploadRequirementDialogProps> = ({ applicationId, requirement, onClose }) => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (f: File) => taApi.uploadComplianceDocument(requirement.id, f),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(applicationId)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      notify.success("Document uploaded for review.");
      onClose();
    },
    onError: (err: unknown) => setServerError(formatErrorMessage(err)),
  });

  const submit = () => {
    setServerError(null);
    if (!file) {
      setFileError("Choose a photo or PDF.");
      return;
    }
    upload.mutate(file);
  };

  const onPick = (picked: File | null) => {
    setFile(picked);
    setServerError(null);
    if (picked && picked.size > MAX_FILE_BYTES) setFileError("The file is over 5 MB. Retake the photo or use a smaller file.");
    else if (picked && !ACCEPTED_TYPES.includes(picked.type)) setFileError("Use a JPEG, PNG or WEBP photo, or a PDF.");
    else setFileError(null);
  };

  const error = fileError ?? serverError;

  return (
    <Dialog
      open
      onClose={upload.isPending ? () => undefined : onClose}
      title={`Upload ${requirement.documentLabel}`}
      description="Use this when the applicant gave you the paper or a photo. It is saved to their record and shown for review."
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="upload-requirement-file" className="block text-xs font-medium text-slate-600">
            Photo or PDF<span className="ml-0.5 text-rose-500">*</span>
          </label>
          <input
            id="upload-requirement-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "upload-requirement-error" : "upload-requirement-help"}
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            className={`block w-full min-h-11 md:min-h-10 rounded-md border bg-white text-sm text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 file:mr-3 file:h-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 ${
              error ? "border-rose-400 bg-rose-50/20 focus-visible:ring-rose-600" : "border-slate-300 hover:border-slate-400"
            }`}
          />
          {error ? (
            <p id="upload-requirement-error" role="alert" className="text-xs font-medium text-rose-600">
              {error}
            </p>
          ) : (
            <p id="upload-requirement-help" className="text-xs text-slate-500">
              JPEG, PNG, WEBP or PDF, up to 5 MB.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={upload.isPending} disabled={Boolean(fileError)} onClick={submit}>
            Upload
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
