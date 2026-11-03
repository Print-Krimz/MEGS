import React, { useState } from "react";
import { formatSkillName } from "../../lib/profile-health";
import { parseSkillsArray } from "../../lib/mrf-presets";
import { Button, Input } from "../ui";
import { Plus, X } from "lucide-react";

interface SkillsSectionProps {
  skills: string[];
  onAddSkill: (skills: string[]) => void;
  onRemoveSkill: (skill: string) => void;
  isUpdating?: boolean;
  showHeader?: boolean;
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

const HAS_LETTER = /\p{L}/u;

export const SkillsSection: React.FC<SkillsSectionProps> = ({
  skills,
  onAddSkill,
  onRemoveSkill,
  isUpdating = false,
  showHeader = true,
}) => {
  const [inputValue, setInputValue] = useState("");

  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const seen = new Set(skills.map((s) => s.toLowerCase()));
    const entries = parseSkillsArray(inputValue).map(formatSkillName);
    // A skill is a name, so numbers alone (e.g. 109021) are not accepted.
    const named = entries.filter((skill) => HAS_LETTER.test(skill));
    const fresh = named.filter((skill) => {
      const key = skill.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length > 0) onAddSkill(fresh);
    if (named.length < entries.length) {
      setError("A skill needs at least one letter. Numbers alone are not added.");
      if (fresh.length === 0) return;
    } else {
      setError(null);
    }
    setInputValue("");
  };

  const availableSuggestions = COMMON_SUGGESTIONS.filter(
    (s) => !skills.some((existing) => existing.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="border-b border-[#D9E2EC] pb-4">
          <h3 className="text-base font-bold text-[#102A43]">Technical & Practical Skills</h3>
          <p className="text-xs text-[#486581]">
            List competencies and credentials used for automated candidate matching and requisition placement.
          </p>
        </div>
      )}

      {/* Input Field */}
      <div className="flex gap-2">
        <Input
          placeholder="Type a skill (e.g. TypeScript, CCTV Monitoring, Customer Care) and press Enter"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
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

      {error && (
        <p role="alert" className="-mt-4 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Suggested Skills Carousel */}
      {availableSuggestions.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-medium text-[#486581]">
            Suggested Skills (click to add instantly):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.slice(0, 8).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onAddSkill([suggestion])}
                className="inline-flex min-h-11 items-center gap-1 px-2.5 py-1.5 text-xs font-sans md:min-h-8 applicant-touch:min-h-11 bg-[#F7F9FC] hover:bg-[#EAF0F7] border border-[#D9E2EC] hover:border-[#0B315D]/40 text-[#102A43] hover:text-[#0B315D] rounded-md transition-colors cursor-pointer"
              >
                <span>+ {suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Skills List */}
      <div className="pt-2">
        <div className="text-xs font-medium text-[#486581] pb-2">
          Current Skills ({skills.length})
        </div>
        {skills.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#486581] bg-[#F7F9FC] border border-dashed border-[#D9E2EC]">
            No skills recorded yet. Add your core technical, vocational, or soft skills above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((rawSkill) => {
              const formatted = formatSkillName(rawSkill);
              return (
                <span
                  key={rawSkill}
                  className="inline-flex max-w-full items-center gap-1 pl-2.5 pr-1 py-0 bg-white border border-[#D9E2EC] text-[#102A43] text-xs font-medium shadow-2xs hover:border-[#0B315D]/40 transition-colors"
                >
                  <span className="min-w-0 break-all">{formatted}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveSkill(rawSkill)}
                    aria-label={`Remove ${formatted}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded md:size-8 applicant-touch:size-11 text-[#486581] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
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
