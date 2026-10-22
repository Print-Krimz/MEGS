import React from "react";
import { m, useReducedMotion } from "./motion";

/** True while the element is on screen. Falls back to true where IntersectionObserver is missing. */
export const useOnScreen = (ref: React.RefObject<Element | null>) => {
  const [onScreen, setOnScreen] = React.useState(true);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
};

const GRID_LINE = "rgba(255,255,255,0.05)";
const GRID_STYLE: React.CSSProperties = {
  backgroundImage: `linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px)`,
  backgroundSize: "56px 56px",
  maskImage: "radial-gradient(ellipse 90% 80% at 100% 0%, #000 0%, transparent 78%)",
  WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 100% 0%, #000 0%, transparent 78%)",
};

const DRIFT_RED = { x: [0, 56, -24, 0], y: [0, 34, 70, 0] };
const DRIFT_BLUE = { x: [0, -48, 20, 0], y: [0, -40, -12, 0] };

/**
 * Decorative navy backdrop: a fixed fine grid plus two soft red and blue lights that drift very
 * slowly (24s and 32s cycles). The drift runs only while `active` and is static under reduced motion.
 * Transform-only animation, no blur filters.
 */
export const HeroBackdrop: React.FC<{ active: boolean }> = ({ active }) => {
  const reduceMotion = useReducedMotion();
  const drifting = active && !reduceMotion;
  const settle = { duration: 1.2, ease: "easeOut" as const };

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={GRID_STYLE} />
      <m.div
        className="absolute -right-[18%] -top-[30%] size-[85%] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(200,16,46,0.34), rgba(200,16,46,0) 100%)" }}
        animate={drifting ? DRIFT_RED : { x: 0, y: 0 }}
        transition={drifting ? { duration: 24, ease: "easeInOut", repeat: Infinity } : settle}
      />
      <m.div
        className="absolute -bottom-[34%] -left-[22%] size-[95%] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(26,85,196,0.42), rgba(26,85,196,0) 100%)" }}
        animate={drifting ? DRIFT_BLUE : { x: 0, y: 0 }}
        transition={drifting ? { duration: 32, ease: "easeInOut", repeat: Infinity } : settle}
      />
    </div>
  );
};
