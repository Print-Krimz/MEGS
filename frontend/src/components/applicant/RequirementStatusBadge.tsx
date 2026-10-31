import React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  XCircle,
  type LucideIcon,
} from "lucide-react";

interface RequirementStatusBadgeProps {
  status: string;
}

// One badge system for applicant pages: rounded-md, 12 px, 1 px border, tinted background.
const BADGE_BASE =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium";
const TONE = {
  green: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  amber: "bg-[#FFF7ED] text-[#B45309] border-[#FED7AA]",
  navy: "bg-[#EAF0F7] text-[#0B315D] border-[#D9E2EC]",
  red: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  slate: "bg-[#F7F9FC] text-[#486581] border-[#D9E2EC]",
} as const;

const STATUS_BADGE: Record<string, { label: string; Icon: LucideIcon; className: string }> = {
  APPROVED: { label: "Approved", Icon: CheckCircle2, className: `${BADGE_BASE} ${TONE.green}` },
  PENDING: { label: "Pending", Icon: Clock, className: `${BADGE_BASE} ${TONE.amber}` },
  TO_FOLLOW: { label: "To Follow", Icon: CalendarClock, className: `${BADGE_BASE} ${TONE.amber}` },
  SUBMITTED: { label: "Submitted", Icon: FileText, className: `${BADGE_BASE} ${TONE.navy}` },
  REJECTED: { label: "Rejected", Icon: XCircle, className: `${BADGE_BASE} ${TONE.red}` },
  EXPIRED: { label: "Expired", Icon: AlertTriangle, className: `${BADGE_BASE} ${TONE.amber}` },
};

/** Applicant-facing label for each document review status. One map for the badge, library dialog and preview chip. */
export const REQUIREMENT_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_BADGE).map(([status, { label }]) => [status, label])
);

const INVITATION_BADGE: Record<string, { label: string; Icon: LucideIcon; className: string }> = {
  PENDING: { label: "Action required", Icon: Mail, className: `${BADGE_BASE} ${TONE.amber}` },
  ACCEPTED: { label: "Accepted", Icon: CheckCircle2, className: `${BADGE_BASE} ${TONE.green}` },
  DECLINED: { label: "Declined", Icon: XCircle, className: `${BADGE_BASE} ${TONE.slate}` },
  EXPIRED: { label: "Expired", Icon: Clock, className: `${BADGE_BASE} ${TONE.slate}` },
  CANCELLED: { label: "Cancelled", Icon: XCircle, className: `${BADGE_BASE} ${TONE.slate}` },
};

/** Label, icon and full badge class (shape plus colour) for a job invitation status. Unknown statuses read as action required. */
export const getInvitationStatusMeta = (status: string): { label: string; Icon: LucideIcon; className: string } =>
  INVITATION_BADGE[status] ?? INVITATION_BADGE.PENDING;

const humanize = (value: string) => {
  const text = value.replace(/_/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const RequirementStatusBadge: React.FC<RequirementStatusBadgeProps> = ({ status }) => {
  const config = STATUS_BADGE[status];
  const Icon = config?.Icon ?? Clock;
  const className = config?.className ?? `${BADGE_BASE} ${TONE.slate}`;

  return (
    <span className={className}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {config?.label ?? humanize(status)}
    </span>
  );
};
