import React from "react";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

/** Natural deceleration shared by every public-surface entrance. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

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

/**
 * Scroll-reveal props for a motion element. Without IntersectionObserver (old
 * browsers, jsdom) it returns nothing, so the element renders in its final state.
 */
export const onView = (
  from: Record<string, number | string>,
  to: Record<string, number | string>,
  transition: Record<string, unknown>,
  margin = "-60px"
) =>
  typeof IntersectionObserver === "undefined"
    ? {}
    : { initial: from, whileInView: to, viewport: { once: true, margin }, transition };

/** A heading line that rises out of its own baseline mask on first paint. */
export const LineReveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className,
}) => {
  const reduceMotion = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <m.span
        className={`block ${className ?? ""}`}
        initial={reduceMotion ? false : { y: "105%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay }}
      >
        {children}
      </m.span>
    </span>
  );
};

/**
 * Scroll-linked drift for a decorative or image layer. `distance` is the total travel in px
 * across the element's pass through the viewport. Static under reduced motion.
 */
export const Parallax: React.FC<{ children: React.ReactNode; distance?: number; className?: string }> = ({
  children,
  distance = 60,
  className,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance / 2, -distance / 2]);
  return (
    <m.div ref={ref} className={className} style={reduceMotion ? undefined : { y }}>
      {children}
    </m.div>
  );
};

/** Parent for a list that enters as a list: children using `staggerItem` rise in sequence once. */
export const staggerParent = (step = 0.07) =>
  typeof IntersectionObserver === "undefined"
    ? {}
    : {
        initial: "hidden",
        whileInView: "shown",
        viewport: { once: true, margin: "-80px" },
        variants: { hidden: {}, shown: { transition: { staggerChildren: step } } },
      };

export const staggerItem = {
  variants: {
    hidden: { opacity: 0, y: 16 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
  },
};

export { m, AnimatePresence, useReducedMotion, useScroll, useTransform };
