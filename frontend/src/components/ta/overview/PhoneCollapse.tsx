import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";

const QUERY = "(min-width: 768px)";

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribe = (notify: () => void) => {
  if (!canMatch()) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
};

const useIsWide = () =>
  useSyncExternalStore(
    subscribe,
    () => (canMatch() ? window.matchMedia(QUERY).matches : true),
    () => true,
  );

interface PhoneCollapseProps {
  /** Shown as the disclosure label on a phone. */
  title: string;
  /** Id of the panel inside. A link to "#id" opens the disclosure so the panel can scroll into view. */
  targetId?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Keeps a panel open from tablet width up. On a phone it folds into a closed disclosure so the page stays short.
 * The panel is rendered once, so ids and tests that look it up see a single element.
 */
export const PhoneCollapse: React.FC<PhoneCollapseProps> = ({ title, targetId, className, children }) => {
  const wide = useIsWide();
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(`a[href="#${targetId}"]`);
      if (link) setUserOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [targetId]);

  return (
    <details
      open={wide || userOpen}
      onToggle={(event) => {
        if (!wide) setUserOpen(event.currentTarget.open);
      }}
      className={className}
    >
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-950 md:hidden [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${userOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </summary>
      <div className="max-md:mt-3">{children}</div>
    </details>
  );
};
