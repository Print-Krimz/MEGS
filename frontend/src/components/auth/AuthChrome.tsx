import React, { useEffect, useRef } from "react";
import { AlertCircle, Check } from "lucide-react";
import { AnimatePresence, m } from "../public/motion";
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

/** Cross-fade wrapper for multi-step flows (register, password reset). */
export const AuthStep: React.FC<{ stepKey: string; children: React.ReactNode }> = ({ stepKey, children }) => (
  <AnimatePresence mode="wait" initial={false}>
    <m.div
      key={stepKey}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      {children}
    </m.div>
  </AnimatePresence>
);

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
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-secondary text-secondary-foreground",
                  !active && !done && "border border-input text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn(!active && "max-sm:sr-only")}>{name}</span>
            </li>
            {i < steps.length - 1 && <li aria-hidden="true" className="h-px flex-1 bg-border" />}
          </React.Fragment>
        );
      })}
    </ol>
  </nav>
);
