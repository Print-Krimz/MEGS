import React, { useEffect, useRef } from "react";
import { AlertCircle, Check } from "lucide-react";
import { AnimatePresence, EASE_OUT, m } from "../public/motion";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { cn } from "../../lib/shadcn-utils";

/** Destructive inline alert that animates its height in and out. */
export const AuthError: React.FC<{ message?: string | null; className?: string }> = ({ message, className }) => (
  <AnimatePresence initial={false}>
    {message && (
      <m.div
        key="auth-error"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn("overflow-hidden", className)}
      >
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="text-destructive">{message}</AlertDescription>
        </Alert>
      </m.div>
    )}
  </AnimatePresence>
);

/** Step heading. Takes focus when it mounts after a step change so screen readers announce it. */
export const AuthHeading: React.FC<{
  title: string;
  description?: React.ReactNode;
  focusOnMount?: boolean;
  align?: "left" | "center";
}> = ({ title, description, focusOnMount = false, align = "left" }) => {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);
  return (
    <div className={cn("flex flex-col gap-2", align === "center" && "items-center text-center")}>
      <span aria-hidden="true" className="mb-1 block h-1 w-10 rounded-full bg-primary" />
      <h1
        ref={ref}
        tabIndex={-1}
        className="font-display text-2xl leading-tight text-secondary focus:outline-none sm:text-3xl"
      >
        {title}
      </h1>
      {description && <p className="text-base leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
};

/**
 * Cross-fade wrapper for multi-step flows (register, password reset). Pass the step's `order` and the
 * content slides forward when the user advances and back when they return to an earlier step.
 */
export const AuthStep: React.FC<{ stepKey: string; order?: number; children: React.ReactNode }> = ({
  stepKey,
  order = 0,
  children,
}) => {
  const previous = useRef(order);
  const direction = order >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = order;
  }, [order]);

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <m.div
        key={stepKey}
        custom={direction}
        variants={{
          enter: (d: number) => ({ opacity: 0, x: 12 * d }),
          center: { opacity: 1, x: 0, transition: { duration: 0.24, ease: EASE_OUT } },
          exit: (d: number) => ({ opacity: 0, x: -12 * d, transition: { duration: 0.14, ease: "easeIn" } }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
};

/** Shared progress indicator replacing the per-step inline copies. */
export const AuthStepper: React.FC<{ steps: string[]; current: number; label: string }> = ({
  steps,
  current,
  label,
}) => (
  <nav aria-label={label}>
    <ol className="flex items-center gap-3">
      {steps.map((name, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={name}>
            <li
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-sm",
                active || done ? "font-semibold text-secondary" : "text-muted-foreground"
              )}
            >
              <m.span
                aria-hidden="true"
                initial={active && current > 0 ? { scale: 0.6 } : false}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.15 }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-secondary text-secondary-foreground",
                  !active && !done && "border border-input text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </m.span>
              <span className={cn(!active && "max-sm:sr-only")}>{name}</span>
            </li>
            {i < steps.length - 1 && (
              <li aria-hidden="true" className="relative h-px flex-1 bg-border">
                {i < current && (
                  <m.span
                    className="absolute inset-0 origin-left bg-secondary"
                    initial={i === current - 1 ? { scaleX: 0 } : false}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                  />
                )}
              </li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  </nav>
);
