import React from "react";
import type { SourceMixRow } from "../../lib/types/analytics.types";
import { APPLICATION_SOURCE_LABELS } from "../../lib/application-sources";
import type { ApplicationSource } from "../../lib/types/application.types";
import { AnalyticsPanel } from "./AnalyticsPanel";

const TH = "px-3 py-2 text-right text-xs font-semibold text-slate-600";
const TD = "px-3 py-2 text-right tabular-nums text-slate-700";

/** Where applicants came from, in the chosen dates. Hired means reached the Deployed stage. */
export const SourceMixPanel: React.FC<{ rows: SourceMixRow[]; className?: string }> = ({ rows, className }) => (
  <AnalyticsPanel
    id="sources"
    tone="reports"
    title="Applicants by source"
    subtitle="Applications received in these dates, by where the applicant came from. Hired means the applicant reached Deployed."
    className={className}
  >
    {rows.length === 0 ? (
      <p className="px-4 py-6 text-sm text-slate-600">No applications in these dates.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Source</th>
              <th scope="col" className={TH}>Received</th>
              <th scope="col" className={TH}>Hired</th>
              <th scope="col" className={TH}>Hire rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.source}>
                <th scope="row" className="px-3 py-2 text-left font-medium text-slate-900">
                  {APPLICATION_SOURCE_LABELS[row.source as ApplicationSource] ?? row.source}
                </th>
                <td className={TD}>{row.received}</td>
                <td className={TD}>{row.hired}</td>
                <td className={TD}>{row.received > 0 ? `${Math.round((row.hired / row.received) * 100)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </AnalyticsPanel>
);
