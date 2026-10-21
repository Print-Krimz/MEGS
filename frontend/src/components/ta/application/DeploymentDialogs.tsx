import React, { useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { Button, ComboBox, Dialog, Input, Textarea } from "../../ui";
import { documentsApi } from "../../../lib/api/documents.api";
import { notify } from "../../../lib/feedback";
import { addManilaCalendarDays, getManilaToday } from "../../../lib/field-limits";
import { formatDate } from "../../../lib/utils";

type ClientOption = { id: number; name: string; industry?: string | null; address?: string | null };

export interface ActivateDeploymentDialogProps {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  linkedClientId: number;
  linkedClientName: string;
  jobTitle?: string | null;
  requestTitle?: string | null;
  clients: ClientOption[];
  initialClientId: number;
  initialSite: string;
  /** Where the work site can come from, in order: manpower request, job opening, linked client. */
  mrfLocation?: string | null;
  jobLocation?: string | null;
  linkedClientAddress?: string | null;
  onSubmit: (values: { clientId: number; site?: string; contractStart?: string; contractEnd?: string; notes?: string }) => void;
  isSubmitting?: boolean;
}

export const ActivateDeploymentDialog: React.FC<ActivateDeploymentDialogProps> = ({
  open,
  onClose,
  candidateName,
  linkedClientId,
  linkedClientName,
  jobTitle,
  requestTitle,
  clients,
  initialClientId,
  initialSite,
  mrfLocation,
  jobLocation,
  linkedClientAddress,
  onSubmit,
  isSubmitting = false,
}) => {
  const [clientId, setClientId] = useState(initialClientId);
  const [site, setSite] = useState(initialSite);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setClientId(initialClientId);
    setSite(initialSite);
    setStart("");
    setEnd("");
    setNotes("");
    // Only reopening resets the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const targetClientId = linkedClientId || clientId;
  const datesInvalid = Boolean(start && end && new Date(start) > new Date(end));

  return (
    <Dialog open={open} onClose={onClose} title="Activate site deployment" description={`Assign ${candidateName} to the client work site.`} overflowVisible>
      <div className="space-y-4">
        {linkedClientId ? (
          <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="block text-xs text-slate-600">Client (linked automatically)</span>
            <div className="font-semibold text-slate-900">{linkedClientName || `Client #${linkedClientId}`}</div>
            {jobTitle && (
              <div className="text-xs text-slate-600">
                Position: {jobTitle}
                {requestTitle ? ` • Request: ${requestTitle}` : ""}
              </div>
            )}
          </div>
        ) : (
          <ComboBox
            label="Client"
            placeholder="Search verified corporate client..."
            leftIcon={<Building2 className="h-3.5 w-3.5 text-slate-500" />}
            value={clientId ? String(clientId) : ""}
            onChange={(val) => setClientId(Number(val) || 0)}
            options={clients.map((c) => ({
              value: String(c.id),
              label: c.name,
              subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
            }))}
            helperText="This opening is not linked to a manpower request, so choose the client manually."
            required
          />
        )}

        <ComboBox
          label="Site"
          placeholder="Select a site or enter a location..."
          value={site}
          onChange={(val) => setSite(val || "")}
          options={Array.from(
            new Set(
              [mrfLocation, jobLocation, linkedClientAddress, clients.find((c) => c.id === (linkedClientId || clientId))?.address].filter(
                Boolean
              ) as string[]
            )
          ).map((loc) => ({
            value: loc,
            label: loc,
            subtitle: loc === mrfLocation ? "From manpower request" : "Client facility",
          }))}
          allowCustom
          required
        />

        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          <Input label="Contract start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} min={getManilaToday()} helperText={start ? formatDate(start) : undefined} required />
          <Input
            label="Contract end date"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            min={start || getManilaToday()}
            helperText={end ? formatDate(end) : "Optional for rolling contracts"}
            error={datesInvalid ? "Must be on or after start date" : undefined}
          />
        </div>

        <Textarea
          label="Deployment notes (optional)"
          placeholder="Add shift, supervisor, or reporting instructions..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!targetClientId || !start || datesInvalid || isSubmitting}
            loading={isSubmitting}
            onClick={() => {
              if (!targetClientId) {
                notify.error("Client required", "Choose a client before activating this deployment.");
                return;
              }
              if (!start) {
                notify.error("Contract start required", "Contract start date is required.");
                return;
              }
              if (datesInvalid) {
                notify.error("Invalid dates", "Contract start date cannot be after contract end date.");
                return;
              }
              onSubmit({
                clientId: targetClientId,
                site: site || undefined,
                contractStart: start || undefined,
                contractEnd: end || undefined,
                notes: notes || undefined,
              });
            }}
          >
            Activate deployment
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

// Signed contract scans: the types and size the service accepts.
const CONTRACT_SCAN_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const CONTRACT_SCAN_MAX_BYTES = 10 * 1024 * 1024;

// Contract start dates: back-dated up to 30 days, at most 2 years ahead (Manila calendar days, as the service checks).
const contractStartBounds = () => {
  const today = getManilaToday();
  const [year, month, day] = today.split("-").map(Number);
  return {
    min: addManilaCalendarDays(today, -30),
    max: new Date(Date.UTC(year + 2, month - 1, day)).toISOString().slice(0, 10),
  };
};

export interface SignedContractDialogProps {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  linkedClientId: number;
  linkedClientName: string;
  site: string;
  initialStartDate: string;
  /** A signed copy is already on file. */
  currentCopyDocumentId?: number | null;
  onDownloadTemplate: (startDate: string) => void;
  isDownloading?: boolean;
  onSubmit: (values: { file: File; startDate: string }) => void;
  isSubmitting?: boolean;
}

export const SignedContractDialog: React.FC<SignedContractDialogProps> = ({
  open,
  onClose,
  candidateName,
  linkedClientId,
  linkedClientName,
  site,
  initialStartDate,
  currentCopyDocumentId,
  onDownloadTemplate,
  isDownloading = false,
  onSubmit,
  isSubmitting = false,
}) => {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStartDate(initialStartDate);
    setFile(null);
    // Only reopening resets the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const bounds = contractStartBounds();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Employment contract"
      description={`Upload the signed contract of ${candidateName}. Saving it deploys the candidate.`}
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-600">Client</dt>
          <dd className="font-medium text-slate-900">{linkedClientId ? linkedClientName || `Client #${linkedClientId}` : "Not set"}</dd>
          <dt className="text-slate-600">Site</dt>
          <dd className="font-medium text-slate-900">{site || "Not set"}</dd>
          <dt className="text-slate-600">Start date</dt>
          <dd className="font-medium text-slate-900">{startDate ? formatDate(startDate) : "Not set"}</dd>
        </dl>
        {!linkedClientId && <p className="text-xs text-amber-800">Send the candidate to a client before deploying.</p>}
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Take a clear photo or scan of the signed contract (with the employee&apos;s signature and right thumbmark). Only you and the admin can open it.
          </p>
          {currentCopyDocumentId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(documentsApi.getDownloadUrl(currentCopyDocumentId), "_blank")}
            >
              View current signed copy
            </Button>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              if (picked && (!CONTRACT_SCAN_TYPES.includes(picked.type) || picked.size > CONTRACT_SCAN_MAX_BYTES)) {
                e.target.value = "";
                setFile(null);
                notify.error("Contract scan not accepted", "Contract scan must be a PDF or image under 10 MB.");
                return;
              }
              setFile(picked);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              {file ? "Choose a different file" : "Take photo or choose file"}
            </Button>
            <span className="break-all text-xs text-slate-600">
              {file ? file.name : "No file chosen (PDF, JPG, PNG or WEBP, up to 10 MB)"}
            </span>
          </div>
        </div>

        <Input
          label="Work assignment effective date"
          min={bounds.min}
          max={bounds.max}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          helperText={startDate ? formatDate(startDate) : undefined}
          required
        />

        <div className="border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" disabled={!startDate} loading={isDownloading} onClick={() => onDownloadTemplate(startDate)}>
            Download contract to print (rate left blank)
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isSubmitting}
            disabled={!file || !startDate || !linkedClientId}
            onClick={() => file && onSubmit({ file, startDate })}
          >
            Upload &amp; deploy
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
