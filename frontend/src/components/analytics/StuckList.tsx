import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Download, type LucideIcon } from "lucide-react";
import type { StuckCandidate } from "../../lib/types/analytics.types";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { STAGE_RAMP, WAIT } from "../../lib/chart-palette";
import { PaginationBar } from "./PaginationBar";
import { StackedBar } from "./chart-primitives";
import { StuckPreviewDialog } from "./StuckPreviewDialog";
import { daysAgoText } from "../../lib/analytics-format";
import { formatDate } from "../../lib/utils";
import { downloadCsv, toCsv } from "../../lib/csv";
import { getManilaToday } from "../../lib/field-limits";
import { BulkActionBar } from "../common/BulkActionBar";

/** An action on every ticked row, listed in the Bulk actions menu. Reject to report a failure and keep the selection. */
export interface StuckBulkAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  run: (rows: StuckCandidate[]) => Promise<void> | void;
}

/** An extra button on each row. */
export interface StuckRowAction {
  key: string;
  label: string;
  run: (row: StuckCandidate) => Promise<void> | void;
}

interface StuckListProps {
  rows: StuckCandidate[];
  /** Admin sees every recruiter and links to read-only pages. A TA sees their own and links to their working pages. */
  viewer?: "admin" | "ta";
  /** Show which recruiter holds each candidate. Off on the recruiter page, where every row is theirs. Defaults to on for Admin. */
  showRecruiter?: boolean;
  id?: string;
  title?: string;
  subtitle?: string;
  /** Total before the server capped the list. */
  total: number;
  /** Candidates on closed openings. They are not listed because no one needs to act on them. */
  closedOpenings?: number;
  pageSize?: number;
  /** Content only, for use inside a tab. */
  bare?: boolean;
  /** Applies a filter from outside, e.g. a click on the attention strip. A new nonce re-applies it. */
  focus?: { urgency?: "ALL" | "critical"; stage?: string; nonce: number };
  /** History state added to the Admin links, so the detail page can return to the same report. */
  linkState?: Record<string, unknown>;
  /** A checkbox on each row, Select all, and a Bulk actions menu. Export selected is always in the menu. */
  selectable?: boolean;
  /** Menu items added before Export selected. */
  bulkActions?: StuckBulkAction[];
  rowActions?: StuckRowAction[];
}

const URGENCY = {
  critical: { label: "Critical", badge: "bg-[#FDF1F2] text-[#B42318]" },
  overdue: { label: "Overdue", badge: "bg-[#FFF4DC] text-[#7A4800]" },
} as const;

const CHECKBOX = "h-4 w-4 cursor-pointer accent-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1";

const ROW_BUTTON =
  "inline-flex min-h-11 items-center px-1 text-xs font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 md:min-h-9";

const CSV_HEADERS = ["Candidate", "Job", "Client", "Recruiter", "Stage", "Days in stage", "Days allowed", "Days over", "Urgency", "Last activity", "Last note"];

const csvRow = (r: StuckCandidate) => [
  r.candidateName,
  r.jobTitle,
  r.clientName,
  r.recruiterName,
  r.stageLabel,
  r.daysInStage,
  r.slaDays,
  r.daysOver,
  URGENCY[r.urgency].label,
  r.lastActivityAt ? r.lastActivityAt.slice(0, 10) : null,
  r.lastNote,
];

/** Menu button with the actions for the ticked rows. Escape closes it and returns focus to the button. */
const BulkMenu: React.FC<{ actions: StuckBulkAction[]; busy: boolean; onRun: (action: StuckBulkAction) => void }> = ({ actions, busy, onRun }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (event.key === "Tab") setOpen(false);
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

  const onItemKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const at = items.indexOf(event.currentTarget as HTMLButtonElement);
    items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 border border-navy bg-white px-3 text-xs font-semibold text-navy hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 md:min-h-9"
      >
        {busy ? "Working" : "Bulk actions"}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label="Bulk actions" className="absolute left-0 z-20 mt-1 w-56 border border-slate-300 bg-white py-1 shadow-md">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              onKeyDown={onItemKeyDown}
              onClick={() => {
                setOpen(false);
                onRun(a);
              }}
              className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus md:min-h-9"
            >
              {a.icon && <a.icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SELECT =
  "min-h-9 border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Days in the stage as a bar: a pale baseline up to the limit, then only the days past it in colour. */
const WaitBar: React.FC<{ row: number; r: StuckCandidate; color: string; index: number; className?: string }> = ({ row: scale, r, color, index, className }) => (
  <StackedBar
    className={className}
    label={`${r.stageLabel}, days in stage, limit ${r.slaDays} ${r.slaDays === 1 ? "day" : "days"}`}
    max={scale}
    heightClass="h-2"
    index={index}
    segments={[
      { key: "within", label: "Within days allowed", value: Math.min(r.daysInStage, r.slaDays), color: WAIT.withinLimit },
      { key: "over", label: "Past days allowed", value: Math.max(0, r.daysInStage - r.slaDays), color },
    ]}
  />
);

/** Candidates past their days allowed, longest wait first, so it is clear who is holding them up. */
export const StuckList = React.memo(function StuckList({
  rows,
  total,
  closedOpenings = 0,
  pageSize = 8,
  viewer = "admin",
  showRecruiter,
  id = "waiting-too-long",
  title = "Overdue candidates",
  subtitle = "Past the days allowed for their stage, longest wait first. Critical means twice the days allowed or more.",
  bare = false,
  focus,
  linkState,
  selectable = false,
  bulkActions = [],
  rowActions = [],
}: StuckListProps) {
  const admin = viewer === "admin";
  const withRecruiter = showRecruiter ?? admin;
  const [urgency, setUrgency] = useState<"ALL" | "critical">("ALL");
  const [stage, setStage] = useState("ALL");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewMove, setPreviewMove] = useState(false);
  // Ticked rows, by application id. They stay ticked across pages and filters.
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const pageBoxRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (!focus) return;
    setUrgency(focus.urgency ?? "ALL");
    setStage(focus.stage ?? "ALL");
    setQuery("");
    setPreviewId(null);
    setPage(1);
  }, [focus?.nonce, focus?.urgency, focus?.stage]);

  // A stage picked from the chart may have no row in the loaded list (only the longest waits load); keep it selectable so the select shows the real filter.
  const stages = useMemo(() => {
    const byStage = new Map<string, string>(rows.map((r) => [r.stage, r.stageLabel]));
    if (stage !== "ALL" && !byStage.has(stage)) byStage.set(stage, STAGE_RAMP.find((s) => s.key === stage)?.label ?? stage);
    return [...byStage.entries()];
  }, [rows, stage]);
  const criticalCount = rows.filter((r) => r.urgency === "critical").length;

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (urgency === "ALL" || r.urgency === "critical") &&
          (stage === "ALL" || r.stage === stage) &&
          (!needle ||
            [r.candidateName, r.jobTitle, r.clientName, withRecruiter ? r.recruiterName : ""].some((v) => (v ?? "").toLowerCase().includes(needle)))
      ),
    [rows, urgency, stage, needle, withRecruiter]
  );

  // Only rows the filters show stay ticked, so a bulk action never reaches a hidden row. This also drops candidates a refresh removed.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(visible.map((r) => r.applicationId));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visible]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  // One scale for the page so the bars compare, wide enough to show every limit mark.
  const scale = Math.max(1, ...pageRows.map((r) => Math.max(r.daysInStage, r.slaDays)));
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.applicationId)), [rows, selected]);
  const pageSelected = pageRows.filter((r) => selected.has(r.applicationId)).length;
  const allOnPage = pageRows.length > 0 && pageSelected === pageRows.length;
  useEffect(() => {
    if (pageBoxRef.current) pageBoxRef.current.indeterminate = pageSelected > 0 && !allOnPage;
  }, [pageSelected, allOnPage]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of pageRows) {
        if (allOnPage) next.delete(r.applicationId);
        else next.add(r.applicationId);
      }
      return next;
    });

  const exportSelected = (picked: StuckCandidate[]) => {
    downloadCsv(`MEGS_overdue_candidates_${getManilaToday()}`, toCsv(CSV_HEADERS, picked.map(csvRow)));
    setNotice(`Exported ${picked.length} ${picked.length === 1 ? "candidate" : "candidates"}.`);
  };
  const menuActions: StuckBulkAction[] = [...bulkActions, { key: "export", label: "Export selected", icon: Download, run: exportSelected }];

  // An action that rejects has already told the person why; the selection stays so they can try again.
  const runBulk = async (action: StuckBulkAction) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await action.run(selectedRows);
      setSelected(new Set());
    } catch {
      /* reported by the action */
    } finally {
      setBusy(false);
      // The menu and, on success, the selection bar are gone; keep keyboard focus in the list.
      pageBoxRef.current?.focus();
    }
  };
  const runRow = async (action: StuckRowAction, row: StuckCandidate) => {
    if (busy) return;
    setBusy(true);
    try {
      await action.run(row);
    } catch {
      /* reported by the action */
    } finally {
      setBusy(false);
    }
  };

  const reset = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <AnalyticsPanel tone="reports" id={id} title={title} subtitle={closedOpenings > 0 ? `${subtitle} ${closedOpenings} more are on closed job openings.` : subtitle} bare={bare} aside={<span className="tabular-nums">{total} waiting</span>}>
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-slate-200 px-3.5 py-2.5">
          <div role="group" aria-label="Filter by urgency" className="flex gap-1.5">
            {(["ALL", "critical"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={urgency === key}
                onClick={() => reset(() => setUrgency(key))}
                className={`min-h-9 px-2.5 text-xs font-semibold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  urgency === key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {key === "ALL" ? "All" : "Critical"} <span className="tabular-nums font-normal">{key === "ALL" ? rows.length : criticalCount}</span>
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-0.5 text-xs text-slate-700">
            <span className="text-xs font-semibold text-slate-600">Stage</span>
            <select value={stage} onChange={(e) => reset(() => setStage(e.target.value))} className={SELECT}>
              <option value="ALL">All stages</option>
              {stages.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center gap-2 text-xs text-slate-700 sm:ml-auto sm:w-auto">
            <span className="text-xs font-semibold text-slate-600">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={withRecruiter ? "Candidate, job, client or recruiter" : "Candidate, job or client"}
              className="min-h-9 w-full border border-slate-300 bg-white px-2.5 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-56"
            />
          </label>
        </div>
      )}

      {selectable && (
        <>
          {selected.size > 0 && (
            <div className="border-b border-slate-200 px-3.5 py-2.5">
              <BulkActionBar count={selected.size} onClear={() => {
                  setSelected(new Set());
                  pageBoxRef.current?.focus();
                }} floating={false}>
                <BulkMenu actions={menuActions} busy={busy} onRun={runBulk} />
              </BulkActionBar>
            </div>
          )}
          <p role="status" className="sr-only">
            {notice}
          </p>
        </>
      )}

      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No one is past the days allowed.</p>
      ) : pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">
          {needle ? `No overdue candidates match “${query.trim()}”.` : "No match. Change the filters."}
        </p>
      ) : (
        <>
        {selectable && (
          <label className="flex min-h-11 cursor-pointer items-center gap-1 border-b border-slate-200 bg-slate-50 pl-1 pr-3 text-xs font-semibold text-slate-700 md:min-h-9">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center md:h-9 md:w-9">
              <input ref={pageBoxRef} type="checkbox" checked={allOnPage} onChange={togglePage} className={CHECKBOX} />
            </span>
            Select all on this page
          </label>
        )}
        <ul className="divide-y divide-slate-200">
          {pageRows.map((r, i) => {
            const style = URGENCY[r.urgency];
            return (
              <li key={r.applicationId} className={selectable ? "flex items-start gap-1 py-2.5 pl-1 pr-3" : "px-3 py-2.5"}>
                {selectable && (
                  <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center md:h-9 md:w-9">
                    <input type="checkbox" aria-label={`Select ${r.candidateName}`} checked={selected.has(r.applicationId)} onChange={() => toggle(r.applicationId)} className={CHECKBOX} />
                  </label>
                )}
                <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`shrink-0 px-1.5 py-0.5 text-xs font-semibold ${style.badge}`}>{style.label}</span>
                    {admin ? (
                      <Link
                        to="/admin/applications/$applicationId"
                        params={{ applicationId: String(r.applicationId) }}
                        {...(linkState ? { state: linkState as never } : {})}
                        className="truncate text-sm font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {r.candidateName}
                      </Link>
                    ) : (
                      <Link
                        to="/ta/applications/$applicationId"
                        params={{ applicationId: String(r.applicationId) }}
                        className="truncate text-sm font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {r.candidateName}
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3">
                    <span className={`px-1.5 py-0.5 text-xs font-semibold tabular-nums ${style.badge}`}>
                      {r.daysOver} {r.daysOver === 1 ? "day" : "days"} over
                    </span>
                    {!admin && (
                      <button
                        type="button"
                        aria-label={`Move stage: ${r.candidateName}`}
                        onClick={() => {
                          setPreviewMove(true);
                          setPreviewId(r.applicationId);
                        }}
                        className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9"
                      >
                        Move stage
                      </button>
                    )}
                    {rowActions.map((a) => (
                      <button key={a.key} type="button" disabled={busy} aria-label={`${a.label}: ${r.candidateName}`} onClick={() => void runRow(a, r)} className={ROW_BUTTON}>
                        {a.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label={`Quick view: ${r.candidateName}`}
                      onClick={() => {
                        setPreviewMove(false);
                        setPreviewId(r.applicationId);
                      }}
                      className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9"
                    >
                      Quick view
                    </button>
                  </div>
                </div>
                {/* Fixed label column, so every bar starts and ends at the same place whatever its "N of M days" width.
                    Phones: stage and days on one line, the bar full width under them. */}
                <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs font-sans text-slate-700 sm:grid-cols-[9rem_minmax(0,1fr)_6.5rem] sm:gap-y-0">
                  <span className="col-start-1 row-start-1 truncate font-semibold text-slate-900">{r.stageLabel}</span>
                  <WaitBar
                    className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                    row={scale}
                    index={i}
                    r={r}
                    color={r.urgency === "critical" ? WAIT.critical : WAIT.late}
                  />
                  <span className="col-start-2 row-start-1 whitespace-nowrap text-right tabular-nums sm:col-start-3">
                    <strong>{r.daysInStage}</strong> of {r.slaDays} days
                  </span>
                </div>
                <p className="mt-1 text-xs sm:truncate text-slate-600 font-sans">
                  {r.mrfId !== null ? (
                    <Link
                      to={admin ? "/admin/mrfs/$mrfId" : "/ta/mrfs/$mrfId"}
                      params={{ mrfId: String(r.mrfId) }}
                      {...(admin && linkState ? { state: linkState as never } : {})}
                      className="text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {r.jobTitle}
                    </Link>
                  ) : (
                    r.jobTitle
                  )}
                  {r.clientName ? ` · ${r.clientName}` : ""}
                  {r.estimated && <span> · estimated from application date</span>}
                  {withRecruiter && <span title={formatRecruiterName(r.recruiterName).full}> · {formatRecruiterName(r.recruiterName).label}</span>}
                </p>
                {r.lastActivityAt && (
                  <p className="mt-0.5 truncate text-xs text-slate-500 font-sans" title={formatDate(r.lastActivityAt)}>
                    Last activity: {daysAgoText(r.lastActivityAt)}
                    {r.lastNote ? ` · ${r.lastNote}` : ""}
                  </p>
                )}
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}

      <StuckPreviewDialog
        rows={visible}
        openId={previewId}
        focusMove={previewMove}
        onSelect={setPreviewId}
        onClose={() => setPreviewId(null)}
        viewer={viewer}
        showRecruiter={withRecruiter}
        linkState={linkState}
      />
      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="candidates" />
      {total > rows.length && (
        <p className="border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 font-sans">{`Top ${rows.length} of ${total}.`}</p>
      )}
    </AnalyticsPanel>
  );
});
