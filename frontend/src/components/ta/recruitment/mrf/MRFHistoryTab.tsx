import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { Button } from "../../../ui";
import { StatusBadge } from "../../../common";
import { formatDate, displayEmail } from "../../../../lib/utils";

interface MRFHistoryTabProps {
  deployments: any[];
  headcount: number;
  fallbackSite?: string | null;
  readOnly: boolean;
  createdAt?: string | null;
  createdByEmail?: string | null;
}

const profileOf = (d: any) => d.employee?.user?.applicantProfile || d.application?.user?.applicantProfile;

const workerNameOf = (d: any, fallback: string) => {
  const profile = profileOf(d);
  const name = profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : "";
  return name || displayEmail(d.employee?.user?.email) || fallback;
};

const contractPeriod = (d: any) =>
  `${d.contractStart ? formatDate(d.contractStart) : "Not set"} – ${d.contractEnd ? formatDate(d.contractEnd) : "Ongoing"}`;

/** Who was deployed against this request, with the date the request was raised. */
export const MRFHistoryTab: React.FC<MRFHistoryTabProps> = ({ deployments, headcount, fallbackSite, readOnly, createdAt, createdByEmail }) => {
  const [search, setSearch] = useState("");
  const query = search.toLowerCase().trim();
  const filtered = deployments.filter((d: any) => {
    if (!query) return true;
    const site = d.site || fallbackSite || "";
    return (
      workerNameOf(d, "").toLowerCase().includes(query) ||
      (d.employee?.employeeNumber || "").toLowerCase().includes(query) ||
      site.toLowerCase().includes(query)
    );
  });

  return (
    <section className="overflow-hidden rounded-md border border-slate-300 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-slate-950">
            Deployed employees ({deployments.length} of {headcount})
          </h3>
          {createdAt && (
            <p className="text-sm text-slate-600">
              Request raised {formatDate(createdAt)}
              {!readOnly && createdByEmail ? ` by ${createdByEmail}` : ""}.
            </p>
          )}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search deployed employees"
            placeholder={readOnly ? "Search workers by name, employee ID, or site..." : "Search deployed personnel by name, ID, or site..."}
            className="min-h-11 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm focus:border-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-navy md:min-h-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Clear search"
              aria-label="Clear worker search"
              className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center text-slate-500 hover:text-slate-800 focus-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {deployments.length === 0 ? (
        <p className="p-6 text-sm text-slate-600">
          No one is deployed against this request yet. Employees appear here once their deployment record is created.
        </p>
      ) : filtered.length === 0 ? (
        <div className="space-y-2 p-6">
          <p className="text-sm text-slate-600">No deployed personnel matching &quot;{search}&quot;.</p>
          <Button variant="outline" size="sm" onClick={() => setSearch("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-200 md:hidden">
            {filtered.map((d: any) => (
              <li key={d.id} className="space-y-2 p-4">
                <div className="text-sm font-semibold text-slate-900">{workerNameOf(d, "Unnamed worker")}</div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-slate-600">Employee ID</dt><dd>{d.employee?.employeeNumber || "Not assigned"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Site</dt><dd>{d.site || fallbackSite || "Main site"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Contract</dt><dd>{contractPeriod(d)}</dd></div>
                  <div><dt className="text-xs text-slate-600">Status</dt><dd><StatusBadge status={d.status} type="deployment" size="sm" /></dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm text-slate-800">
              <thead className="border-b border-slate-300 bg-slate-50 text-xs font-medium text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Worker</th>
                  <th scope="col" className="px-4 py-2.5">Employee ID</th>
                  <th scope="col" className="px-4 py-2.5">Site</th>
                  <th scope="col" className="px-4 py-2.5">Contract period</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((d: any) => {
                  const name = workerNameOf(d, "Unnamed worker");
                  const mobile = profileOf(d)?.mobileNumber;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        {d.employee?.id && !readOnly ? (
                          <Link
                            to="/ta/employees/$employeeId"
                            params={{ employeeId: String(d.employee.id) }}
                            className="font-medium text-navy underline-offset-2 hover:underline focus-ring"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="font-medium">{name}</span>
                        )}
                        {mobile && <div className="text-xs tabular-nums text-slate-600">{mobile}</div>}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{d.employee?.employeeNumber || "Not assigned"}</td>
                      <td className="px-4 py-2.5">{d.site || fallbackSite || "Main site"}</td>
                      <td className="px-4 py-2.5 tabular-nums">{contractPeriod(d)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={d.status} type="deployment" size="sm" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
