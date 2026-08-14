import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Plus, X, Tag, Loader2 } from 'lucide-react';
import { applicantApi } from '../../../lib/api/applicant';
import type { ApplicantSkill } from '../../../lib/types/api';

const POPULAR_SKILL_SUGGESTIONS = [
  'Customer Service',
  'Data Entry',
  'MS Excel / Spreadsheets',
  'Technical Support',
  'English Communication',
  'Inventory Management',
  'Quality Control',
  'Sales & Marketing',
  'Cash Handling',
  'Forklift Operation',
  'Administrative Support',
  'Troubleshooting',
  'Time Management',
  'Team Collaboration',
  'Documentation',
];

interface SkillsSectionProps {
  skills?: (ApplicantSkill | string)[];
}

export function SkillsSection({ skills = [] }: SkillsSectionProps) {
  const queryClient = useQueryClient();
  const [skillInput, setSkillInput] = useState('');

  // Extract raw string names from skills array
  const currentSkills: string[] = skills.map((s) =>
    typeof s === 'string' ? s : s.skill?.name || ''
  ).filter(Boolean);

  const updateSkillsMutation = useMutation({
    mutationFn: (newSkills: string[]) => applicantApi.updateSkills(newSkills),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Skills updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update skills');
    },
  });

  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;

    if (currentSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Skill "${trimmed}" is already in your profile`);
      return;
    }

    const updated = [...currentSkills, trimmed];
    updateSkillsMutation.mutate(updated);
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = currentSkills.filter((s) => s.toLowerCase() !== skillToRemove.toLowerCase());
    updateSkillsMutation.mutate(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill(skillInput);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="skills-section">
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6">
        {/* Header */}
        <div className="border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-700" />
            <div>
              <h4 className="text-base font-bold text-foreground">Skills &amp; Competencies</h4>
              <p className="text-xs text-muted-foreground">
                Highlight your technical, operational, and soft skills to improve matching with employer job postings.
              </p>
            </div>
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 max-w-lg">
          <div className="relative flex-1">
            <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a skill and press Enter..."
              data-testid="skill-input"
              className="w-full h-10 pl-9 pr-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <button
            type="button"
            onClick={() => handleAddSkill(skillInput)}
            disabled={!skillInput.trim() || updateSkillsMutation.isPending}
            data-testid="add-skill-btn"
            className="h-10 px-4 text-sm font-semibold rounded-lg text-white bg-teal-700 hover:bg-teal-800 transition duration-150 inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {updateSkillsMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Add</span>
          </button>
        </div>

        {/* Current Skills Badges */}
        <div>
          <h5 className="text-sm font-bold text-foreground mb-3 flex items-center justify-between">
            <span>Your Profile Skills ({currentSkills.length})</span>
            {updateSkillsMutation.isPending && (
              <span className="text-xs text-teal-600 font-normal flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Syncing skills...
              </span>
            )}
          </h5>

          {currentSkills.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-foreground">No skills added yet</p>
              <p className="text-xs text-muted-foreground">
                Type a skill above or click from the recommended suggestions below.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2" data-testid="current-skills-list">
              {currentSkills.map((skill) => (
                <span
                  key={skill}
                  data-testid={`skill-badge-${skill}`}
                  className="h-8 px-3 text-xs font-medium rounded-lg inline-flex items-center gap-2 bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs group hover:bg-teal-100/70 transition duration-150"
                >
                  <span className="capitalize">{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    disabled={updateSkillsMutation.isPending}
                    title={`Remove ${skill}`}
                    aria-label={`Remove ${skill}`}
                    className="text-teal-600 hover:text-rose-600 p-0.5 rounded transition duration-150"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Suggested Skills */}
        <div className="pt-4 border-t border-border space-y-3">
          <h5 className="text-sm font-bold text-foreground">Popular Recommended Skills</h5>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SKILL_SUGGESTIONS.map((sug) => {
              const alreadyHas = currentSkills.some((s) => s.toLowerCase() === sug.toLowerCase());
              return (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleAddSkill(sug)}
                  disabled={alreadyHas || updateSkillsMutation.isPending}
                  className={`h-8 px-3 text-xs font-medium rounded-lg transition duration-150 inline-flex items-center gap-1.5 border ${
                    alreadyHas
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-teal-500 hover:text-teal-700 hover:bg-teal-50/50 shadow-2xs'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>{sug}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  