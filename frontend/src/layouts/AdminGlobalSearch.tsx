import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  ClipboardList,
  Compass,
  Loader2,
  Search,
  Users2,
  X,
  type LucideIcon,
} from "lucide-react";
import { adminApi } from "../lib/api/admin.api";
import { taApi } from "../lib/api/ta.api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { displayEmail } from "../lib/utils";
import { resolveUserName } from "../lib/user-name";
import { formatAdminRole } from "../lib/admin-copy";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../lib/query-policies";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
const PAGE_SIZE = 5;

type ResultKind = "page" | "user" | "mrf" | "job" | "client";

type SearchResult =
  | {
      key: string;
      kind: "page";
      to: string;
      title: string;
      detail: string;
    }
  | {
      key: string;
      kind: "user";
      searchQuery: string;
      title: string;
      detail: string;
    }
  | {
      key: string;
      kind: "mrf" | "job" | "client";
      id: number;
      title: string;
      detail: string;
    };

interface AdminPageEntry {
  to: string;
  label: string;
  detail: string;
  keywords: string;
}

const ADMIN_PAGES: AdminPageEntry[] = [
  { to: "/admin", label: "Overview", detail: "Administration overview", keywords: "dashboard home summary" },
  { to: "/admin/analytics", label: "Reports", detail: "Pipeline and team reports", keywords: "analytics charts metrics" },
  { to: "/admin/users", label: "Users", detail: "Accounts, roles and invitations", keywords: "accounts recruiters staff invites" },
  { to: "/admin/clients", label: "Clients", detail: "Client accounts and terms", keywords: "companies accounts" },
  { to: "/admin/mrfs", label: "Manpower requests", detail: "Client staffing requests", keywords: "mrf requisitions requests" },
  { to: "/admin/jobs", label: "Job openings", detail: "Published and draft openings", keywords: "jobs postings vacancies" },
  { to: "/admin/scoring", label: "Matching settings", detail: "Scoring weights and thresholds", keywords: "weights scoring threshold knn" },
  { to: "/admin/scoring/quality", label: "Match results", detail: "Score coverage and failed jobs", keywords: "quality scoring failed jobs" },
  { to: "/admin/audit", label: "Activity history", detail: "System and account audit log", keywords: "audit logs security events" },
  { to: "/admin/maintenance", label: "Backups and recovery", detail: "Database backups and restores", keywords: "backups restore maintenance database" },
  { to: "/admin/settings", label: "Settings", detail: "Account profile and security", keywords: "password profile mfa" },
];

const GROUPS: { kind: ResultKind; label: string; icon: LucideIcon }[] = [
  { kind: "page", label: "Pages", icon: Compass },
  { kind: "user", label: "Users", icon: Users2 },
  { kind: "mrf", label: "Manpower requests", icon: ClipboardList },
  { kind: "job", label: "Job openings", icon: Briefcase },
  { kind: "client", label: "Clients", icon: Building2 },
];

const sentenceCase = (value?: string | null) =>
  value ? value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "";

const joinDetail = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

/**
 * Global Admin search. One input, one grouped listbox (ARIA combobox pattern).
 * Instant client-side Admin page matches plus parallel live queries across users,
 * manpower requests, job openings, and clients once 2+ characters are entered.
 */
export const AdminGlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const trimmedText = text.trim();
  const term = useDebouncedValue(trimmedText, DEBOUNCE_MS);
  const enabled = term.length >= MIN_CHARS;
  const pending = trimmedText !== term && trimmedText.length >= MIN_CHARS;

  const users = useQuery({
    queryKey: ["admin", "global-search", "users", term],
    queryFn: ({ signal }) => adminApi.listUsersPage({ search: term, page: 1, limit: PAGE_SIZE }, { signal }),
    enabled,
    staleTime: 30_000,
  });
  const mrfs = useQuery({
    queryKey: ["admin", "global-search", "mrfs", term],
    queryFn: ({ signal }) => taApi.listMRFsPage({ search: term, page: 1, pageSize: PAGE_SIZE }, { signal }),
    enabled,
    staleTime: 30_000,
  });
  const jobs = useQuery({
    queryKey: ["admin", "global-search", "jobs", term],
    queryFn: ({ signal }) => taApi.listJobsPage({ search: term, page: 1, limit: PAGE_SIZE }, { signal }),
    enabled,
    staleTime: 30_000,
  });
  const clients = useQuery({
    queryKey: ["admin", "global-search", "clients"],
    queryFn: ({ signal }) => taApi.listClients({ signal }),
    enabled,
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  });

  const loading = enabled && (users.isFetching || mrfs.isFetching || jobs.isFetching || clients.isFetching);

  const results = useMemo<SearchResult[]>(() => {
    if (!trimmedText) return [];
    const pageNeedle = trimmedText.toLowerCase();
    const out: SearchResult[] = [];

    let pageCount = 0;
    for (const p of ADMIN_PAGES) {
      if (pageCount >= PAGE_SIZE) break;
      const hay = `${p.label} ${p.detail} ${p.keywords}`.toLowerCase();
      if (!hay.includes(pageNeedle)) continue;
      pageCount += 1;
      out.push({
        key: `page-${p.to}`,
        kind: "page",
        to: p.to,
        title: p.label,
        detail: p.detail,
      });
    }

    if (!enabled) return out;
    const needle = term.toLowerCase();

    for (const u of users.data?.items ?? []) {
      const visibleEmail = displayEmail(u.email);
      const name = resolveUserName({ ...u, email: null }, "");
      const title = name || visibleEmail || "User";
      const searchQuery = visibleEmail || name || term;
      out.push({
        key: `user-${u.id}`,
        kind: "user",
        searchQuery,
        title,
        detail: joinDetail(visibleEmail && visibleEmail !== title ? visibleEmail : undefined, formatAdminRole(u.role)),
      });
    }

    for (const m of mrfs.data?.items ?? []) {
      out.push({
        key: `mrf-${m.id}`,
        kind: "mrf",
        id: m.id,
        title: m.title,
        detail: joinDetail(m.client?.name, m.location, sentenceCase(m.status)),
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
  }, [trimmedText, enabled, term, users.data, mrfs.data, jobs.data, clients.data]);

  const close = (clear = false) => {
    setOpen(false);
    setActive(-1);
    if (clear) setText("");
    setMobileOpen(false);
  };

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
      case "page":
        void navigate({ to: r.to as never });
        break;
      case "user":
        void navigate({ to: "/admin/users", search: { q: r.searchQuery } });
        break;
      case "mrf":
        void navigate({ to: "/admin/mrfs/$mrfId", params: { mrfId: String(r.id) } });
        break;
      case "job":
        void navigate({ to: "/admin/jobs/$jobId", params: { jobId: String(r.id) } });
        break;
      case "client":
        void navigate({ to: "/admin/clients/$clientId", params: { clientId: String(r.id) } });
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

  const showPanel = open && trimmedText.length > 0;
  const showHint = trimmedText.length < MIN_CHARS;
  const nothingFound = enabled && !loading && !pending && results.length === 0;
  const activeId = active >= 0 && results[active] ? `${baseId}-opt-${results[active].key}` : undefined;
  const statusText =
    showHint && results.length === 0
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label="Search admin pages, users, manpower requests, job openings and clients"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search pages, users, requests, jobs, clients"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="focus-ring block min-h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-600 hover:border-slate-400 focus:border-focus md:min-h-9 [&::-webkit-search-cancel-button]:hidden"
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
              className="focus-ring absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-600 hover:text-slate-900 md:h-9 md:w-9"
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
            onMouseDown={(e) => e.preventDefault()}
          >
            {showHint && results.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-600">Type at least {MIN_CHARS} characters.</p>
            )}
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
            {showHint && results.length > 0 && (
              <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                Type {MIN_CHARS} or more characters to search users, requests, jobs and clients.
              </p>
            )}
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
