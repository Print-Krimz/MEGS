import React, { useState } from "react";
import { formatSkillName } from "../../lib/profile-health";
import { Button, Input } from "../ui";
import { Plus, X } from "lucide-react";

interface SkillsSectionProps {
  skills: string[];
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  isUpdating?: boolean;
}

const COMMON_SUGGESTIONS = [
  "React",
  "TypeScript",
  "JavaScript",
  "PostgreSQL",
  "Python",
  "RESTful API Development",
  "Git & GitHub",
  "Customer Care",
  "Technical Documentation",
  "Data Validation",
  "Forklift Operation",
  "CCTV Monitoring",
];

export const SkillsSection: React.FC<SkillsSectionProps> = ({
  skills,
  onAddSkill,
  onRemoveSkill,
  isUpdating = false,
}) => {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    if (!inputValue.trim()) return;
    const formatted = formatSkillName(inputValue.trim());
    if (!skills.some((s) => s.toLowerCase() === formatted.toLowerCase())) {
      onAddSkill(formatted);
    }
    setInputValue("");
  };

  const availableSuggestions = COMMON_SUGGESTIONS.filter(
    (s) => !skills.some((existing) => existing.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900">Technical & Practical Skills</h3>
        <p className="text-xs text-slate-500">
          List competencies and credentials used for automated candidate matching and requisition placement.
        </p>
      </div>

      {/* Input Field */}
      <div className="flex gap-2">
        <Input
          placeholder="Type a skill (e.g. TypeScript, CCTV Monitoring, Customer Care) and press Enter"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1"
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleAdd}
          disabled={!inputValue.trim() || isUpdating}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Skill
        </Button>
      </div>

      {/* Suggested Skills Carousel */}
      {availableSuggestions.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-medium text-slate-600">
            Suggested Skills (click to add instantly):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.slice(0, 8).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onAddSkill(suggestion)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-sans bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 hover:text-teal-900 transition-colors cursor-pointer"
              >
                <span>+ {suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Skills List */}
      <div className="pt-2">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 pb-2">
          Current Skills ({skills.length})
        </div>
        {skills.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200">
            No skills recorded yet. Add your core technical, vocational, or soft skills above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((rawSkill) => {
              const formatted = formatSkillName(rawSkill);
              return (
                <span
                  key={rawSkill}
                  className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-300 text-slate-900 text-xs font-medium shadow-2xs hover:border-slate-400 transition-colors"
                >
                  <span>{formatted}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveSkill(rawSkill)}
                    aria-label={`Remove ${formatted}`}
                    className="p-1 -mr-1 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
