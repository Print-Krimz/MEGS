import React from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";

/** Wraps a MEGS public/auth surface: lazy-loaded motion features, reduced-motion honoured. */
export const MotionRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </LazyMotion>
);

/** One-shot scroll reveal: 12px rise + fade, 250ms. Content stays visible without JS motion. */
export const Reveal: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { delay?: number }
> = ({ delay = 0, children, ...rest }) =>
  typeof IntersectionObserver === "undefined" ? (
    <div {...rest}>{children}</div>
  ) : (
  <m.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.25, ease: "easeOut", delay }}
    {...(rest as object)}
  >
    {children}
  </m.div>
  );

export { m, AnimatePresence };
