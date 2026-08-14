import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Loader2,
  X,
} from 'lucide-react';
import { applicantApi } from '../../../lib/api/applicant';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import type { WorkExperience, AddWorkExperienceInput } from '../../../lib/types/api';

const workExperienceSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  roleTitle: z.string().min(1, 'Job title / position is required'),
  location: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().nullable(),
  isCurrent: z.boolean().optional(),
  summary: z.string().optional(),
});

type WorkExperienceFormData = z.infer<typeof workExperienceSchema>;

interface WorkExperienceSectionProps {
  experiences?: WorkExperience[];
}

export function WorkExperienceSection({ experiences = [] }: WorkExperienceSectionProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<WorkExperienceFormData>({
    resolver: zodResolver(workExperienceSchema),
    defaultValues: {
      company: '',
      roleTitle: '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      summary: '',
    },
  });

  const isCurrentJob = watch('isCurrent');

  const addExperienceMutation = useMutation({
    mutationFn: (data: AddWorkExperienceInput) => applicantApi.addWorkExperience(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Work experience record added');
      setIsModalOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add work experience');
    },
  });

  const deleteExperienceMutation = useMutation({
    mutationFn: (id: number) => applicantApi.deleteWorkExperience(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Work experience record deleted');
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete work experience');
    },
  });

  const onSubmit = (data: WorkExperienceFormData) => {
    const payload: AddWorkExperienceInput = {
      company: data.company,
      roleTitle: data.roleTitle,
      location: data.location || undefined,
      startDate: data.startDate,
      endDate: data.isCurrent ? undefined : (data.endDate || undefined),
      isCurrent: data.isCurrent,
      summary: data.summary || undefined,
    };
    addExperienceMutation.mutate(payload);
  };

  const formatDateRange = (startDate: string, endDate?: string | null, isCurrent?: boolean) => {
    try {
      const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (isCurrent) return `${start} - Present`;
      if (!endDate) return `${start} - Present`;
      const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return `${start} - ${end}`;
    } catch {
      return `${startDate} - ${endDate || 'Present'}`;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="work-experience-section">
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6">
        {/* Header with Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-teal-700" />
            <div>
              <h4 className="text-base font-bold text-foreground">Work Experience</h4>
              <p className="text-xs text-muted-foreground">
                Document your employment history, responsibilities, and key achievements.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              setIsModalOpen(true);
            }}
            data-testid="add-experience-btn"
            className="h-10 px-4 text-sm font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition duration-150 inline-flex items-center gap-2 shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Experience</span>
          </button>
        </div>

        {/* Experience List */}
        {experiences.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No work experience listed</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Adding your past employment history significantly boosts your AI match score with open jobs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                reset();
                setIsModalOpen(true);
              }}
              className="h-10 px-4 text-sm font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition duration-150 inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Experience</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {experiences.map((exp) => (
              <div
                key={exp.id}
                data-testid={`experience-item-${exp.id}`}
                className="p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition duration-150 flex items-start justify-between gap-4 shadow-2xs"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h5 className="text-base font-bold text-slate-900">{exp.roleTitle}</h5>
                    <span className="text-xs text-slate-400">&bull;</span>
                    <span className="text-sm font-medium text-slate-700">{exp.company}</span>
                    {exp.isCurrent && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Current Position
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                    </span>
                    {exp.location && (
                      <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {exp.location}
                      </span>
                    )}
                  </div>

                  {exp.summary && (
                    <p className="text-sm text-slate-600 pt-1 leading-relaxed whitespace-pre-line">
                      {exp.summary}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingId(exp.id)}
                    title="Delete experience"
                    data-testid={`delete-experience-${exp.id}`}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Experience Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="experience-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        >
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 id="experience-modal-title" className="text-base font-bold text-foreground">
                Add Work Experience
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" data-testid="experience-form">
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Company / Employer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="company"
                  type="text"
                  {...register('company')}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. San Miguel Corporation"
                />
                {errors.company && (
                  <p className="mt-1 text-xs text-rose-500">{errors.company.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="roleTitle" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Job Title / Role <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="roleTitle"
                    type="text"
                    {...register('roleTitle')}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="e.g. Production Specialist"
                  />
                  {errors.roleTitle && (
                    <p className="mt-1 text-xs text-rose-500">{errors.roleTitle.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="expLocation" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Work Location
                  </label>
                  <input
                    id="expLocation"
                    type="text"
                    {...register('location')}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="e.g. Pasig City"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expStartDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="expStartDate"
                    type="date"
                    {...register('startDate')}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-xs text-rose-500">{errors.startDate.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="expEndDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                    End Date
                  </label>
                  <input
                    id="expEndDate"
                    type="date"
                    disabled={isCurrentJob}
                    {...register('endDate')}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isCurrent"
                  type="checkbox"
                  {...register('isCurrent')}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <label htmlFor="isCurrent" className="text-sm font-medium text-slate-700 cursor-pointer">
                  I currently work here
                </label>
              </div>

              <div>
                <label htmlFor="expSummary" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Responsibilities &amp; Achievements
                </label>
                <textarea
                  id="expSummary"
                  rows={3}
                  {...register('summary')}
                  className="w-full p-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="Summarize daily duties, tools operated, and key accomplishments..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addExperienceMutation.isPending}
                  className="h-10 px-5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 transition duration-150"
                >
                  {addExperienceMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>Save Experience</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Delete Work Experience"
        description="Are you sure you want to remove this work experience entry from your profile?"
        confirmText="Delete"
        variant="danger"
        isLoading={deleteExperienceMutation.isPending}
        onConfirm={() => {
          if (deletingId) deleteExperienceMutation.mutate(deletingId);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
