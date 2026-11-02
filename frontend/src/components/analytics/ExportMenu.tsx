import React, { useEffect, useId, useRef, useState } from "react";
import { getManilaToday } from "../../lib/field-limits";
import { Download } from "lucide-react";

export type ReportKind = "pipeline" | "deployments";
export type ReportFormat = "pdf" | "xlsx";

interface ExportMenuProps {
  /** Resolves to the file blob; the menu saves it and shows any failure. */
  onExport: (report: ReportKind, format: ReportFormat) => Promise<Blob>;
  fileNamePrefix: string;
}

const OPTIONS: { report: ReportKind; format: ReportFormat; label: string }[] = [
  { report: "pipeline", format: "pdf", label: "Candidates by stage (PDF)" },
  { report: "pipeline", format: "xlsx", label: "Candidates by stage (Excel)" },
  { report: "deployments", format: "pdf", label: "Starts and backouts (PDF)" },
  { report: "deployments", format: "xlsx", label: "Starts and backouts (Excel)" },
];

export const ExportMenu: React.FC<ExportMenuProps> = ({ onExport, fileNamePrefix }) => {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape and a click outside close the panel; Escape puts focus back on the toggle.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const run = async (report: ReportKind, format: ReportFormat) => {
    setOpen(false);
    setBusy(true);
    setError(null);
    try {
      const blob = await onExport(report, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileNamePrefix}_${report}_${getManilaToday()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("We could not download that report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={busy}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 md:min-h-10 cursor-pointer items-center gap-2 rounded-md border border-navy-line bg-white px-4 text-sm font-medium text-navy hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {busy ? "Preparing..." : "Export"}
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 z-20 mt-1 w-64 border border-slate-300 bg-white py-1 shadow-md">
          <p className="px-3 py-1.5 text-xs text-slate-600">Uses the dates and filters above.</p>
          {OPTIONS.map((o) => (
            <button
              key={`${o.report}-${o.format}`}
              type="button"
              disabled={busy}
              onClick={() => run(o.report, o.format)}
              className="block min-h-11 w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none disabled:opacity-60 md:min-h-0"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="absolute right-0 mt-1 w-64 border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
          {error}
        </p>
      )}
    </div>
  );
};
