import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Calendar } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ScoreBadge } from '../../../components/common/ScoreBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import type { ApplicationListItem } from '../../../lib/types/api';

interface ApplicationTableProps {
  applications: ApplicationListItem[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ApplicationTable({
  applications,
  isLoading = false,
  emptyTitle = 'No applications found',
  emptyDescription = 'There are no candidate applications matching your selected criteria.',
}: ApplicationTableProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-subtle overflow-hidden" data-testid="application-table-loading">
        <div className="p-4 border-b border-border">
          <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4.5 px-5 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 bg-slate-200 rounded" />
                  <div className="h-3 w-48 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-16 bg-slate-200 rounded" />
              <div className="h-6 w-20 bg-slate-200 rounded" />
              <div className="h-8.5 w-20 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-subtle overflow-hidden" data-testid="application-table">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="border-b border-border bg-slate-50/90 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="py-4 px-5 font-semibold">Candidate</th>
              <th className="py-4 px-5 font-semibold">Position Applied</th>
              <th className="py-4 px-5 font-semibold text-center">AI Fit Score</th>
              <th className="py-4 px-5 font-semibold">Current Stage</th>
              <th className="py-4 px-5 font-semibold">Applied Date</th>
              <th className="py-4 px-5 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {applications.map((app) => {
              const profile = app.user.applicantProfile;
              const fullName = profile
                ? `${profile.firstName} ${profile.lastName}`
                : app.user.email.split('@')[0];
              const initials = profile
                ? `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`.toUpperCase()
                : 'CA';

              return (
                <tr
                  key={app.id}
                  data-testid={`application-row-${app.id}`}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  {/* Candidate Column */}
                  <td className="py-4.5 px-5">
                    <div className="flex items-center gap-3">
                      {profile?.photoUrl ? (
                        <img
                          src={profile.photoUrl}
                          alt={fullName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center font-bold text-sm shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-sm group-hover:text-teal-800 flex items-center gap-2">
                          <span>{fullName}</span>
                          <span className="text-xs font-mono text-muted-foreground font-normal">
                            #{app.id}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {app.user.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Position Column */}
                  <td className="py-4.5 px-5">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground text-sm truncate max-w-[220px]">
                        {app.jobPosting.title}
                      </div>
                      {app.jobPosting.location && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{app.jobPosting.location}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* AI Fit Score Column */}
                  <td className="py-4.5 px-5 text-center">
                    <ScoreBadge score={app.aiScore ?? app.candidateFitScore} size="md" showIcon />
                  </td>

                  {/* Stage Column */}
                  <td className="py-4.5 px-5">
                    <StatusBadge status={app.status} size="md" />
                  </td>

                  {/* Applied Date Column */}
                  <td className="py-4.5 px-5 text-xs text-muted-foreground font-mono">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(app.createdAt)}</span>
                    </div>
                  </td>

                  {/* Action Column */}
                  <td className="py-4.5 px-5 text-right">
                    <Link
                      to={`/ta/applications/${app.id}`}
                      data-testid={`manage-application-btn-${app.id}`}
                      className="h-8.5 px-3.5 rounded-lg text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
