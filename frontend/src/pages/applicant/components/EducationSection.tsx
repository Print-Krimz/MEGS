import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  GraduationCap,
  Plus,
  Trash2,
  Calendar,
  BookOpen,
  Loader2,
  X,
} from 'lucide-react';
import { applicantApi } from '../../../lib/api/applicant';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import type { Education, AddEducationInput } from '../../../lib/types/api';

const educationSchema = z.object({
  school: z.string().min(1, 'School / University name is required'),
  degree: z.string().min(1, 'Degree or qualification level is required'),
  fieldOfStudy: z.string().min(1, 'Field of study or major is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

type EducationFormData = z.infer<typeof educationSchema>;

interface EducationSectionProps {
  educations?: Education[];
}

export function EducationSection({ educations = [] }: EducationSectionProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EducationFormData>({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      school: '',
      degree: 'Bachelor Degree',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      notes: '',
    },
  });

  const addEducationMutation = useMutation({
    mutationFn: (data: AddEducationInput) => applicantApi.addEducation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Education entry added');
      setIsModalOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add education');
    },
  });

  const deleteEducationMutation = useMutation({
    mutationFn: (id: number) => applicantApi.deleteEducation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Education record removed');
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete education');
    },
  });

  const onSubmit = (data: EducationFormData) => {
    addEducationMutation.mutate({
      school: data.school,
      degree: data.degree,
      fieldOfStudy: data.fieldOfStudy,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      notes: data.notes || undefined,
    });
  };

  const formatDateRange = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate && !endDate) return 'Completed';
    try {
      const start = startDate ? new Date(startDate).toLocaleDateString('en-US', { year: 'numeric' }) : '';
      const end = endDate ? new Date(endDate).toLocaleDateString('en-US', { year: 'numeric' }) : 'Present';
      return `${start} - ${end}`.trim();
    } catch {
      return `${startDate || ''} - ${endDate || ''}`;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="education-section">
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-teal-700" />
            <div>
              <h4 className="text-base font-bold text-foreground">Education &amp; Academics</h4>
              <p className="text-xs text-muted-foreground">
                Detail your formal educational background and academic achievements.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              setIsModalOpen(true);
            }}
            data-testid="add-education-btn"
            className="h-10 px-4 text-sm font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition duration-150 inline-flex items-center gap-2 shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Education</span>
          </button>
        </div>

        {/* List */}
        {educations.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No education history recorded</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add your high school, vocational, college, or postgraduate degree details.
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
              <span>Add Education Record</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {educations.map((edu) => (
              <div
                key={edu.id}
                data-testid={`education-item-${edu.id}`}
                className="p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition duration-150 flex items-start justify-between gap-4 shadow-2xs"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-base font-bold text-slate-900">{edu.school}</h5>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                    <span className="font-semibold text-teal-800 inline-flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-teal-700" />
                      {edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                    </span>
                    <span className="text-xs text-slate-400">&bull;</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDateRange(edu.startDate, edu.endDate)}
                    </span>
                  </div>

                  {edu.notes && (
                    <p className="text-sm text-slate-600 pt-1 leading-relaxed">
                      {edu.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingId(edu.id)}
                    title="Delete education"
                    data-testid={`delete-education-${edu.id}`}
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

      {/* Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="education-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        >
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 id="education-modal-title" className="text-base font-bold text-foreground">
                Add Education Record
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" data-testid="education-form">
              <div>
                <label htmlFor="school" className="block text-sm font-medium text-slate-700 mb-1.5">
                  School / University / College <span className="text-rose-500">*</span>
                </label>
                <input
                  id="school"
                  type="text"
                  {...register('school')}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. Polytechnic University of the Philippines"
                />
                {errors.school && (
                  <p className="mt-1 text-xs text-rose-500">{errors.school.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="degree" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Degree / Level <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="degree"
                    {...register('degree')}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="High School Diploma">High School Diploma</option>
                    <option value="Senior High School">Senior High School (K-12)</option>
                    <option value="Vocational / Technical Diploma">Vocational / Technical Diploma (TESDA)</option>
                    <option value="Associate Degree">Associate Degree</option>
                    <option value="Bachelor Degree">Bachelor Degree</option>
                    <option value="Master Degree">Master Degree</option>
                    <option value="Doctorate Degree">Doctorate Degree</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="fieldOfStudy" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Field of Study / Major <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="fieldOfStudy"
                    type="text"
                    {...register('fieldOfStudy')}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="e.g. Information Technology / Business"
                  />
                  {errors.fieldOfStudy && (
                    <p className="mt-1 text-xs text-rose-500">{errors.fieldOfStudy.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="eduStartDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Start Date
                  </label>
                  <input
                    id="eduStartDate"
                    type="date"
                    {...register('startDate')}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label htmlFor="eduEndDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                    End / Completion Date
                  </label>
                  <input
                    id="eduEndDate"
                    type="date"
                    {...register('endDate')}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="eduNotes" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Honors, Awards &amp; Activities
                </label>
                <textarea
                  id="eduNotes"
                  rows={2}
                  {...register('notes')}
                  className="w-full p-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. Cum Laude, Dean's Lister, Student Council Officer..."
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
                  disabled={addEducationMutation.isPending}
                  className="h-10 px-5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 transition duration-150"
                >
                  {addEducationMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>Save Education</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Delete Education Record"
        description="Are you sure you want to remove this education entry?"
        confirmText="Delete"
        variant="danger"
        isLoading={deleteEducationMutation.isPending}
        onConfirm={() => {
          if (deletingId) deleteEducationMutation.mutate(deletingId);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
