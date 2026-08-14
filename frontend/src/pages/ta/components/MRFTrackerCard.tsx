import { Link } from 'react-router-dom';
import { Building2, Calendar, Users, ArrowUpRight } from 'lucide-react';
import type { ManpowerRequest } from '../../../lib/types/api';

interface MRFTrackerCardProps {
  mrfs?: ManpowerRequest[];
  isLoading?: boolean;
}

export function MRFTrackerCard({ mrfs = [], isLoading = false }: MRFTrackerCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4" data-testid="mrf-tracker-loading">
        <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-36 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-36 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-36 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const priorityStyles: Record<string, { badge: string; dot: string }> = {
    URGENT: { badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
    HIGH: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    NORMAL: { badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    LOW: { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  };

  const activeMrfs = mrfs.filter((m) => m.status === 'OPEN').slice(0, 6);

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4" data-testid="mrf-tracker-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <span>Manpower Requests (MRF) Quota Tracker</span>
            <span className="text-xs font-mono font-normal text-muted-foreground">
              ({activeMrfs.length} open requests)
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time headcount fulfillment vs client request quotas.
          </p>
        </div>
        <Link
          to="/ta/mrfs"
          className="text-xs font-semibold text-teal-800 hover:text-teal-900 inline-flex items-center gap-1 transition-colors self-start sm:self-auto"
        >
          <span>View All MRFs</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {activeMrfs.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-border text-xs text-muted-foreground">
          No open manpower requests currently active.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeMrfs.map((mrf) => {
            const deployedCount = mrf._count?.deployments ?? 0;
            const headcount = mrf.headcount ?? 1;
            const fillRatio = Math.min(100, Math.round((deployedCount / headcount) * 100));
            const priority = mrf.priority || 'NORMAL';
            const priorityStyle = priorityStyles[priority] || priorityStyles.NORMAL;

            return (
              <div
                key={mrf.id}
                data-testid={`mrf-card-${mrf.id}`}
                className="p-4.5 rounded-xl border border-border bg-background hover:border-teal-500/40 hover:shadow-card transition duration-150 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-teal-800">
                      MRF-#{mrf.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priorityStyle.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                      {priority}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-foreground line-clamp-1">
                      {mrf.title}
                    </h3>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{mrf.client?.name || 'Enterprise Client'}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Quota */}
                <div className="space-y-2 pt-2 border-t border-border/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-teal-700" />
                      Filled Quota:
                    </span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      {deployedCount} / {headcount} ({fillRatio}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/50">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        fillRatio >= 100
                          ? 'bg-emerald-500'
                          : fillRatio >= 50
                          ? 'bg-teal-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${fillRatio}%` }}
                    />
                  </div>

                  {mrf.targetFillDate && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Target: {new Date(mrf.targetFillDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Link
                    to={`/ta/mrfs/${mrf.id}`}
                    className="w-full h-8.5 px-3.5 rounded-lg text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <span>View MRF Details</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
