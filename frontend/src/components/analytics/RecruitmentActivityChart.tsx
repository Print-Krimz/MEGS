import React, { useState } from "react";
import { TrendingUp, AlertCircle, Eye, EyeOff } from "lucide-react";
import type { RecruitmentActivityTrend, DailyActivityPoint } from "../../lib/types/analytics.types";

interface MetricConfig {
  key: keyof Omit<DailyActivityPoint, "date" | "label">;
  label: string;
  color: string;
  bgBadge: string;
  borderBadge: string;
  textColor: string;
}

const METRICS: MetricConfig[] = [
  {
    key: "applicationsReceived",
    label: "Applications Received",
    color: "#0f766e", // teal-700
    bgBadge: "bg-teal-50",
    borderBadge: "border-teal-300",
    textColor: "text-teal-900",
  },
  {
    key: "initialInterviewsCompleted",
    label: "Initial Interviews",
    color: "#2563eb", // blue-600
    bgBadge: "bg-blue-50",
    borderBadge: "border-blue-300",
    textColor: "text-blue-900",
  },
  {
    key: "clientEndorsements",
    label: "Client Endorsements",
    color: "#7c3aed", // violet-600
    bgBadge: "bg-purple-50",
    borderBadge: "border-purple-300",
    textColor: "text-purple-900",
  },
  {
    key: "finalInterviewsCompleted",
    label: "Final Interviews",
    color: "#d97706", // amber-600
    bgBadge: "bg-amber-50",
    borderBadge: "border-amber-300",
    textColor: "text-amber-900",
  },
  {
    key: "candidatesMovedToCompliance",
    label: "Moved to Compliance",
    color: "#e11d48", // rose-600
    bgBadge: "bg-rose-50",
    borderBadge: "border-rose-300",
    textColor: "text-rose-900",
  },
  {
    key: "candidatesDeployed",
    label: "Site Deployments",
    color: "#059669", // emerald-600
    bgBadge: "bg-emerald-50",
    borderBadge: "border-emerald-300",
    textColor: "text-emerald-900",
  },
];

interface RecruitmentActivityChartProps {
  data?: RecruitmentActivityTrend;
  title?: string;
  subtitle?: string;
}

export const RecruitmentActivityChart: React.FC<RecruitmentActivityChartProps> = ({
  data,
  title = "Daily Recruitment Activity Trend",
  subtitle = "Daily volume of candidate applications, screening milestones, endorsements, and site deployments over time",
}) => {
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({
    applicationsReceived: true,
    initialInterviewsCompleted: true,
    clientEndorsements: true,
    finalInterviewsCompleted: true,
    candidatesMovedToCompliance: true,
    candidatesDeployed: true,
  });

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = data?.series || [];
  const totals = data?.totals;

  const totalActivity = series.reduce(
    (acc, pt) =>
      acc +
      pt.applicationsReceived +
      pt.initialInterviewsCompleted +
      pt.clientEndorsements +
      pt.finalInterviewsCompleted +
      pt.candidatesMovedToCompliance +
      pt.candidatesDeployed,
    0
  );

  const toggleMetric = (key: string) => {
    setActiveKeys((prev) => {
      // Ensure at least one metric remains active
      const currentlyActive = Object.values(prev).filter(Boolean).length;
      if (currentlyActive <= 1 && prev[key]) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  // SVG Chart Geometry
  const width = 900;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 35, left: 45 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Compute maximum Y across all active metrics
  let maxY = 5;
  series.forEach((pt) => {
    METRICS.forEach((m) => {
      if (activeKeys[m.key]) {
        const val = Number(pt[m.key]) || 0;
        if (val > maxY) maxY = val;
      }
    });
  });

  // Round maxY up to a readable integer ceiling
  maxY = Math.ceil(maxY * 1.15) || 5;

  const getX = (index: number) => {
    if (series.length <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (series.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return padding.top + plotHeight - (val / maxY) * plotHeight;
  };

  const yTicks = [0, Math.round(maxY * 0.25), Math.round(maxY * 0.5), Math.round(maxY * 0.75), maxY];

  // Pick ~6 readable x-axis labels
  const step = Math.max(1, Math.floor(series.length / 6));
  const xIndices = series.map((_, i) => i).filter((i) => i % step === 0 || i === series.length - 1);

  const hoveredPoint = hoverIndex !== null && series[hoverIndex] ? series[hoverIndex] : null;

  return (
    <div className="border border-slate-300 bg-white">
      {/* Header & Metric Toggles */}
      <div className="p-3.5 border-b border-slate-300 bg-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-800" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              {title}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">{subtitle}</p>
        </div>

        {/* Metric Toggle Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {METRICS.map((m) => {
            const isActive = activeKeys[m.key];
            const metricCount = totals ? totals[m.key] : 0;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleMetric(m.key)}
                className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? `${m.bgBadge} ${m.borderBadge} ${m.textColor}`
                    : "bg-slate-100 border-slate-300 text-slate-400 opacity-60 hover:opacity-100"
                }`}
                title={`Toggle ${m.label} visibility`}
              >
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: isActive ? m.color : "#94a3b8" }}
                />
                <span>{m.label}</span>
                <span className="tabular-nums font-mono opacity-80">({metricCount})</span>
                {isActive ? (
                  <Eye className="w-2.5 h-2.5 opacity-60" />
                ) : (
                  <EyeOff className="w-2.5 h-2.5 opacity-40" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Canvas or Empty State */}
      {series.length === 0 || totalActivity === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
          <AlertCircle className="w-6 h-6 text-slate-400" />
          <div className="text-xs font-mono font-bold uppercase text-slate-800">
            No recruitment activity was recorded for this period.
          </div>
          <p className="text-[11px] text-slate-500 max-w-md">
            No candidate applications, interviews, endorsements, or site deployments occurred during the selected dates.
            Try selecting a broader date range or resetting your filters.
          </p>
        </div>
      ) : (
        <div className="p-3.5 relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[600px] select-none"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Grid Lines & Y-Axis Labels */}
            {yTicks.map((tickVal) => {
              const y = getY(tickVal);
              return (
                <g key={tickVal}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray={tickVal === 0 ? "0" : "3,3"}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[9px] font-mono fill-slate-400 font-bold"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Labels */}
            {xIndices.map((idx) => {
              const pt = series[idx];
              if (!pt) return null;
              const x = getX(idx);
              return (
                <g key={pt.date}>
                  <line
                    x1={x}
                    y1={padding.top + plotHeight}
                    x2={x}
                    y2={padding.top + plotHeight + 4}
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={padding.top + plotHeight + 16}
                    textAnchor="middle"
                    className="text-[9px] font-mono fill-slate-500 font-bold"
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })}

            {/* Metric Polyline Series */}
            {METRICS.map((m) => {
              if (!activeKeys[m.key]) return null;

              const points = series
                .map((pt, i) => `${getX(i)},${getY(Number(pt[m.key]) || 0)}`)
                .join(" ");

              return (
                <g key={m.key}>
                  <polyline
                    fill="none"
                    stroke={m.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />

                  {/* Individual data point dots */}
                  {series.map((pt, i) => {
                    const val = Number(pt[m.key]) || 0;
                    if (val === 0 && series.length > 20) return null; // Keep visual clutter low on dense ranges
                    const cx = getX(i);
                    const cy = getY(val);
                    return (
                      <circle
                        key={`${m.key}-${i}`}
                        cx={cx}
                        cy={cy}
                        r={hoverIndex === i ? "4" : "2"}
                        fill={m.color}
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Hover Crosshair & Invisible Interaction Hitboxes */}
            {series.map((_, i) => {
              const cx = getX(i);
              const colWidth = plotWidth / (series.length || 1);
              return (
                <rect
                  key={`hit-${i}`}
                  x={cx - colWidth / 2}
                  y={padding.top}
                  width={colWidth}
                  height={plotHeight}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIndex(i)}
                />
              );
            })}

            {/* Vertical Hover Indicator Line */}
            {hoverIndex !== null && (
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={padding.top + plotHeight}
                stroke="#475569"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            )}
          </svg>

          {/* Interactive Tooltip Card */}
          {hoveredPoint && hoverIndex !== null && (
            <div
              className="absolute pointer-events-none z-20 bg-slate-950 text-white border border-slate-800 p-2 shadow-xl font-mono text-[11px] min-w-[190px]"
              style={{
                top: "20px",
                left: `${Math.min(
                  Math.max(20, (hoverIndex / (series.length - 1 || 1)) * 100),
                  75
                )}%`,
              }}
            >
              <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1 flex items-center justify-between">
                <span>{hoveredPoint.label}</span>
                <span className="text-[9px] text-slate-400">{hoveredPoint.date}</span>
              </div>
              <div className="space-y-0.5">
                {METRICS.map((m) => {
                  if (!activeKeys[m.key]) return null;
                  const val = Number(hoveredPoint[m.key]) || 0;
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-3 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                        <span className="text-slate-300">{m.label}:</span>
                      </div>
                      <span className="font-bold text-white tabular-nums">{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
