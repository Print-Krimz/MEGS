import React, { useRef, useState } from "react";
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
  { report: "pipeline", format: "pdf", label: "Candidate pipeline (PDF)" },
  { report: "pipeline", format: "xlsx", label: "Candidate pipeline (Excel)" },
  { report: "deployments", format: "pdf", label: "Deployments (PDF)" },
  { report: "deployments", format: "xlsx", label: "Deployments (Excel)" },
];

export const ExportMenu: React.FC<ExportMenuProps> = ({ onExport, fileNamePrefix }) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (report: ReportKind, format: ReportFormat) => {
    detailsRef.current?.removeAttribute("open");
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
    <div className="relative">
      <details ref={detailsRef} className="group">
        <summary
          className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-[#D9E2EC] bg-white px-4 text-sm font-medium text-[#0B315D] hover:bg-[#EAF0F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2"
          aria-busy={busy}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {busy ? "Preparing..." : "Export"}
        </summary>
        <ul className="absolute right-0 z-20 mt-1 w-60 border border-slate-300 bg-white py-1 shadow-md" role="menu">
          {OPTIONS.map((o) => (
            <li key={`${o.report}-${o.format}`} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => run(o.report, o.format)}
                className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      </details>
      {error && (
        <p role="alert" className="absolute right-0 mt-1 w-64 border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
          {error}
        </p>
      )}
    </div>
  );
};
