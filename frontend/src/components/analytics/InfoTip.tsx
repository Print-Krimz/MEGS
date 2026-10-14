import React, { useEffect, useId, useRef, useState } from "react";

interface InfoTipProps {
  /** The explanation. Kept out of the way until asked for. */
  children: React.ReactNode;
  /** Names the thing being explained, for the button's accessible name. */
  label: string;
  align?: "left" | "right";
}

/** A small (i) button that explains a heading or number on hover, focus or click. Escape or a click elsewhere closes it. */
export const InfoTip: React.FC<InfoTipProps> = ({ children, label, align = "left" }) => {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const open = pinned || hovered;

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setPinned(false);
      setHovered(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    const onClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex align-middle" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-400 text-[11px] font-serif font-bold italic leading-none text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={`absolute top-full z-30 mt-1 w-64 max-w-[80vw] border border-slate-300 bg-white p-2.5 text-xs font-sans font-normal normal-case leading-snug tracking-normal text-slate-700 shadow-md ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
};
