import React from "react";
import { cn } from "../../lib/shadcn-utils";

interface SectionHeaderProps {
  id?: string;
  title: string;
  intro?: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
  action?: React.ReactNode;
}

/** Shared heading block for landing sections: sentence-case title, one plain intro line. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  id,
  title,
  intro,
  className,
  tone = "light",
  action,
}) => (
  <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="max-w-2xl">
      <span aria-hidden="true" className="mb-4 block h-1 w-10 rounded-full bg-primary" />
      <h2
        id={id}
        tabIndex={id ? -1 : undefined}
        className={cn(
          "font-display text-3xl leading-[1.1] sm:text-4xl focus:outline-none",
          tone === "dark" ? "text-white" : "text-secondary"
        )}
      >
        {title}
      </h2>
      {intro && (
        <p
          className={cn(
            "mt-3 text-pretty text-base leading-relaxed sm:text-lg",
            tone === "dark" ? "text-white/75" : "text-muted-foreground"
          )}
        >
          {intro}
        </p>
      )}
    </div>
    {action}
  </div>
);
