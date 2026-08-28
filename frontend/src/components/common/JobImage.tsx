import React, { useState } from "react";
import { Building2, Briefcase } from "lucide-react";

interface JobImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackIcon?: "building" | "briefcase";
  size?: "sm" | "md" | "lg" | "xl";
}

export const JobImage: React.FC<JobImageProps> = ({
  src,
  alt = "Company or Job Requisition",
  className = "",
  fallbackIcon = "briefcase",
  size = "md",
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  }[size];

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-10 h-10",
  }[size];

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className={`object-cover rounded border border-slate-200 shrink-0 bg-slate-50 ${sizeClasses} ${className}`}
      />
    );
  }

  const Icon = fallbackIcon === "building" ? Building2 : Briefcase;

  return (
    <div
      className={`bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center rounded shrink-0 shadow-xs ${sizeClasses} ${className}`}
      title={alt}
    >
      <Icon className={`${iconSizes} text-teal-700`} />
    </div>
  );
};