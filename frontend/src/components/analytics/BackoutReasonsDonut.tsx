import React from "react";
import type { BackoutSummary } from "../../lib/types/analytics.types";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { REASON_COLORS } from "../../lib/chart-palette";
import { DonutChart } from "./chart-primitives";

/** The commonest reasons people left in these dates as a ring: the top four, then everything else together. */
export const BackoutReasonsDonut: React.FC<{ data: BackoutSummary; className?: string }> = ({ data, className }) => {
  const total = data.withdrawals + data.backouts;
  const top = data.topReasons.slice(0, REASON_COLORS.length - 1);
  const other = total - top.reduce((sum, r) => sum + r.count, 0);
  const slices = [
    ...top.map((r, i) => ({ key: r.reason, label: r.label, value: r.count, color: REASON_COLORS[i] })),
    ...(other > 0 ? [{ key: "other", label: "Other", value: other, color: REASON_COLORS[REASON_COLORS.length - 1] }] : []),
  ];
  const hasPartyBreakdown =
    total > 0 &&
    Boolean(
      data.byParty &&
        (data.byParty.APPLICANT > 0 || data.byParty.CLIENT > 0 || data.byParty.AGENCY > 0)
    );

  return (
    <AnalyticsPanel
      tone="reports"
      id="backout-reasons"
      title="Why candidates backed out"
      aside={
        total > 0 ? (
          <span className="tabular-nums font-medium text-slate-700">
            <strong className="text-slate-900">{data.backouts}</strong> after review · <strong className="text-slate-900">{data.withdrawals}</strong> early
          </span>
        ) : undefined
      }
      className={`flex flex-col ${className ?? ""}`}
    >
      <div className="flex flex-1 flex-col p-3.5">
        <DonutChart
          size={160}
          label="Why candidates backed out"
          slices={slices}
          centerValue={String(total)}
          centerLabel={total === 1 ? "backout" : "backouts"}
        />
        {total > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-md border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-xs font-sans text-slate-700 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stage timing</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                <span>
                  After client review: <strong className="font-semibold text-navy">{data.backouts}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>
                  Early withdrawal: <strong className="font-semibold text-navy">{data.withdrawals}</strong>
                </span>
                {data.noShows > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>
                      No-shows: <strong className="font-semibold text-[#B42318]">{data.noShows}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
            {hasPartyBreakdown && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Initiated by</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                  <span>
                    Applicant: <strong className="font-semibold text-navy">{data.byParty.APPLICANT}</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>
                    Client: <strong className="font-semibold text-navy">{data.byParty.CLIENT}</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>
                    Agency: <strong className="font-semibold text-navy">{data.byParty.AGENCY}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AnalyticsPanel>
  );
};
