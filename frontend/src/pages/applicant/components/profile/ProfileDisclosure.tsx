import React from "react";
import { ChevronDown } from "lucide-react";

export interface ProfileDisclosureProps {
  id: string;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const ProfileDisclosure: React.FC<ProfileDisclosureProps> = ({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}) => (
  <section className="border-b border-slate-200 last:border-b-0">
    <h3 className="m-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] focus-visible:ring-offset-2"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {summary && <span className="mt-0.5 block text-xs text-slate-500">{summary}</span>}
        </span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </h3>
    {open && <div id={id} className="pb-5">{children}</div>}
  </section>
);
