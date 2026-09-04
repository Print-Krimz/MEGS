import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { formatDate } from "../../lib/utils";
import type { ApplicantJobInvitation } from "../../lib/types/applicant.types";

export interface InvitationCardProps {
  invitation: ApplicantJobInvitation;
  onAccept: (invitation: ApplicantJobInvitation) => void;
  onDecline: (invitation: ApplicantJobInvitation) => void;
  className?: string;
}

export const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  onAccept,
  onDecline,
  className = "",
}) => {
  const isPending = invitation.status === "PENDING";
  const isAccepted = invitation.status === "ACCEPTED";
  const isDeclined = invitation.status === "DECLINED";
  const isExpired = invitation.status === "EXPIRED";

  return (
    <div
      className={`bg-white rounded-xl border p-5 transition-all space-y-4 shadow-xs ${
        isPending
          ? "border-blue-300 ring-1 ring-blue-100/80 hover:border-blue-400"
          : "border-slate-200/90 hover:border-slate-300"
      } ${className}`}
    >
      {/* Header: Title, Recruiter Matching Highlight & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3 h-3" />
              <span>Direct Recruiter Invitation</span>
            </span>

            {isPending && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Action Required</span>
              </span>
            )}
            {isAccepted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Accepted & Applied</span>
              </span>
            )}
            {isDeclined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <XCircle className="w-3 h-3 text-slate-500" />
                <span>Declined</span>
              </span>
            )}
            {isExpired && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                <span>Invitation Expired</span>
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {invitation.title}
          </h3>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 text-slate-700 font-medium">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>MAR Employment (MEGS)</span>
            </span>
            {invitation.location && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{invitation.location}</span>
                </span>
              </>
            )}
            <span>•</span>
            <span>Received {formatDate(invitation.createdAt)}</span>
            {invitation.expiresAt && isPending && (
              <>
                <span>•</span>
                <span className="text-amber-700 font-semibold">
                  Expires {formatDate(invitation.expiresAt)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls for Pending Invitation */}
        {isPending && (
          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
            <button
              type="button"
              onClick={() => onDecline(invitation)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => onAccept(invitation)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Accept Invitation</span>
            </button>
          </div>
        )}
      </div>

      {/* Recruiter Note Callout */}
      {invitation.message && (
        <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs space-y-1">
          <div className="text-blue-900 font-bold flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Note from Talent Acquisition</span>
          </div>
          <p className="text-slate-700 leading-relaxed italic">
            "{invitation.message}"
          </p>
        </div>
      )}

      {/* Overview & Qualifications Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
        {invitation.description && (
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
              Role Overview
            </h4>
            <p className="text-slate-600 line-clamp-3">
              {invitation.description}
            </p>
          </div>
        )}

        {invitation.requirements && (
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
              Qualifications Needed
            </h4>
            <p className="text-slate-600 line-clamp-3">
              {invitation.requirements}
            </p>
          </div>
        )}
      </div>

      {/* Link to full job details */}
      {invitation.jobPostingId && (
        <div className="pt-2 flex justify-end">
          <Link
            to="/app/jobs/$jobId"
            params={{ jobId: String(invitation.jobPostingId) }}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            <span>View Full Job Posting</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
};
