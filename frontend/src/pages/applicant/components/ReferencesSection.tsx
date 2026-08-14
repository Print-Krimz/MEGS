import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Trash2,
  Phone,
  Mail,
  UserCheck,
  Loader2,
  X,
} from 'lucide-react';
import { applicantApi } from '../../../lib/api/applicant';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import type { CharacterReference, AddReferenceInput } from '../../../lib/types/api';

const referenceSchema = z.object({
  name: z.string().min(1, 'Reference full name is required'),
  relationship: z.string().min(1, 'Professional / Personal relationship is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type ReferenceFormData = z.infer<typeof referenceSchema>;

interface ReferencesSectionProps {
  references?: CharacterReference[];
}

export function ReferencesSection({ references = [] }: ReferencesSectionProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReferenceFormData>({
    resolver: zodResolver(referenceSchema),
    defaultValues: {
      name: '',
      relationship: '',
      phone: '',
      email: '',
      notes: '',
    },
  });

  const addReferenceMutation = useMutation({
    mutationFn: (data: AddReferenceInput) => applicantApi.addReference(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Character reference added');
      setIsModalOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add reference');
    },
  });

  const deleteReferenceMutation = useMutation({
    mutationFn: (id: number) => applicantApi.deleteReference(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Character reference removed');
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete reference');
    },
  });

  const onSubmit = (data: ReferenceFormData) => {
    addReferenceMutation.mutate({
      name: data.name,
      relationship: data.relationship,
      phone: data.phone || undefined,
      email: data.email || undefined,
      notes: data.notes || undefined,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="references-section">
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-700" />
            <div>
              <h4 className="text-sm font-bold text-foreground">Character References</h4>
              <p className="text-xs text-muted-foreground">
                Provide past supervisors, colleagues, or academic mentors who can vouch for your performance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              setIsModalOpen(true);
            }}
            data-testid="add-reference-btn"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition duration-150 inline-flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reference</span>
          </button>
        </div>

        {/* List */}
        {references.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No references added yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                We recommend adding 2-3 professional references to expedite client endorsement.
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
              <span>Add First Reference</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {references.map((ref) => (
              <div
                key={ref.id}
                data-testid={`reference-item-${ref.id}`}
                className="p-4 rounded-xl border border-border bg-card hover:border-slate-300 transition duration-150 flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div>
                    <h5 className="text-sm font-bold text-foreground">{ref.name}</h5>
                    <p className="text-xs font-medium text-teal-800">{ref.relationship}</p>
                  </div>

                  <div className="space-y-1 pt-1 text-xs text-slate-700">
                    {ref.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ref.phone}</span>
                      </div>
                    )}
                    {ref.email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ref.email}</span>
                      </div>
                    )}
                  </div>

                  {ref.notes && (
                    <p className="text-xs text-slate-600 pt-1 leading-relaxed">
                      {ref.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingId(ref.id)}
                    title="Delete reference"
                    data-testid={`delete-reference-${ref.id}`}
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
          aria-labelledby="reference-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        >
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 id="reference-modal-title" className="text-base font-bold text-foreground">
                Add Character Reference
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" data-testid="reference-form">
              <div>
                <label htmlFor="refName" className="block text-xs font-semibold text-foreground mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="refName"
                  type="text"
                  {...register('name')}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. Engr. Roberto Santos"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="refRelationship" className="block text-xs font-semibold text-foreground mb-1">
                  Relationship / Position &amp; Company <span className="text-rose-500">*</span>
                </label>
                <input
                  id="refRelationship"
                  type="text"
                  {...register('relationship')}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. Former Direct Supervisor at ABC Logistics"
                />
                {errors.relationship && (
                  <p className="mt-1 text-xs text-rose-500">{errors.relationship.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="refPhone" className="block text-xs font-semibold text-foreground mb-1">
                    Contact Number
                  </label>
                  <input
                    id="refPhone"
                    type="text"
                    {...register('phone')}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="e.g. 09171234567"
                  />
                </div>

                <div>
                  <label htmlFor="refEmail" className="block text-xs font-semibold text-foreground mb-1">
                    Email Address
                  </label>
                  <input
                    id="refEmail"
                    type="email"
                    {...register('email')}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="e.g. roberto@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="refNotes" className="block text-xs font-semibold text-foreground mb-1">
                  Notes / Best Time to Contact
                </label>
                <textarea
                  id="refNotes"
                  rows={2}
                  {...register('notes')}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. Reachable during office hours 9am-5pm..."
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
                  disabled={addReferenceMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {addReferenceMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Save Reference</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Delete Reference"
        description="Are you sure you want to remove this character reference?"
        confirmText="Delete"
        variant="danger"
        isLoading={deleteReferenceMutation.isPending}
        onConfirm={() => {
          if (deletingId) deleteReferenceMutation.mutate(deletingId);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
