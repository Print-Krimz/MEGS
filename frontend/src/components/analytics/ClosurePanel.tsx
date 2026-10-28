import React from "react";
import type { ClosureSummary } from "../../lib/types/analytics.types";
import { closureReasonLabel } from "../../lib/backout";
import { AnalyticsPanel } from "./AnalyticsPanel";

interface ClosurePanelProps {
  data: ClosureSummary;
  rangeLabel: string;
}

const ROWS = [
  { key: "rejected", label: "Rejected" },
  { key: "backedOut", label: "Backed out" },
] as const;

/** Applications closed in the period: Rejected and Backed Out apart, each split by Talent Pool / Archive. */
export const ClosurePanel: React.FC<ClosurePanelProps> = ({ data, rangeLabel }) => {
  const total = data.rejected.total + data.backedOut.total;
  const hasUnrecorded = data.rejected.notRecorded + data.backedOut.notRecorded > 0;

  return (
    <AnalyticsPanel
      id="closed-applications"
      title="Closed applications"
      subtitle={`Closed ${rangeLabel}. Rejected: we turned them down. Backed out: they dropped out.`}
    >
      {total === 0 ? (
        <p className="px-3.5 py-3 text-xs text-slate-500 font-sans">None closed in this period.</p>
      ) : (
        <div className="p-3.5 space-y-3">
          <table className="w-full text-xs font-sans tabular-nums">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="py-1 pr-2 font-bold">Outcome</th>
                <th className="py-1 px-2 text-right font-bold">Total</th>
                <th className="py-1 px-2 text-right font-bold">Talent pool</th>
                <th className="py-1 px-2 text-right font-bold">Archive</th>
                {hasUnrecorded && <th className="py-1 pl-2 text-right font-bold">Not recorded</th>}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ key, label }) => (
                <tr key={key} className="border-t border-slate-200 text-slate-800">
                  <td className="py-1.5 pr-2 font-semibold">{label}</td>
                  <td className="py-1.5 px-2 text-right">{data[key].total}</td>
                  <td className="py-1.5 px-2 text-right">{data[key].talentPool}</td>
                  <td className="py-1.5 px-2 text-right">{data[key].archive}</td>
                  {hasUnrecorded && <td className="py-1.5 pl-2 text-right">{data[key].notRecorded}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {data.topRejectionReasons.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 mb-1">Top rejection reasons</h3>
              <ul className="space-y-0.5 text-xs text-slate-800 font-sans">
                {data.topRejectionReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-3">
                    <span>{closureReasonLabel(r.reason)}</span>
                    <span className="tabular-nums font-semibold">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AnalyticsPanel>
  );
};
