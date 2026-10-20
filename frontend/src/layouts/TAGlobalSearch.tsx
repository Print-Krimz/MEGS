import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Loader2, Search, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { taApi } from "../lib/api/ta.api";
import { employeesApi } from "../lib/api/employees.api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { getApplicationStatusMeta } from "../lib/utils";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../lib/query-policies";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
const PAGE_SIZE = 5;

type ResultKind = "application" | "employee" | "job" | "client";

interface SearchResult {
  key: string;
  kind: ResultKind;
  id: number;
  title: string;
  detail: string;
}

const GROUPS: { kind: ResultKind; label: string; icon: LucideIcon }[] = [
  { kind: "application", label: "Applications", icon: Users },
  { kind: "employee", label: "Employees", icon: UserRound },
  { kind: "job", label: "Job openings", icon: Briefcase },
  { kind: "client", label: "Clients", icon: Building2 },
];

const sentenceCase = (value?: string | null) =>
  value ? value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "";

const joinDetail = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

const fullName = (profile?: { firstName?: string | null; lastName?: string | null } | null, fallback = "Unnamed") =>
  [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || fallback;

/**
 * Global TA search. One input, one grouped listbox (ARIA combobox pattern).
 * Desktop: input in the header. Mobile: icon button that turns the header into a search bar.
 * Calls existing list endpoints in parallel: applications, employees, job openings (all with a
 * search param, 5 rows) and clients (full list, filtered here because the endpoint has no search).
 */
export const TAGlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const term = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const enabled = term.length >= MIN_CHARS;
  const pending = text.trim() !== term && text.trim().length >= MIN_CHARS;

  const apps = useQuery({
    queryKey: ["ta", "global-search", "applications", term],
    queryFn: ({ signal }) => taApi.listApplicationsPage({ page: 1, limit: PAGE_SIZE, search: term }, { signal }),
    enabled,
    staleTime: 30_000,
  });
  const employees = useQuery({
    queryKey: ["ta", "global-search", "employees", term],
    queryFn: ({ signal }) => employeesApi.listEmployees({ search: term, limit: PAGE_SIZE }, { signal }),
    enabled,
    staleTime: 30_000,
  });
  const jobs = useQuery({
    queryKey: ["ta", "global-search", "jobs", term],
    queryFn: ({ signal }) => taApi.listJobsPage({ search: term, page: 1, limit: PAGE_SIZE }, { signal }),
    enabled,
    staleTime: 30_000,
  });
  const clients = useQuery({
    queryKey: ["ta", "global-search", "clients"],
    queryFn: ({ signal }) => taApi.listClients({ signal }),
    enabled,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const loading = enabled && (apps.isFetching || employees.isFetching || jobs.isFetching || clients.isFetching);

  const results = useMemo<SearchResult[]>(() => {
    if (!enabled) return [];
    const needle = term.toLowerCase();
    const out: SearchResult[] = [];
    for (const a of apps.data?.items ?? []) {
      out.push({
        key: `application-${a.id}`,
        kind: "application",
        id: a.id,
        title: fullName(a.user?.applicantProfile, a.user?.email ?? "Applicant"),
        detail: joinDetail(a.jobPosting?.title, getApplicationStatusMeta(a.status).label),
      });
    }
    for (const e of (employees.data ?? []).slice(0, PAGE_SIZE)) {
      out.push({
        key: `employee-${e.id}`,
        kind: "employee",
        id: e.id,
        title: fullName(e.user?.applicantProfile, e.user?.email ?? e.employeeNumber),
        detail: joinDetail(e.position ?? e.department, e.employeeNumber),
      });
    }
    for (const j of jobs.data?.items ?? []) {
      out.push({
        key: `job-${j.id}`,
        kind: "job",
        id: j.id,
        title: j.title,
        detail: joinDetail(j.mrf?.client?.name, j.location, sentenceCase(j.status)),
      });
    }
    let clientCount = 0;
    for (const c of clients.data ?? []) {
      if (clientCount >= PAGE_SIZE) break;
      const hay = `${c.name} ${c.tradeName ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) continue;
      clientCount += 1;
      out.push({
        key: `client-${c.id}`,
        kind: "client",
        id: c.id,
        title: c.name,
        detail: joinDetail(c.industry, c.contactName),
      });
    }
    return out;
  }, [enabled, term, apps.data, employees.data, jobs.data, clients.data]);

  const close = (clear = false) => {
    setOpen(false);
    setActive(-1);
    if (clear) setText("");
    setMobileOpen(false);
  };

  // Close after any navigation, wherever it came from.
  useEffect(() => {
    setOpen(false);
    setActive(-1);
    setText("");
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus();
  }, [mobileOpen]);

  useEffect(() => setActive(-1), [results.length, term]);

  const go = (r: SearchResult) => {
    switch (r.kind) {
      case "application":
        void navigate({ to: "/ta/applications/$applicationId", params: { applicationId: String(r.id) } });
        break;
      case "employee":
        void navigate({ to: "/ta/employees/$employeeId", params: { employeeId: String(r.id) } });
        break;
      case "job":
        void navigate({ to: "/ta/jobs/$jobId", params: { jobId: String(r.id) } });
        break;
      case "client":
        void navigate({ to: "/ta/clients/$clientId", params: { clientId: String(r.id) } });
        break;
    }
    close(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (results.length) setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      const target = results[active >= 0 ? active : 0];
      if (open && target) {
        e.preventDefault();
        go(target);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (open && text) {
        setOpen(false);
      } else {
        close(true);
        inputRef.current?.blur();
        triggerRef.current?.focus();
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const showPanel = open && text.trim().length > 0;
  const showHint = text.trim().length < MIN_CHARS;
  const nothingFound = enabled && !loading && !pending && results.length === 0;
  const activeId = active >= 0 && results[active] ? `${baseId}-opt-${results[active].key}` : undefined;
  const statusText = showHint
    ? ""
    : loading || pending
      ? "Searching"
      : nothingFound
        ? "No results"
        : `${results.length} result${results.length === 1 ? "" : "s"}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        className="focus-ring md:hidden min-h-11 min-w-11 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        aria-label="Search"
      >
        <Search className="w-4 h-4" aria-hidden="true" />
      </button>

      <div
        ref={rootRef}
        className={
          mobileOpen
            ? "fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-1 border-b border-slate-300 bg-white px-2 md:static md:z-auto md:h-auto md:w-full md:max-w-md md:border-0 md:bg-transparent md:px-0"
            : "hidden md:block md:w-full md:max-w-md"
        }
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label="Search applications, employees, job openings and clients"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search people, jobs, clients"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="focus-ring block min-h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-500 hover:border-slate-400 focus:border-focus md:min-h-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {loading || pending ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-navy" aria-hidden="true" />
          ) : text ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setText("");
                inputRef.current?.focus();
              }}
              className="focus-ring absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 md:h-9 md:w-9"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}

          <div
            id={listId}
            role="listbox"
            aria-label="Search results"
            hidden={!showPanel}
            className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[70vh] overflow-y-auto rounded-md border border-slate-300 bg-white shadow-modal"
            // Keep input focus while pointing at a result.
            onMouseDown={(e) => e.preventDefault()}
          >
            {showHint && <p className="px-3 py-3 text-sm text-slate-600">Type at least {MIN_CHARS} characters.</p>}
            {nothingFound && <p className="px-3 py-3 text-sm text-slate-600">No matches for “{term}”.</p>}
            {(loading || pending) && results.length === 0 && !showHint && (
              <p className="px-3 py-3 text-sm text-slate-600">Searching…</p>
            )}
            {GROUPS.map((group) => {
              const items = results.filter((r) => r.kind === group.kind);
              if (!items.length) return null;
              const Icon = group.icon;
              const headingId = `${baseId}-g-${group.kind}`;
              return (
                <div key={group.kind} role="group" aria-labelledby={headingId} className="border-b border-slate-200 last:border-b-0">
                  <div id={headingId} className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-xs font-semibold text-slate-600">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {group.label}
                  </div>
                  {items.map((r) => {
                    const idx = results.indexOf(r);
                    const isActive = idx === active;
                    return (
                      <div
                        key={r.key}
                        id={`${baseId}-opt-${r.key}`}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => go(r)}
                        onMouseMove={() => active !== idx && setActive(idx)}
                        className={`min-h-11 cursor-pointer px-3 py-1.5 md:min-h-0 ${isActive ? "bg-navy-soft" : "hover:bg-slate-50"}`}
                      >
                        <div className="truncate text-sm font-medium text-slate-900">{r.title}</div>
                        {r.detail && <div className="truncate text-xs text-slate-600">{r.detail}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div role="status" aria-live="polite" className="sr-only">
            {statusText}
          </div>
        </div>
        {mobileOpen && (
          <button
            type="button"
            onClick={() => {
              close(true);
              triggerRef.current?.focus();
            }}
            className="focus-ring min-h-11 shrink-0 rounded-md px-3 text-sm font-medium text-navy md:hidden"
          >
            Cancel
          </button>
        )}
      </div>
    </>
  );
};
