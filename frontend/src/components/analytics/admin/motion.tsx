import React, { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";

/**
 * Reports motion: one first-load moment (numbers count up while bars grow from zero) and quick
 * transitions when a filter changes the data. Reduced motion shows the final values at once.
 */
export const REPORT_EASE = [0.16, 1, 0.3, 1] as const;
export const FIRST_LOAD_MS = 650;
export const UPDATE_MS = 280;

/** A number that counts from its previous value (0 on first render) to `value`. Non-numeric text renders as is. */
export const AnimatedNumber: React.FC<{ value: number; format?: (n: number) => string; className?: string }> = ({
  value,
  format = (n) => String(Math.round(n)),
  className,
}) => {
  const reduce = useReducedMotion();
  const previous = useRef<number | null>(null);
  const [shown, setShown] = useState(() => (reduce ? value : 0));

  useEffect(() => {
    const from = previous.current ?? 0;
    const first = previous.current === null;
    previous.current = value;
    if (reduce || from === value) {
      setShown(value);
      return;
    }
    const controls = animate(from, value, {
      duration: (first ? FIRST_LOAD_MS : UPDATE_MS) / 1000,
      ease: REPORT_EASE,
      onUpdate: setShown,
    });
    return () => controls.stop();
  }, [value, reduce]);

  // Screen readers get the final value, not every frame.
  return (
    <span className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
};

interface GrowProps {
  /** "x" grows from the left edge (horizontal bars), "y" from the bottom (columns). */
  axis?: "x" | "y";
  /** Order in a list, for a short stagger on first load. Capped so long lists do not drag. */
  index?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** A bar fill that grows from zero on first load. Size it with width/height in `style` as usual. */
export const GrowFill: React.FC<GrowProps> = ({ axis = "x", index = 0, className, style, children }) => {
  const reduce = useReducedMotion();
  const scale = axis === "x" ? "scaleX" : "scaleY";
  return (
    <motion.div
      className={className}
      style={{ ...style, transformOrigin: axis === "x" ? "left center" : "center bottom" }}
      initial={reduce ? false : { [scale]: 0 }}
      animate={{ [scale]: 1 }}
      transition={{ duration: FIRST_LOAD_MS / 1000, ease: REPORT_EASE, delay: Math.min(index, 8) * 0.04 }}
    >
      {children}
    </motion.div>
  );
};
