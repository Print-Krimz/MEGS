import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, Download, X, type LucideIcon } from "lucide-react";
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

/** An action on every ticked row, shown as a button beside Select all. Reject to report a failure and keep the selection. */
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
  critical: { label: "Critical", badge: "rounded-sm border border-[#F5C2C7] bg-[#FDF1F2] text-[#B42318]" },
  overdue: { label: "Overdue", badge: "rounded-sm border border-[#F3D19E] bg-[#FFF4DC] text-[#7A4800]" },
} as const;

const CHECKBOX = "h-4 w-4 cursor-pointer accent-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1";

const ROW_BUTTON =
  "inline-flex min-h-11 items-center rounded-md border border-slate-200 bg-slate-50/90 px-2.5 text-xs font-semibold text-navy transition-colors hover:border-navy-line hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 md:min-h-8";

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

const BULK_BUTTON =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-navy bg-white px-2.5 text-xs font-semibold text-navy shadow-[0_1px_1px_0_rgb(15_23_42/0.04)] hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 md:min-h-8";

const SELECT =
  "min-h-11 md:min-h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-[0_1px_1px_0_rgb(15_23_42/0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Days in the stage as a bar: a pale baseline up to the limit, then only the days past it in colour. */
const WaitBar: React.FC<{ row: number; r: StuckCandidate; color: string; index: number; className?: string }> = ({ row: scale, r, color, index, className }) => (
  <StackedBar
    className={className}
    label={`${r.stageLabel}, days in stage, limit ${r.slaDays} ${r.slaDays === 1 ? "day" : "days"}`}
    max={scale}
    heightClass="h-2.5"
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
  // Bulk Move stage steps Quick view through the ticked rows only; null means the dialog walks the filtered list.
  const [previewSet, setPreviewSet] = useState<StuckCandidate[] | null>(null);
  // Ticked rows, by application id. They stay ticked across pages and filters.
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const pageBoxRef = useRef<HTMLInputElement>(null);

  const focusNonce = focus?.nonce;
  const focusUrgency = focus?.urgency;
  const focusStage = focus?.stage;
  useEffect(() => {
    if (focusNonce === undefined) return;
    setUrgency(focusUrgency ?? "ALL");
    setStage(focusStage ?? "ALL");
    setQuery("");
    setPreviewId(null);
    setPage(1);
  }, [focusNonce, focusUrgency, focusStage]);

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

  // Table columns once the panel is wide: [tick], candidate, stage and wait, last activity, overdue chips, actions.
  const columns = selectable
    ? "@3xl:grid-cols-[2.75rem_minmax(0,2.2fr)_minmax(0,1.7fr)_minmax(0,1.5fr)_minmax(6.5rem,0.8fr)_minmax(17rem,1.5fr)]"
    : "@3xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.7fr)_minmax(0,1.5fr)_minmax(6.5rem,0.8fr)_minmax(17rem,1.5fr)]";
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
  const moveSelected = (picked: StuckCandidate[]) => {
    if (picked.length === 0) return;
    setPreviewSet(picked);
    setPreviewMove(true);
    setPreviewId(picked[0].applicationId);
  };
  const clearSelection = () => {
    setSelected(new Set());
    pageBoxRef.current?.focus();
  };

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
    <AnalyticsPanel
      tone="reports"
      id={id}
      title={title}
      subtitle={closedOpenings > 0 ? `${subtitle} ${closedOpenings} more are on closed job openings.` : subtitle}
      bare={bare}
      aside={<span className="tabular-nums">{total} waiting</span>}
    >
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50/85 px-4 py-3">
          <div role="group" aria-label="Filter by urgency" className="flex gap-1.5">
            {(["ALL", "critical"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={urgency === key}
                onClick={() => reset(() => setUrgency(key))}
                className={`min-h-11 md:min-h-9 rounded-md px-3 text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  urgency === key
                    ? "bg-navy text-white border-navy shadow-[0_1px_2px_0_rgb(15_23_42/0.12)]"
                    : "bg-white text-slate-700 border-slate-300 hover:border-navy-line hover:bg-navy-soft"
                }`}
              >
                {key === "ALL" ? "All" : "Critical"}{" "}
                <span
                  className={`ml-0.5 inline-block rounded-full px-1.5 py-0.2 tabular-nums ${
                    urgency === key
                      ? "bg-white/20 text-white font-bold"
                      : key === "critical" && criticalCount > 0
                        ? "bg-[#FDF1F2] font-bold text-[#B42318]"
                        : "bg-slate-100 text-slate-600 font-semibold"
                  }`}
                >
                  {key === "ALL" ? Math.max(total, rows.length) : criticalCount}
                </span>
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
              className="min-h-11 md:min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm shadow-[0_1px_1px_0_rgb(15_23_42/0.03)] placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-64"
            />
          </label>
        </div>
      )}

      {selectable && (
        <>
          <p role="status" className="sr-only">
            {notice}
          </p>
        </>
      )}

      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-600 font-sans">No one is past the days allowed.</p>
      ) : pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-600 font-sans">
          {needle
            ? `No overdue candidates match “${query.trim()}”.`
            : stage !== "ALL" && urgency === "ALL"
              ? `No one in ${STAGE_RAMP.find((s) => s.key === stage)?.label ?? stage} is past the days allowed.`
              : "No match. Change the filters."}
        </p>
      ) : (
        <>
          {selectable && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-100/70 pl-1 pr-3 text-xs font-semibold text-slate-700">
              <label className="flex min-h-11 cursor-pointer items-center gap-1 md:min-h-9">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center md:h-9 md:w-9">
                  <input ref={pageBoxRef} type="checkbox" checked={allOnPage} onChange={togglePage} className={CHECKBOX} />
                </span>
                Select all on this page
              </label>
              {/* The actions appear on this row once something is ticked, so they sit next to what they act on. */}
              {selected.size > 0 && (
                <div role="group" aria-label="Actions for the ticked candidates" className="flex flex-wrap items-center gap-2 py-1.5">
                  <span role="status" className="rounded-sm bg-navy px-2 py-0.5 tabular-nums text-white">
                    {selected.size} selected
                  </span>
                  {!admin && (
                    <button type="button" disabled={busy} onClick={() => moveSelected(selectedRows)} className={BULK_BUTTON}>
                      <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      Move stage
                    </button>
                  )}
                  {bulkActions.map((a) => (
                    <button key={a.key} type="button" disabled={busy} onClick={() => void runBulk(a)} className={BULK_BUTTON}>
                      {a.icon && <a.icon className="h-3.5 w-3.5" aria-hidden="true" />}
                      {busy ? "Working" : a.label}
                    </button>
                  ))}
                  <button type="button" disabled={busy} onClick={() => void runBulk({ key: "export", label: "Export selected", run: exportSelected })} className={BULK_BUTTON}>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Export selected
                  </button>
                  <button type="button" onClick={clearSelection} className={`${BULK_BUTTON} border-transparent`}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Container queries: the side menu takes width, so the table starts when this panel is wide enough, not at a screen width. */}
          <div className="@container">
            <div
              aria-hidden="true"
              className={`hidden border-b border-slate-200 bg-slate-100/90 py-2 pr-4 text-xs font-semibold text-slate-700 @3xl:grid @3xl:gap-x-4 ${selectable ? "pl-1" : "pl-4"} ${columns}`}
            >
              {selectable && <span />}
              <span>Candidate</span>
              <span>Stage and wait</span>
              <span>Last activity</span>
              <span>Overdue</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-slate-200/90">
              {pageRows.map((r, i) => {
                const style = URGENCY[r.urgency];
                const recruiter = formatRecruiterName(r.recruiterName);
                const link =
                  "truncate text-sm font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
                return (
                  <li
                    key={r.applicationId}
                    className={`relative flex flex-col gap-2 py-3.5 transition-colors hover:bg-navy-soft focus-within:bg-navy-soft motion-reduce:transition-none @3xl:grid @3xl:items-center @3xl:gap-x-4 ${selectable ? "pl-4 pr-12 @3xl:pl-1 @3xl:pr-4" : "pl-4 pr-4"} ${columns}`}
                  >
                    {selectable && (
                      <label className="absolute right-1 top-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center @3xl:static md:h-9 md:w-9">
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.candidateName}`}
                          checked={selected.has(r.applicationId)}
                          onChange={() => toggle(r.applicationId)}
                          className={CHECKBOX}
                        />
                      </label>
                    )}

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`shrink-0 px-1.5 py-0.5 text-xs font-semibold @3xl:hidden ${style.badge}`}>{style.label}</span>
                        {admin ? (
                          <Link
                            to="/admin/applications/$applicationId"
                            params={{ applicationId: String(r.applicationId) }}
                            {...(linkState ? { state: linkState as never } : {})}
                            className={link}
                          >
                            {r.candidateName}
                          </Link>
                        ) : (
                          <Link
                            to="/ta/applications/$applicationId"
                            params={{ applicationId: String(r.applicationId) }}
                            {...(linkState ? { state: linkState as never } : {})}
                            className={link}
                          >
                            {r.candidateName}
                          </Link>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 font-sans @3xl:truncate">
                        {r.mrfId !== null ? (
                          <Link
                            to={admin ? "/admin/mrfs/$mrfId" : "/ta/mrfs/$mrfId"}
                            params={{ mrfId: String(r.mrfId) }}
                            {...(linkState ? { state: linkState as never } : {})}
                            className="text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            {r.jobTitle}
                          </Link>
                        ) : (
                          r.jobTitle
                        )}
                        {r.clientName ? ` · ${r.clientName}` : ""}
                        {r.estimated && <span> · estimated from application date</span>}
                        {withRecruiter && <span title={recruiter.full}> · {recruiter.label}</span>}
                      </p>
                    </div>

                    {/* A short bar under the stage name: enough to compare waits, not a full-width line. */}
                    <div className="min-w-0 text-xs font-sans text-slate-700">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold text-slate-900">{r.stageLabel}</span>
                        <span className="whitespace-nowrap tabular-nums">
                          <strong>{r.daysInStage}</strong> of {r.slaDays} days
                        </span>
                      </div>
                      <WaitBar className="mt-1.5 max-w-44" row={scale} index={i} r={r} color={r.urgency === "critical" ? WAIT.critical : WAIT.late} />
                    </div>

                    <div className={`min-w-0 text-xs text-slate-600 font-sans ${r.lastActivityAt ? "" : "@max-3xl:hidden"}`} title={r.lastActivityAt ? formatDate(r.lastActivityAt) : undefined}>
                      {r.lastActivityAt ? (
                        <span className="line-clamp-2">
                          Last activity: {daysAgoText(r.lastActivityAt)}
                          {r.lastNote ? ` · ${r.lastNote}` : ""}
                        </span>
                      ) : (
                        <>
                          <span aria-hidden="true" className="text-slate-600">—</span>
                          <span className="sr-only">No activity recorded</span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 @3xl:flex-col @3xl:items-start @3xl:gap-1">
                      <span className={`hidden px-1.5 py-0.5 text-xs font-semibold @3xl:inline-block ${style.badge}`}>{style.label}</span>
                      <span className={`text-xs font-semibold tabular-nums ${r.urgency === "critical" ? "text-[#B42318]" : "text-[#7A4800]"}`}>
                        {r.daysOver} {r.daysOver === 1 ? "day" : "days"} over
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 @3xl:flex-nowrap @3xl:justify-end @3xl:whitespace-nowrap">
                      {!admin && (
                        <button
                          type="button"
                          aria-label={`Move stage: ${r.candidateName}`}
                          onClick={() => {
                            setPreviewMove(true);
                            setPreviewId(r.applicationId);
                          }}
                          className={ROW_BUTTON}
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
                        className={ROW_BUTTON}
                      >
                        Quick view
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      <StuckPreviewDialog
        rows={previewSet ?? visible}
        openId={previewId}
        focusMove={previewMove}
        onSelect={setPreviewId}
        onClose={() => {
          setPreviewId(null);
          setPreviewSet(null);
        }}
        viewer={viewer}
        showRecruiter={withRecruiter}
        linkState={linkState}
      />
      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="candidates" />
      {total > rows.length && (
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600 font-sans">{`Top ${rows.length} of ${total}.`}</p>
      )}
    </AnalyticsPanel>
  );
});
