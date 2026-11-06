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
  const partyTotal = hasPartyBreakdown
    ? data.byParty.APPLICANT + data.byParty.CLIENT + data.byParty.AGENCY
    : 0;

  return (
    <AnalyticsPanel
      tone="reports"
      id="backout-reasons"
      title="Why candidates backed out"
      aside={
        total > 0 ? (
          <div className="flex items-center gap-1.5 text-xs tabular-nums">
            <span className="rounded-sm border border-[#F5C2C7] bg-[#FDF1F2] px-2 py-0.5 font-semibold text-[#B42318]">
              {data.backouts} after review
            </span>
            <span className="rounded-sm border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
              {data.withdrawals} early
            </span>
          </div>
        ) : undefined
      }
      className={`flex flex-col ${className ?? ""}`}
    >
      <div className="flex flex-1 flex-col p-4">
        <DonutChart
          size={156}
          label="Why candidates backed out"
          slices={slices}
          centerValue={String(total)}
          centerLabel={total === 1 ? "backout" : "backouts"}
        />
        {total > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50/90 p-2.5 text-xs font-sans text-slate-700">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stage timing</div>
              <div aria-hidden="true" className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <span style={{ width: `${(data.backouts / total) * 100}%`, backgroundColor: "#B42318" }} />
                <span style={{ width: `${(data.withdrawals / total) * 100}%`, backgroundColor: "#0B315D" }} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                <span>
                  After client review: <strong className="font-bold text-[#B42318]">{data.backouts}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>
                  Early withdrawal: <strong className="font-bold text-navy">{data.withdrawals}</strong>
                </span>
                {data.noShows > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>
                      No-shows: <strong className="font-bold text-[#9A5B00]">{data.noShows}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
            {hasPartyBreakdown && (
              <div className="rounded-md border border-slate-200 bg-slate-50/90 p-2.5 text-xs font-sans text-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Initiated by</div>
                <div aria-hidden="true" className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <span style={{ width: `${partyTotal > 0 ? (data.byParty.APPLICANT / partyTotal) * 100 : 0}%`, backgroundColor: "#1D4ED8" }} />
                  <span style={{ width: `${partyTotal > 0 ? (data.byParty.CLIENT / partyTotal) * 100 : 0}%`, backgroundColor: "#B45309" }} />
                  <span style={{ width: `${partyTotal > 0 ? (data.byParty.AGENCY / partyTotal) * 100 : 0}%`, backgroundColor: "#475569" }} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                  <span>
                    Applicant: <strong className="font-bold text-[#1D4ED8]">{data.byParty.APPLICANT}</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>
                    Client: <strong className="font-bold text-[#9A5B00]">{data.byParty.CLIENT}</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>
                    Agency: <strong className="font-bold text-slate-800">{data.byParty.AGENCY}</strong>
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
