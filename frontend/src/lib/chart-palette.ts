/**
 * One semantic colour system for every Reports chart (TA and Admin).
 *
 * Rules: colour carries one meaning across charts; red means "backed out" or "overdue" and nothing else (agency responsibility is slate, not red); navy fills
 * are only for the final "Deployed" stage and primary actions; every mark is also named by text (label, value,
 * legend or table), so colour is never the only channel.
 *
 * VALIDATION (dataviz validate_palette.js, surface #F6F7F9, run 2026-10-21)
 * - Stage ramp, `--ordinal`: lightness monotone light to dark PASS; light end #698FBF at 3.12:1 vs surface PASS.
 *   WARN: adjacent step gaps are 0.052-0.056 OKLCH L (target 0.06) and the blue to teal to navy path spreads 57 deg of hue
 *   (one-hue target 40). Seven steps cannot all clear 3:1 and 0.06 apart, and the plan asks for a blue-teal-navy ramp.
 *   Accepted because order is also given by position, stage name and count in every use.
 * - Outcome and responsibility marks: all >= 3:1 vs surface (table below, asserted in chart-palette.test.ts).
 *   Red vs amber is the weak pair: normal-vision dE 14.5, deuteranopia dE 1.8, protanopia similar. Red and amber are
 *   fixed by the brand and by the "red = lost" rule, so they ALWAYS ship with a legend, a direct value label and a
 *   "View as table" alternative, and segments are separated by a 2px surface gap. Never rely on hue alone.
 *   Violet vs blue (applicant vs moved on) never share a chart.
 * - Responsibility: AGENCY slate #3B4A63 is 8.35:1 vs surface, and sits between amber CLIENT and violet APPLICANT in
 *   stacks (violet vs slate is 1.46:1 by lightness, so the 2px gap, legend and table carry the split, as for every pair here).
 * - Stage chips: text on tint >= 4.5:1 (5.9 to 9.0, asserted in tests); Deployed is white on navy 13.2:1.
 * - Chip text: dark red on the light red BOTTLENECK/OVERDUE fill >= 4.5:1; watch and at-risk chips use dark amber text on a light
 *   fill, >= 4.5:1 (asserted in tests).
 * - Neutral grey is exempt from the chroma floor by design (it means "waiting / not a decision").
 */

import type { CSSProperties } from "react";

export const CHART_SURFACE = "#F6F7F9";

/** Frame colours for plots: kept recessive, still >= 3:1 where they carry meaning (axis labels use TEXT). */
export const CHART_GRID = "#DDE2E9";
export const CHART_AXIS_TEXT = "#4B5563";
export const CHART_TRACK = "#EDF0F4";

/** Ordinal stage ramp, light to deep. Keyed by the backend stage enum used in Reports rows. */
export const STAGE_RAMP = [
  { key: "APPLIED", label: "Submitted", color: "#698FBF" },
  { key: "INITIAL_SCREENING", label: "Initial screening", color: "#4E80B2" },
  { key: "CLIENT_ENDORSEMENT", label: "Client review", color: "#27749B" },
  { key: "FINAL_INTERVIEW", label: "Final interview", color: "#006978" },
  { key: "COMPLIANCE", label: "Requirements", color: "#005A5D" },
  { key: "CONTRACT_SIGNING", label: "Contract signing", color: "#004857" },
  { key: "DEPLOYED", label: "Deployed", color: "#0D305A" },
] as const;

const STAGE_ALIASES: Record<string, string> = {
  SUBMITTED: "APPLIED",
  ONBOARDING: "CONTRACT_SIGNING",
};

export const STAGE_COLORS: Record<string, string> = Object.fromEntries(STAGE_RAMP.map((s) => [s.key, s.color]));

/** Stage colour by enum. Unknown stages fall back to neutral grey so a new enum value never crashes a chart. */
export const stageColor = (stage: string): string => STAGE_COLORS[STAGE_ALIASES[stage] ?? stage] ?? OUTCOME.waiting;

/**
 * Stage chips share the STAGE_RAMP hue family: tinted fill, ramp-hued dark text, Deployed solid navy.
 * Class strings are literal so Tailwind sees them. Keyed by the same enum as STAGE_RAMP.
 */
export const STAGE_CHIP: Record<string, { text: string; bg: string; border: string; className: string }> = {
  APPLIED: { text: "#2F5C8F", bg: "#E8EFF7", border: "#C5D5E8", className: "border-[#C5D5E8] bg-[#E8EFF7] text-[#2F5C8F]" },
  INITIAL_SCREENING: { text: "#2A5A8C", bg: "#E3ECF6", border: "#BCD0E6", className: "border-[#BCD0E6] bg-[#E3ECF6] text-[#2A5A8C]" },
  CLIENT_ENDORSEMENT: { text: "#1E5F82", bg: "#E0EEF4", border: "#B7D6E4", className: "border-[#B7D6E4] bg-[#E0EEF4] text-[#1E5F82]" },
  FINAL_INTERVIEW: { text: "#00596A", bg: "#DDEFF1", border: "#B0D6DB", className: "border-[#B0D6DB] bg-[#DDEFF1] text-[#00596A]" },
  COMPLIANCE: { text: "#004D50", bg: "#DCEEEE", border: "#AED3D3", className: "border-[#AED3D3] bg-[#DCEEEE] text-[#004D50]" },
  CONTRACT_SIGNING: { text: "#00414F", bg: "#DAE9ED", border: "#A9CBD4", className: "border-[#A9CBD4] bg-[#DAE9ED] text-[#00414F]" },
  DEPLOYED: { text: "#FFFFFF", bg: "#0D305A", border: "#0D305A", className: "border-[#0D305A] bg-[#0D305A] text-white" },
};

/** Chip classes for an application status that is a pipeline stage, else undefined. */
export const stageChipClass = (status?: string | null): string | undefined =>
  status ? STAGE_CHIP[STAGE_ALIASES[status] ?? status]?.className : undefined;

/** What happened to people who reached a stage. */
export const OUTCOME = {
  movedOn: "#1A55C4",
  waiting: "#7B8494",
  notSelected: "#9A5B00",
  backedOut: "#C8102E",
} as const;

/** Who caused a backout. */
export const RESPONSIBILITY = {
  APPLICANT: "#6D4FB5",
  CLIENT: "#9A5B00",
  AGENCY: "#3B4A63",
} as const;

/** Workload split: within limit is neutral, overdue is red, overdue by age only is amber and hatched (an estimate). */
export const WORKLOAD = {
  withinLimit: "#7B8494",
  overdue: "#C8102E",
  estimated: "#9A5B00",
} as const;

/** Starts are positive (blue family); people who left reuse the loss colours. */
export const TREND = {
  newStarts: "#1A55C4",
  redeployStarts: "#27749B",
  backouts: "#C8102E",
  withdrawals: "#9A5B00",
} as const;

/** Neutral single-series bar, for ranked lists with no category (top reasons, request progress). */
export const NEUTRAL_MARK = "#4B5563";

export type HealthKey = "onTrack" | "watch" | "atRisk" | "bottleneck" | "overdue" | "filled";

/**
 * Chips for state. Class strings are literal so Tailwind sees them. On track has no fill; watch is an amber outline;
 * at risk is a light amber fill; bottleneck and overdue are a light red fill with dark red text and a red outline
 * (solid red read as too loud next to the charts). Every chip also carries a word.
 */
export const HEALTH_CHIP: Record<HealthKey, { label: string; className: string }> = {
  onTrack: { label: "On track", className: "border-transparent bg-transparent text-slate-700" },
  watch: { label: "Watch", className: "border-[#9A5B00] bg-white text-[#7A4800]" },
  atRisk: { label: "At risk", className: "border-[#9A5B00]/40 bg-[#FFF4DC] text-[#7A4800]" },
  bottleneck: { label: "Bottleneck", className: "border-[#B42318] bg-[#FDF1F2] text-[#B42318]" },
  overdue: { label: "Overdue", className: "border-[#B42318] bg-[#FDF1F2] text-[#B42318]" },
  filled: { label: "Filled", className: "border-slate-300 bg-slate-100 text-slate-700" },
};

/** Text colour classes for numbers that sit next to marks. Red text only for lost or late counts. */
export const TEXT_LOSS = "text-[#B42318]";
export const TEXT_AMBER = "text-[#7A4800]";

/** Diagonal hatch for estimated values. Pair with a legend entry that says "by age only". */
export const hatchStyle = (color: string): CSSProperties => ({
  backgroundColor: "#FFFFFF",
  backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px 5px)`,
  boxShadow: `inset 0 0 0 1px ${color}`,
});

const channel = (hex: string, offset: number): number => {
  const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);

/** WCAG contrast ratio of two #RRGGBB colours. */
export const contrastRatio = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
