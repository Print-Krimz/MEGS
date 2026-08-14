import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Award,
  Plus,
  Trash2,
  Calendar,
  Building,
  Loader2,
  X,
} from 'lucide-react';
import { applicantApi } from '../../../lib/api/applicant';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import type { TrainingCertification, AddTrainingInput } from '../../../lib/types/api';

const trainingSchema = z.object({
  title: z.string().min(1, 'Training / Certification title is required'),
  provider: z.string().min(1, 'Issuing institution / provider is required'),
  completionDate: z.string().optional().nullable(),
  certificateNo: z.string().optional(),
  notes: z.string().optional(),
});

type TrainingFormData = z.infer<typeof trainingSchema>;

interface TrainingsSectionProps {
  trainings?: TrainingCertification[];
}

export function TrainingsSection({ trainings = [] }: TrainingsSectionProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrainingFormData>({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      title: '',
      provider: '',
      completionDate: '',
      certificateNo: '',
      notes: '',
    },
  });

  const addTrainingMutation = useMutation({
    mutationFn: (data: AddTrainingInput) => applicantApi.addTraining(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Training certification added');
      setIsModalOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add training');
    },
  });

  const deleteTrainingMutation = useMutation({
    mutationFn: (id: number) => applicantApi.deleteTraining(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Training certification removed');
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete training');
    },
  });

  const onSubmit = (data: TrainingFormData) => {
    addTrainingMutation.mutate({
      title: data.title,
      provider: data.provider,
      completionDate: data.completionDate || undefined,
      certificateNo: data.certificateNo || undefined,
      notes: data.notes || undefined,
    });
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Completed';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="trainings-section">
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-teal-700" />
            <div>
              <h4 className="text-sm font-bold text-foreground">Trainings &amp; Certifications</h4>
              <p className="text-xs text-muted-foreground">
                Document seminars, vocational certifications, safety training, or specialized workshops.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              setIsModalOpen(true);
            }}
            data-testid="add-training-btn"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition duration-150 inline-flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Training</span>
          </button>
        </div>

        {/* List */}
        {trainings.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No certifications recorded</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add TESDA NC certificates, safety licenses, or relevant skill accreditations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                reset();
                setIsModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition duration-150 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Certification</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {trainings.map((trng) => (
              <div
                key={trng.id}
                data-testid={`training-item-${trng.id}`}
                className="p-4 rounded-xl border border-border bg-card hover:border-slate-300 transition duration-150 flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-foreground">{trng.title}</h5>
                    {trng.certificateNo && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 font-semibold">
                        Cert #{trng.certificateNo}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                    {trng.provider && (
                      <span className="font-medium text-slate-800 inline-flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        {trng.provider}
                      </span>
                    )}
                    {trng.completionDate && (
                      <>
                        <span className="text-xs text-slate-400">&bull;</span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(trng.completionDate)}
                        </span>
                      </>
                    )}
                  </div>

                  {trng.notes && (
                    <p className="text-xs text-slate-600 pt-1 leading-relaxed">
                      {trng.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingId(trng.id)}
                    title="Delete training"
                    data-testid={`delete-training-${trng.id}`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="training-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        >
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 id="training-modal-title" className="text-base font-bold text-foreground">
                Add Training / Certification
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" data-testid="training-form">
              <div>
                <label htmlFor="trngTitle" className="block text-xs font-semibold text-foreground mb-1">
                  Title / Name of Certificate <span className="text-rose-500">*</span>
                </label>
                <input
                  id="trngTitle"
                  type="text"
                  {...register('title')}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. Basic Occupational Safety and Health (BOSH)"
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-rose-500">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="trngProvider" className="block text-xs font-semibold text-foreground mb-1">
                  Issuing Provider / Institution <span className="text-rose-500">*</span>
                </label>
                <input
                  id="trngProvider"
                  type="text"
                  {...register('provider')}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. DOLE-OSHC / TESDA / Red Cross"
                />
                {errors.provider && (
                  <p className="mt-1 text-xs text-rose-500">{errors.provider.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="completionDate" className="block text-xs font-semibold text-foreground mb-1">
                    Date of Completion
                  </label>
                  <input
                    id="completionDate"
                    type="date"
                    {...register('completionDate')}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label htmlFor="certificateNo" className="block text-xs font-semibold text-foreground mb-1">
                    License / Certificate Number
                  </label>
                  <input
                    id="certificateNo"
                    type="text"
                    {...register('certificateNo')}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="e.g. NC2-12345"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="trngNotes" className="block text-xs font-semibold text-foreground mb-1">
                  Additional Details / Scope
                </label>
                <textarea
                  id="trngNotes"
                  rows={2}
                  {...register('notes')}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. 40-hour comprehensive training on workplace hazards..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addTrainingMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {addTrainingMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Save Training</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Delete Training / Certification"
        description="Are you sure you want to remove this training certification entry?"
        confirmText="Delete"
        variant="danger"
        isLoading={deleteTrainingMutation.isPending}
        onConfirm={() => {
          if (deletingId) deleteTrainingMutation.mutate(deletingId);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
