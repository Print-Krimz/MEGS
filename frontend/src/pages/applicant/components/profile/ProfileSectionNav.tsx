import React, { useRef } from "react";
import type { ProfileSection } from "./profile-navigation";
import { PROFILE_SECTIONS } from "./profile-navigation";

export interface ProfileSectionNavProps {
  activeSection: ProfileSection;
  onChange: (section: ProfileSection) => void;
}

export const ProfileSectionNav: React.FC<ProfileSectionNavProps> = ({ activeSection, onChange }) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (index: number) => {
    const nextIndex = (index + PROFILE_SECTIONS.length) % PROFILE_SECTIONS.length;
    const next = PROFILE_SECTIONS[nextIndex];
    tabRefs.current[nextIndex]?.focus();
    onChange(next.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(PROFILE_SECTIONS.length - 1);
    }
  };

  return (
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label="Candidate profile sections"
        className="hidden md:flex items-stretch gap-1 border-b border-slate-200"
      >
        {PROFILE_SECTIONS.map((section, index) => {
          const Icon = section.icon;
          const isActive = section.id === activeSection;
          return (
            <button
              key={section.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              type="button"
              role="tab"
              id={`profile-tab-${section.id}`}
              aria-selected={isActive}
              aria-controls={`profile-panel-${section.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(section.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 border-b-2 px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] focus-visible:ring-offset-2 ${
                isActive
                  ? "border-[#0F294A] text-[#0F294A] font-semibold"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      <div className="md:hidden space-y-1">
        <label htmlFor="profile-section-select" className="text-xs font-semibold text-slate-700">
          Profile section
        </label>
        <select
          id="profile-section-select"
          aria-label="Profile section"
          value={activeSection}
          onChange={(event) => onChange(event.target.value as ProfileSection)}
          className="min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] focus-visible:ring-offset-1"
        >
          {PROFILE_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>{section.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
