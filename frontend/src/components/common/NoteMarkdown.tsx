import React from "react";

/**
 * The small Markdown subset recruiters use in notes: paragraphs, "- " or "* " bullets,
 * "1. " numbered lists, **bold** and *italic*. Everything is built as React elements,
 * never as HTML, so a note can not inject markup.
 */
const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      match[1] != null ? (
        <strong key={`${keyPrefix}-${index++}`} className="font-semibold text-slate-950">{match[1]}</strong>
      ) : (
        <em key={`${keyPrefix}-${index++}`}>{match[2]}</em>
      )
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export const parseNoteBlocks = (source: string): Block[] => {
  const blocks: Block[] = [];
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const current = blocks[blocks.length - 1];
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1];
      if (current && current.kind === kind) current.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
    } else if (current && current.kind === "p") {
      current.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter((block) => (block.kind === "p" ? block.lines.length > 0 : block.items.length > 0));
};

export const NoteMarkdown: React.FC<{ source: string; className?: string }> = ({ source, className }) => (
  <div className={`space-y-2 break-words text-sm leading-relaxed text-slate-800 ${className ?? ""}`}>
    {parseNoteBlocks(source).map((block, b) =>
      block.kind === "p" ? (
        <p key={b}>
          {block.lines.map((line, l) => (
            <React.Fragment key={l}>
              {l > 0 && <br />}
              {renderInline(line, `${b}-${l}`)}
            </React.Fragment>
          ))}
        </p>
      ) : block.kind === "ul" ? (
        <ul key={b} className="list-disc space-y-1 pl-5">
          {block.items.map((item, i) => <li key={i}>{renderInline(item, `${b}-${i}`)}</li>)}
        </ul>
      ) : (
        <ol key={b} className="list-decimal space-y-1 pl-5">
          {block.items.map((item, i) => <li key={i}>{renderInline(item, `${b}-${i}`)}</li>)}
        </ol>
      )
    )}
  </div>
);
