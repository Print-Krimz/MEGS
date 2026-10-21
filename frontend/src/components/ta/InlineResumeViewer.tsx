/* oxlint-disable react/only-export-components -- the zoom helpers are exported for their unit tests */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Maximize2, Minus, PanelRightClose, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

/** Zoom steps in percent. `null` means "Fit width". */
export const ZOOM_STEPS = [50, 75, 100, 125, 150, 200] as const;

/** The next zoom step in one direction. Fit width counts as 100%. Stops at the first and last step. */
export const stepZoom = (current: number | null, direction: 1 | -1): number => {
  const base = current ?? 100;
  if (direction === 1) return ZOOM_STEPS.find((z) => z > base) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((z) => z < base) ?? ZOOM_STEPS[0];
};

/**
 * Address for the PDF iframe. The fragment drives the browser's built-in viewer and hides its own
 * toolbar and thumbnails, so ours is the only toolbar. Chromium and Edge honour these parameters;
 * Firefox ignores `toolbar` and Safari ignores all of them. We do not detect the browser: the
 * viewer simply falls back to its native controls and the recruiter scrolls as usual.
 */
export const buildPdfViewerUrl = (url: string, zoom: number | null): string => {
  const base = url.split("#")[0];
  // Chromium and Edge honour these; FitH would override a numeric zoom, so it is used only for "Fit width".
  const params = zoom === null ? "view=FitH" : `zoom=${zoom}`;
  return `${base}#${params}&toolbar=0&navpanes=0`;
};

export type DocumentKind = "pdf" | "image" | "other";

/** Same rule the resume column always used: known image extensions are images, other web links are PDFs. */
export const detectDocumentKind = (url: string): DocumentKind => {
  if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url)) return "image";
  if (/\.pdf(\?.*)?$/i.test(url) || url.startsWith("http")) return "pdf";
  return "other";
};

const toolButton =
  "focus-ring inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200/70 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:min-w-11";

export interface DocumentViewerProps {
  url: string;
  kind: DocumentKind;
  /** Accessible name of the iframe or image. */
  title: string;
  /** File name suggested to the browser when the file is downloaded. */
  downloadName?: string;
  onOpenFullscreen?: () => void;
  onCollapse?: () => void;
  /** Set false when the surrounding screen already has a download button. */
  showDownload?: boolean;
  className?: string;
  /** Height of the document area. Defaults to the space left under the toolbar. */
  bodyClassName?: string;
}

/**
 * One toolbar and one document area: [−] [zoom] [+] [Fit width] | [Download] [Full screen] [Hide].
 * PDFs zoom through the iframe address, images through a scrollable container the recruiter can drag.
 */
export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  url,
  kind,
  title,
  downloadName,
  onOpenFullscreen,
  onCollapse,
  showDownload = true,
  className,
  bodyClassName,
}) => {
  const [zoom, setZoom] = useState<number | null>(null);
  const canZoom = kind === "pdf" || kind === "image";

  const zoomIn = useCallback(() => setZoom((z) => stepZoom(z, 1)), []);
  const zoomOut = useCallback(() => setZoom((z) => stepZoom(z, -1)), []);
  const fitWidth = useCallback(() => setZoom(null), []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canZoom || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "+" || event.key === "=") zoomIn();
    else if (event.key === "-" || event.key === "_") zoomOut();
    else if (event.key === "0") fitWidth();
    else return;
    event.preventDefault();
  };

  return (
    <div
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white focus:outline-none", className)}
    >
      <div
        role="toolbar"
        aria-label="Document viewer"
        className="flex min-h-10 shrink-0 flex-wrap items-center gap-0.5 border-b border-slate-300 bg-slate-100 px-1.5"
      >
        {canZoom && (
          <>
            <button type="button" className={toolButton} onClick={zoomOut} disabled={zoom !== null && zoom <= ZOOM_STEPS[0]} aria-label="Zoom out" title="Zoom out (-)">
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span role="status" aria-label="Zoom level" className="min-w-11 text-center text-xs font-medium tabular-nums text-slate-800">
              {zoom === null ? "Fit" : `${zoom}%`}
            </span>
            <button type="button" className={toolButton} onClick={zoomIn} disabled={zoom !== null && zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Zoom in" title="Zoom in (+)">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={cn(toolButton, "px-2", zoom === null && "bg-white text-navy ring-1 ring-inset ring-slate-300")}
              onClick={fitWidth}
              aria-pressed={zoom === null}
              title="Fit to width (0)"
            >
              Fit width
            </button>
          </>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          {showDownload && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              download={downloadName}
              aria-label="Download resume"
              title="Download the original file"
              className={toolButton}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
          {onOpenFullscreen && (
            <button type="button" className={toolButton} onClick={onOpenFullscreen} aria-label="Open resume full screen" title="Full screen">
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {onCollapse && (
            <button type="button" className={toolButton} onClick={onCollapse} aria-label="Hide resume" title="Hide resume">
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>

      <div className={cn("relative min-h-0 flex-1 bg-slate-100", bodyClassName)}>
        {kind === "pdf" ? (
          // Re-keyed so a zoom change reloads the viewer at the new fragment.
          <iframe key={zoom ?? "fit"} src={buildPdfViewerUrl(url, zoom)} title={title} className="absolute inset-0 h-full w-full border-none bg-white" />
        ) : kind === "image" ? (
          <PannableImage url={url} alt={title} zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <div className="max-w-sm space-y-3 rounded-md border border-slate-300 bg-white p-6 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true" />
              <p className="text-sm text-slate-700">This file type cannot be previewed here.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                download={downloadName}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-hover md:min-h-9"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download document
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Image at a percentage of the container width. Mouse and pen drag to pan; Ctrl + wheel zooms; touch scrolls natively. */
const PannableImage: React.FC<{ url: string; alt: string; zoom: number | null; onZoomIn: () => void; onZoomOut: () => void }> = ({
  url,
  alt,
  zoom,
  onZoomIn,
  onZoomOut,
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const zoomHandlers = useRef({ onZoomIn, onZoomOut });
  zoomHandlers.current = { onZoomIn, onZoomOut };

  // A non-passive listener is needed to stop the browser zooming the whole page on Ctrl + wheel.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (event.deltaY < 0) zoomHandlers.current.onZoomIn();
      else if (event.deltaY > 0) zoomHandlers.current.onZoomOut();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (!el || event.pointerType === "touch" || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    setDragging(true);
    el.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    const start = drag.current;
    if (!el || !start) return;
    el.scrollLeft = start.left - (event.clientX - start.x);
    el.scrollTop = start.top - (event.clientY - start.y);
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    scroller.current?.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      ref={scroller}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn("absolute inset-0 overflow-auto [touch-action:pan-x_pan-y]", dragging ? "cursor-grabbing select-none" : "cursor-grab")}
    >
      <img src={url} alt={alt} draggable={false} style={{ width: `${zoom ?? 100}%`, maxWidth: "none" }} className="block h-auto bg-white" />
    </div>
  );
};

export interface InlineResumeViewerProps {
  resumeUrl?: string | null;
  candidateName: string;
  candidateInitials?: string;
  photoUrl?: string | null;
  onOpenFullscreen?: () => void;
  onInspectPhoto?: () => void;
  onCollapse?: () => void;
  /** Replaces the default document height (used by the drawer). */
  bodyClassName?: string;
  className?: string;
}

/** The candidate's resume with the shared viewer toolbar. With no file it is a short "No resume uploaded" block, never a tall empty box. */
export const InlineResumeViewer: React.FC<InlineResumeViewerProps> = ({
  resumeUrl,
  candidateName,
  onOpenFullscreen,
  onCollapse,
  bodyClassName,
  className,
}) => {
  const url = resumeUrl?.trim();

  if (!url) {
    return (
      <div className={cn("flex min-h-[160px] flex-col items-start justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 p-5", className)}>
        <div className="flex w-full items-start justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">No resume uploaded</p>
          {onCollapse && (
            <button type="button" onClick={onCollapse} aria-label="Hide resume" title="Hide resume" className={cn(toolButton, "-mr-1.5 -mt-1")}>
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600">{candidateName} did not attach a file to this application.</p>
      </div>
    );
  }

  return (
    <DocumentViewer
      url={url}
      kind={detectDocumentKind(url)}
      title={`${candidateName} - Resume`}
      downloadName={`${candidateName.replace(/\s+/g, "_")}_Resume`}
      onOpenFullscreen={onOpenFullscreen}
      onCollapse={onCollapse}
      bodyClassName={bodyClassName}
      className={cn("h-full", className)}
    />
  );
};
