import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText, Loader2, Maximize2 } from "lucide-react";
import { documentsApi } from "../../../lib/api/documents.api";
import { Button } from "../../ui";

/** Inline preview of an uploaded requirement file: image thumbnail, or file details for PDFs and the like. */
export const RequirementDocumentPreview: React.FC<{
  documentId: number;
  documentLabel: string;
  onExpand: () => void;
}> = ({ documentId, documentLabel, onExpand }) => {
  const { data: preview, isLoading, isError } = useQuery({
    queryKey: ["document-preview", documentId],
    queryFn: () => documentsApi.getPreview(documentId),
    staleTime: 1000 * 60 * 4,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[140px] items-center justify-center rounded-md border border-slate-300 bg-slate-50 p-6" role="status">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Loading preview…</span>
        </div>
      </div>
    );
  }

  if (isError || !preview) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-slate-700">
          <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="truncate">{documentLabel}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onExpand} leftIcon={<Maximize2 className="h-3.5 w-3.5" />}>
          Expand
        </Button>
      </div>
    );
  }

  const resolvedUrl = preview.url;
  const isImage =
    preview.mimeType?.startsWith("image/") ||
    (resolvedUrl
      ? /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(resolvedUrl) ||
        (!resolvedUrl.toLowerCase().includes(".pdf") && resolvedUrl.startsWith("http"))
      : false);

  if (isImage && resolvedUrl) {
    return (
      <div className="space-y-1.5">
        <div className="flex max-h-48 min-h-[140px] items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-slate-50 p-2">
          <img
            src={resolvedUrl}
            alt={preview.originalName || documentLabel}
            className="max-h-44 w-auto rounded object-contain"
          />
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
          <span className="truncate" title={preview.originalName}>
            {preview.originalName}
          </span>
          <button
            type="button"
            onClick={onExpand}
            className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1 font-medium text-navy underline-offset-2 hover:underline md:min-h-0"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            Expand
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-300 bg-slate-50 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900" title={preview.originalName || documentLabel}>
            {preview.originalName || documentLabel}
          </p>
          <p className="text-xs text-slate-600">
            {preview.mimeType} · {(preview.sizeBytes / 1024).toFixed(1)} KB
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onExpand} leftIcon={<Eye className="h-3.5 w-3.5" />}>
        Preview
      </Button>
    </div>
  );
};
