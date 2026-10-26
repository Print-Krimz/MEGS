import React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  XCircle,
  type LucideIcon,
} from "lucide-react";

interface RequirementStatusBadgeProps {
  status: string;
}

const STATUS_BADGE: Record<string, { label: string; Icon: LucideIcon; className: string }> = {
  APPROVED: {
    label: "Approved",
    Icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-900 border-emerald-300",
  },
  PENDING: {
    label: "Pending",
    Icon: Clock,
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
  TO_FOLLOW: {
    label: "To Follow",
    Icon: CalendarClock,
    className: "bg-amber-50 text-amber-900 border-amber-300",
  },
  SUBMITTED: {
    label: "Submitted",
    Icon: FileText,
    className: "bg-blue-50 text-blue-900 border-blue-300",
  },
  REJECTED: {
    label: "Rejected",
    Icon: XCircle,
    className: "bg-red-50 text-red-800 border-red-300",
  },
  EXPIRED: {
    label: "Expired",
    Icon: AlertTriangle,
    className: "bg-orange-50 text-orange-900 border-orange-300",
  },
};

const humanize = (value: string) => {
  const text = value.replace(/_/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const RequirementStatusBadge: React.FC<RequirementStatusBadgeProps> = ({ status }) => {
  const config = STATUS_BADGE[status];
  const Icon = config?.Icon ?? Clock;
  const className = config?.className ?? "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {config?.label ?? humanize(status)}
    </span>
  );
};
