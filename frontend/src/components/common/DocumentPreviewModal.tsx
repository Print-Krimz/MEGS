import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import { documentsApi } from "../../lib/api/documents.api";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { formatDate } from "../../lib/utils";

export interface DocumentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  documentId?: number | null;
  title?: string;
  applicantName?: string;
  requirementStatus?: string;
  onApprove?: () => Promise<void> | void;
  onReject?: (notes: string) => Promise<void> | void;
  isActionLoading?: boolean;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  open,
  onClose,
  documentId,
  title = "Document Preview",
  applicantName,
  requirementStatus,
  onApprove,
  onReject,
  isActionLoading = false,
}) => {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  const {
    data: preview,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["document-preview", documentId],
    queryFn: () => documentsApi.getPreview(documentId!),
    enabled: Boolean(documentId && open),
    staleTime: 1000 * 60 * 4, // 4 minutes (URL valid for 5 min)
    retry: 1,
  });

  if (!open) return null;

  const handleClose = () => {
    setRejectMode(false);
    setRejectNotes("");
    onClose();
  };

  const handleRejectSubmit = () => {
    if (onReject) {
      onReject(rejectNotes);
      setRejectMode(false);
      setRejectNotes("");
    }
  };

  const isImage = preview?.mimeType?.startsWith("image/");
  const isPdf = preview?.mimeType === "application/pdf";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-white border border-slate-400 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-300 flex items-center justify-between bg-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-200 border border-slate-300 rounded text-slate-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-950 font-mono uppercase tracking-tight">
                  {title}
                </h2>
                {requirementStatus && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      requirementStatus === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : requirementStatus === "REJECTED"
                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {requirementStatus}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-sans">
                {preview?.originalName || "Uploaded document"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {documentId && (
              <a
                href={documentsApi.getDownloadUrl(documentId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-50 transition-colors"
                title="Download original file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors rounded"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata sub-bar */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-4 font-mono shrink-0">
          <div className="flex items-center gap-4">
            {(applicantName || preview?.applicantName) && (
              <div className="flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-slate-800">
                  {applicantName || preview?.applicantName}
                </span>
              </div>
            )}
            {preview?.uploadedAt && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Uploaded {formatDate(preview.uploadedAt)}</span>
              </div>
            )}
          </div>
          {preview?.sizeBytes && (
            <div className="text-slate-500">
              {(preview.sizeBytes / 1024).toFixed(1)} KB • {preview.mimeType}
            </div>
          )}
        </div>

        {/* Content Viewer Body */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-100 flex items-center justify-center min-h-[360px]">
          {!documentId ? (
            <div className="text-center p-8 bg-white border border-dashed border-slate-300 rounded-lg max-w-sm">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                No Document Uploaded
              </h3>
              <p className="text-xs text-slate-500">
                The applicant has not uploaded a file for this requirement yet.
              </p>
            </div>
          ) : isLoading ? (
            <div className="text-center p-8 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-600">
                Fetching secure document preview...
              </p>
            </div>
          ) : isError ? (
            <div className="text-center p-8 bg-white border border-rose-200 rounded-lg max-w-md space-y-3">
              <XCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">
                Unable to Load Document
              </h3>
              <p className="text-xs text-slate-600">
                {(error as Error)?.message ||
                  "The signed URL could not be generated or access is restricted."}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry Loading
                </Button>
                <a
                  href={documentsApi.getDownloadUrl(documentId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Try Direct Download
                </a>
              </div>
            </div>
          ) : isImage && preview ? (
            <div className="max-w-full max-h-full flex items-center justify-center p-2 bg-white rounded border border-slate-300 shadow-inner">
              <img
                src={preview.url}
                alt={preview.originalName}
                className="max-h-[58vh] max-w-full object-contain rounded"
              />
            </div>
          ) : isPdf && preview ? (
            <div className="w-full h-[58vh] bg-white rounded border border-slate-300 overflow-hidden shadow-inner">
              <iframe
                src={preview.url}
                title={preview.originalName}
                className="w-full h-full border-none"
              />
            </div>
          ) : (

            <div className="text-center p-8 bg-white border border-slate-300 rounded-lg max-w-md space-y-3">
              <FileText className="w-12 h-12 text-slate-500 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {preview?.originalName}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Preview is not supported inline for this file type ({preview?.mimeType}).
                </p>
              </div>
              <div className="pt-2">
                <a
                  href={preview?.url || documentsApi.getDownloadUrl(documentId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download to View
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Verification Action Drawer / Footer */}
        <div className="p-4 bg-white border-t border-slate-300 shrink-0">
          {rejectMode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 uppercase font-mono flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Specify Rejection Reason / Instructions for Candidate
                </span>
                <button
                  type="button"
                  onClick={() => setRejectMode(false)}
                  className="text-xs font-mono text-slate-500 hover:text-slate-800 underline"
                >
                  Cancel Rejection
                </button>
              </div>
              <Textarea
                placeholder="e.g. Document is blurry, expired stamp, or missing signature. Please upload an updated official copy."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectMode(false)}
                  disabled={isActionLoading}
                >
                  Back
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={isActionLoading}
                  onClick={handleRejectSubmit}
                >
                  Confirm Document Rejection
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-mono">
                {documentId ? "Verify document authenticity before approving." : "No action available."}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Close
                </Button>
                {onReject && documentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-300 text-rose-700 hover:bg-rose-50"
                    leftIcon={<XCircle className="w-3.5 h-3.5 text-rose-600" />}
                    onClick={() => setRejectMode(true)}
                    disabled={isActionLoading}
                  >
                    Reject
                  </Button>
                )}
                {onApprove && documentId && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    loading={isActionLoading}
                    onClick={() => onApprove()}
                  >
                    Approve Document
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
