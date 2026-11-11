import React, { useContext, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  FileText,
  Download,
  AlertCircle,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { documentsApi } from "../../lib/api/documents.api";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { useModalBehavior } from "../ui/Dialog";
import { AuthContext } from "../../context/AuthContext";
import { RequirementStatusBadge } from "../applicant/RequirementStatusBadge";
import { cn, formatDate } from "../../lib/utils";
import { DocumentViewer } from "../ta/InlineResumeViewer";

export interface DocumentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  documentId?: number | null;
  fileUrl?: string | null;
  title?: string;
  applicantName?: string;
  requirementStatus?: string;
  onReject?: (notes: string) => Promise<void> | void;
  isActionLoading?: boolean;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  open,
  onClose,
  documentId,
  fileUrl,
  title = "Document Preview",
  applicantName,
  requirementStatus,
  onReject,
  isActionLoading = false,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Applicants get plain wording; any other signed-in role (or no provider) keeps the staff review wording.
  const isStaff = useContext(AuthContext)?.user?.role !== "APPLICANT";
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  const hasDocId = Boolean(documentId && !isNaN(Number(documentId)));

  const {
    data: preview,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["document-preview", documentId],
    queryFn: () => documentsApi.getPreview(documentId!),
    enabled: Boolean(hasDocId && open),
    staleTime: 1000 * 60 * 4, // 4 minutes (URL valid for 5 min)
    retry: 1,
  });

  const handleClose = () => {
    setRejectMode(false);
    setRejectNotes("");
    onClose();
  };

  // Escape in notes mode steps back to the preview and keeps the typed notes.
  useModalBehavior(open, rejectMode ? () => setRejectMode(false) : handleClose, panelRef);

  if (!open) return null;

  const handleRejectSubmit = () => {
    if (onReject) {
      onReject(rejectNotes);
      setRejectMode(false);
      setRejectNotes("");
    }
  };

  const resolvedUrl = preview?.url || fileUrl;
  const isImage =
    preview?.mimeType?.startsWith("image/") ||
    (resolvedUrl
      ? /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(resolvedUrl) ||
        (!resolvedUrl.toLowerCase().includes(".pdf") && resolvedUrl.startsWith("http"))
      : false);
  const isPdf =
    preview?.mimeType === "application/pdf" ||
    (resolvedUrl ? /\.pdf(\?.*)?$/i.test(resolvedUrl) : false);
  const showViewer = Boolean(resolvedUrl && (isImage || isPdf) && !(isError && !fileUrl) && !(isLoading && !fileUrl));
  const ownerName = applicantName || preview?.applicantName;
  // Staff see whose document it is; the applicant just sees it is their own upload.
  const subtitle = isStaff
    ? [ownerName, "Original uploaded document"].filter(Boolean).join(" · ")
    : "Uploaded document";
  const fileDetails = [
    preview?.originalName,
    preview?.uploadedAt && `Uploaded ${formatDate(preview.uploadedAt)}`,
    preview?.sizeBytes && `${(preview.sizeBytes / 1024).toFixed(1)} KB`,
  ].filter(Boolean).join(" · ");
  const showFooter = rejectMode || Boolean(onReject && documentId);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-4xl bg-white border border-slate-400 rounded-md overflow-hidden shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] focus:outline-none",
          showViewer && "h-[min(52rem,calc(100dvh-1rem))] sm:h-[min(52rem,calc(100dvh-2rem))]"
        )}
      >
        {/* Header */}
        <div className="px-3 py-2 sm:px-4 border-b border-slate-300 flex items-center justify-between bg-slate-100 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 bg-slate-200 border border-slate-300 rounded text-slate-700 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 id={titleId} className="text-base font-semibold text-slate-950 truncate">
                  {title}
                </h2>
                {requirementStatus &&
                  (isStaff ? (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        requirementStatus === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : requirementStatus === "REJECTED"
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {requirementStatus}
                    </span>
                  ) : (
                    <RequirementStatusBadge status={requirementStatus} />
                  ))}
              </div>
              <p className="text-xs text-slate-600 font-sans truncate" title={fileDetails || undefined}>
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {resolvedUrl && (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer"
                download={preview?.originalName || "document"}
                className="inline-flex items-center justify-center gap-1.5 min-h-9 min-w-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-2.5 rounded hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                aria-label="Download document"
                title="Download original file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="min-h-9 min-w-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              aria-label="Close dialog"
              title="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className={cn(
          "overflow-y-auto flex-1 bg-slate-100 flex items-center justify-center min-h-0",
          showViewer ? "p-0" : "p-3 sm:p-4 min-h-[200px]"
        )}>
          {!hasDocId && !fileUrl ? (
            <div className="text-center p-6 sm:p-8 bg-white border border-dashed border-slate-300 rounded-lg max-w-sm">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                No Document Uploaded
              </h3>
              <p className="text-xs text-slate-500">
                {isStaff ? "The applicant has not uploaded a file for this requirement yet." : "No file has been uploaded yet."}
              </p>
            </div>
          ) : isLoading && !fileUrl ? (
            <div className="text-center p-8 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-600">
                {isStaff ? "Fetching secure document preview..." : "Loading document..."}
              </p>
            </div>
          ) : isError && !fileUrl ? (
            <div className="text-center p-6 sm:p-8 bg-white border border-rose-200 rounded-lg max-w-md space-y-3">
              <XCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">
                Unable to Load Document
              </h3>
              <p className="text-xs text-slate-600">
                {(error as Error)?.message ||
                  (isStaff
                    ? "The signed URL could not be generated or access is restricted."
                    : "The document could not be loaded. Please try again.")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry Loading
                </Button>
                {documentId && (
                  <a
                    href={documentsApi.getDownloadUrl(documentId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 [.applicant-portal_&]:text-navy [.applicant-portal_&]:hover:text-navy-hover applicant-touch:min-h-11"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Try Direct Download
                  </a>
                )}
              </div>
            </div>
          ) : (isImage || isPdf) && resolvedUrl ? (
            // The same viewer as the resume rail: zoom, fit width and drag-to-pan. Download and Close stay in the header.
            <DocumentViewer
              url={resolvedUrl}
              kind={isImage ? "image" : "pdf"}
              title={preview?.originalName || title}
              downloadName={preview?.originalName || undefined}
              showDownload={false}
              className="h-full w-full rounded-none border-0"
            />
          ) : resolvedUrl ? (
            <div className="text-center p-6 sm:p-8 bg-white border border-slate-300 rounded-lg max-w-md space-y-3">
              <FileText className="w-12 h-12 text-slate-500 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {preview?.originalName || title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isStaff
                    ? `Preview is not supported inline for this file type (${preview?.mimeType || "unknown"}).`
                    : "Preview is not available for this file. Download it to view."}
                </p>
              </div>
              <div className="pt-2">
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={preview?.originalName || "document"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm [.applicant-portal_&]:bg-navy [.applicant-portal_&]:hover:bg-navy-hover applicant-touch:min-h-11"
                >
                  <Download className="w-4 h-4" />
                  Download to View
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 sm:p-8 bg-white border border-dashed border-slate-300 rounded-lg max-w-sm">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                No Document Available
              </h3>
              <p className="text-xs text-slate-500">
                Document could not be located.
              </p>
            </div>
          )}
        </div>

        {/* Footer only exists for the Reject action. Closing lives in the header (X, Escape, outside click). */}
        {showFooter && (
          <div className="px-3 py-2 sm:px-4 bg-white border-t border-slate-300 shrink-0">
            {rejectMode ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-900 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Specify rejection reason / instructions</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRejectMode(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Cancel
                  </button>
                </div>
                <Textarea
                  placeholder="e.g. Document is blurry, expired stamp, or missing signature. Please upload an updated official copy."
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={2}
                  autoFocus
                />
                <div className="flex flex-wrap justify-end gap-2">
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
                    disabled={!rejectNotes.trim()}
                    onClick={handleRejectSubmit}
                  >
                    Confirm Document Rejection
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
