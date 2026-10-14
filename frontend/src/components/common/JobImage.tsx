import React, { useState } from "react";
import { Building2 } from "lucide-react";

interface JobImageProps {
  src?: string | null;
  title?: string | null;
  alt?: string;
  className?: string;
  fallbackIcon?: "building" | "none";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: "eager" | "lazy";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
}

export const JobImage: React.FC<JobImageProps> = ({
  src,
  title,
  alt = "Company Logo",
  className = "",
  fallbackIcon = "none",
  size = "md",
  loading = "lazy",
  decoding = "async",
  fetchPriority,
}) => {
  const [hasError, setHasError] = useState(false);

  const dimensions = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 80,
  }[size];

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
        width={dimensions}
        height={dimensions}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        onError={() => setHasError(true)}
        className={`object-cover rounded border border-slate-200 shrink-0 bg-slate-50 ${sizeClasses} ${className}`}
      />
    );
  }

  if (fallbackIcon === "building") {
    return (
      <div
        className={`bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center rounded shrink-0 ${sizeClasses} ${className}`}
        title={title || alt}
      >
        <Building2 className={`${iconSizes} text-slate-600`} />
      </div>
    );
  }

  return null;
};
