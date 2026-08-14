import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Send, 
  Building2, 
  Calendar, 
  X
} from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { taApi } from '../../../lib/api/ta';
import type { ApplicationDetail, ClientEndorsement, Client } from '../../../lib/types/api';

interface EndorsementTabProps {
  application: ApplicationDetail;
  isEndorseModalOpen?: boolean;
  onCloseEndorseModal?: () => void;
}

export function EndorsementTab({
  application,
  isEndorseModalOpen: externalEndorseOpen,
  onCloseEndorseModal,
}: EndorsementTabProps) {
  const queryClient = useQueryClient();

  const [internalEndorseOpen, setInternalEndorseOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [outcome, setOutcome] = useState<'ENDORSED' | 'DECLINED' | 'PENDING'>('ENDORSED');
  const [notes, setNotes] = useState('');

  const isModalOpen = Boolean(externalEndorseOpen || internalEndorseOpen);
  const handleCloseModal = () => {
    setInternalEndorseOpen(false);
    if (onCloseEndorseModal) onCloseEndorseModal();
  };

  // 1. Query Client Endorsements
  const {
    data: endorsementsRes,
    isLoading: isLoadingEndorsements,
  } = useQuery({
    queryKey: ['ta', 'endorsements', application.id],
    queryFn: () => taApi.listEndorsements(application.id),
  });

  const endorsements: ClientEndorsement[] = endorsementsRes?.data || application.clientEndorsements || [];

  // 2. Query Available Clients for Endorsement
  const { data: clientsRes } = useQuery({
    queryKey: ['ta', 'clients'],
    queryFn: () => taApi.listClients(),
  });

  const clients: Client[] = clientsRes?.data || [];

  // 3. Mutation to record endorsement
  const endorseMutation = useMutation({
    mutationFn: () => {
      if (!selectedClientId) throw new Error('Please select a client');
      return taApi.recordEndorsement(application.id, {
        clientId: Number(selectedClientId),
        outcome,
        notes,
      });
    },
    onSuccess: () => {
      toast.success(`Client endorsement recorded as ${outcome}`);
      handleCloseModal();
      setNotes('');
      setSelectedClientId('');
      queryClient.invalidateQueries({ queryKey: ['ta', 'endorsements', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to record endorsement');
    },
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6" data-testid="endorsement-tab">
      {/* Header Banner */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Client Profile Endorsement Workflow
          </h3>
          <p className="text-xs text-muted-foreground">
            Transmit screened candidate dossiers to enterprise clients for review, shortlisting, or panel interview invitation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInternalEndorseOpen(true)}
          data-testid="open-endorse-modal-btn"
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 transition duration-150 flex items-center gap-1.5 self-start sm:self-auto shadow-xs cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Record Client Endorsement</span>
        </button>
      </div>

      {/* Endorsements List */}
      <div className="space-y-4">
        {isLoadingEndorsements ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
          </div>
        ) : endorsements.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-border space-y-2">
            <Send className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs font-semibold text-foreground">No Endorsement Records</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              This candidate has not yet been submitted or endorsed to any enterprise client.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="endorsements-list">
            {endorsements.map((end) => (
              <div
                key={end.id}
                data-testid={`endorsement-item-${end.id}`}
                className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-foreground text-sm">
                        <Building2 className="w-4 h-4 text-purple-700" />
                        <span>{end.client?.name || `Client #${end.clientId}`}</span>
                      </div>
                      <StatusBadge
                        status={end.outcome}
                        size="sm"
                        customLabel={end.outcome}
                      />
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      {end.endorsedBy && (
                        <span>
                          Endorsed by: <strong className="text-foreground">{end.endorsedBy.email}</strong>
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(end.createdAt)}
                      </span>
                    </div>

                    {end.notes && (
                      <p className="text-xs text-slate-700 bg-slate-50 border border-border/80 p-2.5 rounded-lg max-w-xl">
                        {end.notes}
                      </p>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Endorsement Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-700" />
                <span>Submit Client Endorsement</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedClientId) {
                  toast.error('Please select a target client');
                  return;
                }
                endorseMutation.mutate();
              }}
              className="space-y-4 text-xs"
              data-testid="endorse-candidate-form"
            >
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Target Enterprise Client <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(Number(e.target.value))}
                  data-testid="endorsement-client-select"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Select client company...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.industry ? `(${c.industry})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Endorsement Decision / Outcome <span className="text-rose-500">*</span>
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as any)}
                  data-testid="endorsement-outcome-select"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="ENDORSED">ENDORSED (Recommended for Final Interview)</option>
                  <option value="PENDING">PENDING (Submitted for Client Review)</option>
                  <option value="DECLINED">DECLINED (Client rejected candidate profile)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Endorsement Notes & Recommendation Summary
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Include candidate highlights, client contact reference, rate considerations..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={endorseMutation.isPending}
                  data-testid="submit-endorsement-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 shadow-xs"
                >
                  {endorseMutation.isPending ? 'Recording...' : 'Submit Endorsement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
