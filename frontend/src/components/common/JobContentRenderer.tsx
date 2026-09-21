import React from "react";
import { cn } from "../../lib/utils";

export interface JobContentRendererProps {
  content?: string | null;
  variant?: "ta" | "applicant";
  skillsOnly?: boolean;
  className?: string;
}

export interface MetadataItem {
  key: string;
  value: string;
}

export type ContentBlock =
  | { type: "heading"; text: string; level?: number }
  | { type: "metadata"; items: MetadataItem[] }
  | { type: "list"; items: string[] }
  | { type: "skills"; skills: string[]; label?: string }
  | { type: "paragraph"; text: string };

const variantStyles = {
  ta: {
    heading: "text-sm font-semibold text-slate-900 mt-5 mb-2 first:mt-0",
    paragraph: "text-sm text-slate-700 max-w-prose leading-relaxed mb-3 last:mb-0",
    list: "space-y-2 mb-4",
    listItem: "flex items-start gap-2.5 text-sm text-slate-700 max-w-prose leading-relaxed",
    bulletDot: "w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0",
    skillChip: "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200",
    metadataContainer: "flex flex-wrap gap-2 my-3",
    metadataChip: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border bg-slate-50 border-slate-200 text-slate-700",
    metadataKey: "font-medium text-slate-500",
    metadataValue: "font-semibold text-slate-900",
  },
  applicant: {
    heading: "text-sm font-semibold text-[#102A43] mt-5 mb-2 first:mt-0",
    paragraph: "text-sm text-[#102A43] max-w-prose leading-relaxed mb-3 last:mb-0",
    list: "space-y-2 mb-4",
    listItem: "flex items-start gap-2.5 text-sm text-[#102A43] max-w-prose leading-relaxed",
    bulletDot: "w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0",
    skillChip: "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#EAF0F7] text-[#0B315D] border border-[#D9E2EC]",
    metadataContainer: "flex flex-wrap gap-2 my-3",
    metadataChip: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border bg-[#F0F4F8] border-[#D9E2EC] text-[#102A43]",
    metadataKey: "font-medium text-[#627D98]",
    metadataValue: "font-semibold text-[#102A43]",
  },
};

function cleanTitle(raw: string): string {
  const stripped = raw
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/:$/, "")
    .trim();

  if (stripped.length > 3 && stripped === stripped.toUpperCase() && /[A-Z]/.test(stripped)) {
    const acronyms = new Set(["HR", "QA", "UI", "UX", "IT", "CEO", "CTO", "VP", "CS", "AI", "MRF"]);
    return stripped
      .toLowerCase()
      .split(/\s+/)
      .map((word) => {
        const upper = word.toUpperCase();
        if (acronyms.has(upper)) return upper;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  return stripped;
}

function renderInlineContent(text: string): React.ReactNode {
  if (!text.includes("**") && !text.includes("__") && !text.includes("`")) {
    return text;
  }
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*|__)(.*?)\1|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">
          {match[3]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

const KNOWN_LIST_HEADINGS =
  /^(responsibilities|roles?\s+and\s+responsibilities|duties\s+and\s+responsibilities|duties|key\s+responsibilities|qualifications|requirements|required\s+skills\s+and\s+qualifications|minimum\s+qualifications|preferred\s+qualifications|what\s+you('ll|\s+will)\s+do|what\s+we\s+offer|what\s+we're\s+looking\s+for|what\s+you\s+need|benefits|perks|work\s+environment|nice\s+to\s+have|eligibility):?$/i;

const KNOWN_SKILL_HEADINGS =
  /^(skills|technical\s+skills|required\s+skills|preferred\s+skills|key\s+skills|core\s+skills|competencies|core\s+competencies|tools\s*&\s*technologies|tools\s+and\s+technologies):?$/i;

const KNOWN_PROSE_HEADINGS =
  /^(about\s+the\s+role|job\s+overview|position\s+overview|role\s+overview|overview|summary|about\s+us|job\s+summary|company\s+overview|who\s+we\s+are):?$/i;

const METADATA_KEYS_PATTERN =
  /^(department|reports\s+to|reporting\s+to|employment\s+type|job\s+type|work\s+arrangement|location|office\s+location|salary|salary\s+range|compensation|experience|experience\s+level|education|openings|vacancies|shift|schedule|start\s+date|posting\s+date|reference\s+code|job\s+id|position\s+type|industry|client|status)$/i;

function parseKeyValue(line: string): MetadataItem | null {
  const match = line.match(/^([A-Za-z0-9\s/&()-]{2,35}):\s+(.+)$/);
  if (!match) return null;
  const key = match[1].trim();
  const value = match[2].trim();

  if (!value) return null;
  if (/^(http|https)$/i.test(key)) return null;
  if (/^(note|important|warning|caution|tip|ps|p\.s\.|example)$/i.test(key)) return null;
  if (KNOWN_LIST_HEADINGS.test(key)) return null;
  if (KNOWN_SKILL_HEADINGS.test(key)) return null;
  if (KNOWN_PROSE_HEADINGS.test(key)) return null;

  if (METADATA_KEYS_PATTERN.test(key)) {
    return { key, value };
  }

  if (key.split(/\s+/).length <= 4 && value.length <= 100 && !/[.!?]\s+[A-Z]/.test(value)) {
    return { key, value };
  }

  return null;
}

function isCommaSeparatedSkills(line: string): boolean {
  if (!line.includes(",")) return false;
  const cleaned = line.replace(/^[-*•–—\u2022]\s*/, "");
  const parts = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return false;

  // Reject if any part looks like a full sentence or narrative qualification description
  const narrativeIndicators =
    /\b(we|the|our|this|these|in|on|at|with|to|for|is|are|you|candidate|must|should|have|has|be|degree|bachelor|master|diploma|experience|years|field|or related|equivalent|proficiency|knowledge of)\b/i;

  return parts.every(
    (part) =>
      part.length <= 35 &&
      part.split(/\s+/).length <= 4 &&
      !/[.!?]$/.test(part) &&
      !narrativeIndicators.test(part)
  );
}

function parseHeading(line: string): { text: string; level: number } | null {
  // Markdown heading: ### Title
  const hashMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (hashMatch) {
    return { text: cleanTitle(hashMatch[2]), level: hashMatch[1].length };
  }

  // Bold line: **Title**:?
  const boldMatch = line.match(/^\*\*([^*]+)\*\*:?$/) || line.match(/^__([^_]+)__:?$/);
  if (boldMatch && boldMatch[1].trim().length <= 60) {
    return { text: cleanTitle(boldMatch[1]), level: 3 };
  }

  // Known skill headings (e.g. "Skills:", "Technical Skills")
  if (KNOWN_SKILL_HEADINGS.test(line)) {
    return { text: cleanTitle(line), level: 3 };
  }

  // Known list headings (e.g. "Responsibilities:", "Qualifications")
  if (KNOWN_LIST_HEADINGS.test(line)) {
    return { text: cleanTitle(line), level: 3 };
  }

  // Known prose headings (e.g. "Position Overview", "About the Role")
  if (KNOWN_PROSE_HEADINGS.test(line)) {
    return { text: cleanTitle(line), level: 3 };
  }

  // Short title ending with colon and nothing else
  if (line.endsWith(":") && line.length <= 40 && !line.includes("\n")) {
    return { text: cleanTitle(line), level: 3 };
  }

  // All caps short line: RESPONSIBILITIES
  if (
    line.length >= 3 &&
    line.length <= 40 &&
    line === line.toUpperCase() &&
    /^[A-Z0-9\s/&()-]+$/.test(line) &&
    /[A-Z]/.test(line)
  ) {
    return { text: cleanTitle(line), level: 3 };
  }

  return null;
}

function parseJobContent(content: string): ContentBlock[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: ContentBlock[] = [];

  let currentSection = "";
  let currentSectionType: "none" | "list" | "skills" | "normal" = "none";

  let pendingList: string[] = [];
  let pendingMetadata: MetadataItem[] = [];
  let pendingParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (pendingParagraphLines.length > 0) {
      blocks.push({ type: "paragraph", text: pendingParagraphLines.join(" ") });
      pendingParagraphLines = [];
    }
  };

  const flushList = () => {
    if (pendingList.length > 0) {
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === "list" && currentSectionType === "list") {
        lastBlock.items.push(...pendingList);
      } else {
        blocks.push({ type: "list", items: [...pendingList] });
      }
      pendingList = [];
    }
  };

  const flushMetadata = () => {
    if (pendingMetadata.length > 0) {
      blocks.push({ type: "metadata", items: [...pendingMetadata] });
      pendingMetadata = [];
    }
  };

  const flushPending = () => {
    flushMetadata();
    flushList();
    flushParagraph();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushMetadata();
      continue;
    }

    // Check skills heading with values on same line: e.g. "Skills: React, Node.js"
    const skillsSameLine = trimmed.match(
      /^(skills|technical\s+skills|required\s+skills|preferred\s+skills|key\s+skills|core\s+competencies|tools\s*&\s*technologies|tools\s+and\s+technologies):\s*(.*)$/i
    );
    if (skillsSameLine) {
      flushPending();
      const label = cleanTitle(skillsSameLine[1]);
      const afterColon = skillsSameLine[2].trim();

      blocks.push({ type: "heading", text: label, level: 3 });
      currentSection = label;
      currentSectionType = "skills";

      if (afterColon) {
        const skills = afterColon
          .split(/[,;•*]+/)
          .map((s) => s.trim().replace(/^[-*•–—\u2022]\s*/, ""))
          .filter(Boolean);
        if (skills.length > 0) {
          blocks.push({ type: "skills", skills, label });
        }
      }
      continue;
    }

    // Check heading
    const heading = parseHeading(trimmed);
    if (heading) {
      flushPending();
      blocks.push({ type: "heading", text: heading.text, level: heading.level });
      currentSection = heading.text;
      if (KNOWN_SKILL_HEADINGS.test(heading.text)) {
        currentSectionType = "skills";
      } else if (KNOWN_LIST_HEADINGS.test(heading.text)) {
        currentSectionType = "list";
      } else {
        currentSectionType = "normal";
      }
      continue;
    }

    // Check metadata key-value
    const kv = parseKeyValue(trimmed);
    if (kv) {
      flushParagraph();
      flushList();
      pendingMetadata.push(kv);
      continue;
    }

    // Check if within a skills section
    if (currentSectionType === "skills") {
      flushParagraph();
      flushList();
      flushMetadata();
      const items = trimmed
        .split(/[,;•*]+/)
        .map((s) => s.trim().replace(/^[-*•–—\u2022]\s*/, ""))
        .filter(Boolean);
      if (items.length > 0) {
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && lastBlock.type === "skills") {
          lastBlock.skills.push(...items);
        } else {
          blocks.push({ type: "skills", skills: items, label: currentSection });
        }
      }
      continue;
    }

    // Check standalone comma-separated skills
    if (currentSectionType !== "list" && isCommaSeparatedSkills(trimmed)) {
      flushPending();
      const skills = trimmed
        .split(",")
        .map((s) => s.trim().replace(/^[-*•–—\u2022]\s*/, ""))
        .filter(Boolean);
      blocks.push({ type: "skills", skills });
      continue;
    }

    // Check explicit bullet item
    const bulletMatch =
      trimmed.match(/^[-*•–—\u2022]\s+(.+)$/) || trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      flushMetadata();
      pendingList.push(bulletMatch[1].trim());
      continue;
    }

    // Check list-oriented section line
    if (currentSectionType === "list") {
      flushParagraph();
      flushMetadata();
      const itemText = trimmed
        .replace(/^[-*•–—\u2022]\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
        .trim();
      pendingList.push(itemText);
      continue;
    }

    // Regular prose paragraph
    flushMetadata();
    flushList();
    pendingParagraphLines.push(trimmed);
  }

  flushPending();

  return blocks;
}

export const JobContentRenderer: React.FC<JobContentRendererProps> = ({
  content,
  variant = "ta",
  skillsOnly = false,
  className,
}) => {
  if (!content || !content.trim()) {
    return null;
  }

  const currentStyles = variantStyles[variant];

  // Skills Only mode
  if (skillsOnly) {
    const rawSkills = content
      .split(/[,;\n\r•*]+/)
      .map((s) => s.trim().replace(/^[-*•–—\u2022]\s*/, "").replace(/^\d+[.)]\s*/, ""))
      .filter(Boolean);

    if (rawSkills.length === 0) return null;

    return (
      <div className={cn("flex flex-wrap gap-1.5", className)} role="list" aria-label="Skills">
        {rawSkills.map((skill, i) => (
          <span key={i} role="listitem" className={currentStyles.skillChip}>
            {skill}
          </span>
        ))}
      </div>
    );
  }

  const blocks = parseJobContent(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={cn("text-left space-y-3", className)}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            return block.level && block.level <= 2 ? (
              <h3 key={idx} className={currentStyles.heading}>
                {block.text}
              </h3>
            ) : (
              <h4 key={idx} className={currentStyles.heading}>
                {block.text}
              </h4>
            );
          }
          case "metadata": {
            return (
              <div
                key={idx}
                className={currentStyles.metadataContainer}
                role="region"
                aria-label="Job Details"
              >
                {block.items.map((item, mIdx) => (
                  <div key={mIdx} className={currentStyles.metadataChip}>
                    <span className={currentStyles.metadataKey}>{item.key}:</span>
                    <span className={currentStyles.metadataValue}>{item.value}</span>
                  </div>
                ))}
              </div>
            );
          }
          case "list": {
            return (
              <ul key={idx} className={currentStyles.list}>
                {block.items.map((item, lIdx) => (
                  <li key={lIdx} className={currentStyles.listItem}>
                    <span className={currentStyles.bulletDot} aria-hidden="true" />
                    <span>{renderInlineContent(item)}</span>
                  </li>
                ))}
              </ul>
            );
          }
          case "skills": {
            return (
              <div
                key={idx}
                className="flex flex-wrap gap-1.5 my-2"
                role="list"
                aria-label="Skills"
              >
                {block.skills.map((skill, sIdx) => (
                  <span key={sIdx} role="listitem" className={currentStyles.skillChip}>
                    {skill}
                  </span>
                ))}
              </div>
            );
          }
          case "paragraph": {
            return (
              <p key={idx} className={currentStyles.paragraph}>
                {renderInlineContent(block.text)}
              </p>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
};
