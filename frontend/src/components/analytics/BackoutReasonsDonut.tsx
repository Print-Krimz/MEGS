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
  return (
    <AnalyticsPanel tone="reports" id="backout-reasons" title="Why candidates backed out" className={`flex flex-col ${className ?? ""}`}>
      <div className="flex flex-1 flex-col p-3.5">
        <DonutChart
          size={160}
          label="Why candidates backed out"
          slices={slices}
          centerValue={String(total)}
          centerLabel={total === 1 ? "backout" : "backouts"}
        />
      </div>
    </AnalyticsPanel>
  );
};
