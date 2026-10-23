import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Minus, PanelRightClose, Plus } from "lucide-react";
import { InlineResumeViewer, ZOOM_STEPS, stepZoom, toolButton } from "../InlineResumeViewer";
import { PrintableResume, StandardAtsResume, type AtsRequirement } from "./StandardAtsResume";
import { cn } from "../../../lib/utils";

/** What the MEGS resume is built from. Nothing is stored; it is drawn from the profile each time. */
export interface MegsResumeSource {
  profile: any;
  email?: string | null;
  /** The application tracking code, when it has one. */
  reference?: string | null;
  requirements?: AtsRequirement[];
}

export type ResumeView = "original" | "megs";

const VIEW_KEY = "megs_ta_resume_view";

const readStoredView = (): ResumeView | null => {
  try {
    const stored = sessionStorage.getItem(VIEW_KEY);
    return stored === "original" || stored === "megs" ? stored : null;
  } catch {
    return null;
  }
};

/** The page is A4 wide: 210 mm is 794 px at 96 dpi. 100% zoom shows the sheet at that width. */
const SHEET_WIDTH_PX = 794;

interface MegsViewerProps {
  source: MegsResumeSource;
  onCollapse?: () => void;
  className?: string;
}

/**
 * The MEGS resume with the same toolbar pattern as the original viewer:
 * [-] [zoom] [+] [Fit width] [Show contact details] | [Print] [Full screen] [Hide].
 */
const MegsResumeViewer: React.FC<MegsViewerProps> = ({ source, onCollapse, className }) => {
  const [zoom, setZoom] = useState<number | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [printRun, setPrintRun] = useState(0);
  const [paneWidth, setPaneWidth] = useState(0);
  const pane = useRef<HTMLDivElement>(null);
  const checkId = useId();

  // Fit width: the sheet is scaled to the width of the pane.
  useLayoutEffect(() => {
    const el = pane.current;
    if (!el) return;
    const measure = () => setPaneWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fullscreen]);

  const fitPercent = paneWidth > 0 ? Math.max(30, Math.min(125, Math.floor(((paneWidth - 16) / SHEET_WIDTH_PX) * 100))) : 100;
  const percent = zoom ?? fitPercent;
  const zoomIn = useCallback(() => setZoom(stepZoom(percent, 1)), [percent]);
  const zoomOut = useCallback(() => setZoom(stepZoom(percent, -1)), [percent]);

  useEffect(() => {
    if (!fullscreen) return;
    // Capture phase, so Escape leaves full screen without also closing a screen underneath.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setFullscreen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [fullscreen]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement).tagName === "INPUT") return;
    if (event.key === "+" || event.key === "=") zoomIn();
    else if (event.key === "-" || event.key === "_") zoomOut();
    else if (event.key === "0") setZoom(null);
    else return;
    event.preventDefault();
  };

  const viewer = (
    <div
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white focus:outline-none", className)}
    >
      <div role="toolbar" aria-label="MEGS resume viewer" className="flex min-h-10 shrink-0 flex-wrap items-center gap-0.5 border-b border-slate-300 bg-slate-100 px-1.5">
        <button type="button" className={toolButton} onClick={zoomOut} disabled={percent <= ZOOM_STEPS[0]} aria-label="Zoom out" title="Zoom out (-)">
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <span role="status" aria-label="Zoom level" className="min-w-11 px-1 text-center text-xs font-medium tabular-nums text-slate-800">
          {zoom === null ? "Fit width" : `${zoom}%`}
        </span>
        <button type="button" className={toolButton} onClick={zoomIn} disabled={percent >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Zoom in" title="Zoom in (+)">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        {zoom !== null && (
          <button type="button" className={cn(toolButton, "px-2")} onClick={() => setZoom(null)} title="Fit to width (0)">
            Fit width
          </button>
        )}
        <label htmlFor={checkId} className="ml-2 flex min-h-8 items-center gap-1.5 px-1 text-xs font-medium text-slate-800 pointer-coarse:min-h-11">
          <input id={checkId} type="checkbox" checked={showContact} onChange={(e) => setShowContact(e.target.checked)} className="h-4 w-4" />
          Show contact details
        </label>
        <span className="ml-auto flex items-center gap-0.5">
          <button type="button" className={cn(toolButton, "px-2")} onClick={() => setPrintRun((n) => n + 1)} title="Print the MEGS resume">
            Print
          </button>
          <button
            type="button"
            className={toolButton}
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? "Exit full screen" : "Open full screen"}
            title={fullscreen ? "Exit full screen" : "Full screen"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
          </button>
          {onCollapse && !fullscreen && (
            <button type="button" className={toolButton} onClick={onCollapse} aria-label="Hide resume" title="Hide resume">
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>

      <div ref={pane} className="relative min-h-0 flex-1 overflow-auto bg-slate-100 p-2">
        <div className="mx-auto bg-white p-[12.7mm] shadow-sm" style={{ width: SHEET_WIDTH_PX, zoom: percent / 100 }}>
          <StandardAtsResume {...source} showContact={showContact} />
        </div>
      </div>

    </div>
  );

  return (
    <>
      {fullscreen
        ? createPortal(
            <div role="dialog" aria-modal="true" aria-label="MEGS resume" className="fixed inset-0 z-[100] bg-white p-3">
              {viewer}
            </div>,
            document.body,
          )
        : viewer}
      {printRun > 0 && <PrintableResume key={printRun} {...source} showContact={showContact} onDone={() => setPrintRun(0)} />}
    </>
  );
};

export interface ResumeSwitcherProps {
  /** The uploaded file. Without one, the Original view says so and MEGS resume is shown first. */
  resumeUrl?: string | null;
  candidateName: string;
  /** Leave out when there is no profile yet; only the original file is shown. */
  megs?: MegsResumeSource;
  /** Full screen for the original file. The MEGS resume has its own. */
  onOpenFullscreen?: () => void;
  onCollapse?: () => void;
  className?: string;
}

/** "Original resume" and "MEGS resume" over one document pane. */
export const ResumeSwitcher: React.FC<ResumeSwitcherProps> = ({ resumeUrl, candidateName, megs, onOpenFullscreen, onCollapse, className }) => {
  const hasOriginal = Boolean(resumeUrl?.trim());
  // `stored` is last session choice; `picked` is a click in this view and always wins.
  const [stored] = useState<ResumeView | null>(readStoredView);
  const [picked, setPicked] = useState<ResumeView | null>(null);

  if (!megs) {
    return <InlineResumeViewer resumeUrl={resumeUrl} candidateName={candidateName} onOpenFullscreen={onOpenFullscreen} onCollapse={onCollapse} className={className} />;
  }

  // With no uploaded file the MEGS resume is the first thing to see.
  const view: ResumeView = picked ?? (hasOriginal ? stored ?? "original" : "megs");
  const choose = (next: ResumeView) => {
    setPicked(next);
    try {
      sessionStorage.setItem(VIEW_KEY, next);
    } catch {
      // Storage can be blocked; the choice then lasts until the page is closed.
    }
  };

  const option = (id: ResumeView, label: string) => (
    <button
      type="button"
      aria-pressed={view === id}
      onClick={() => choose(id)}
      className={cn(
        "focus-ring min-h-8 flex-1 rounded px-3 text-sm font-medium pointer-coarse:min-h-11",
        view === id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-300" : "text-slate-700 hover:bg-slate-200/70",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2", className)}>
      <div role="group" aria-label="Resume version" className="flex shrink-0 gap-0.5 rounded-md bg-slate-100 p-0.5">
        {option("original", "Original resume")}
        {option("megs", "MEGS resume")}
      </div>
      <div className="min-h-0 flex-1">
        {view === "original" ? (
          <InlineResumeViewer resumeUrl={resumeUrl} candidateName={candidateName} onOpenFullscreen={onOpenFullscreen} onCollapse={onCollapse} className="h-full" />
        ) : (
          <MegsResumeViewer source={megs} onCollapse={onCollapse} />
        )}
      </div>
    </div>
  );
};
