import React from "react";
import { AlertTriangle } from "lucide-react";

/** A non-blocking note under a form field: the value can be saved, but may not work as intended. */
export const FieldWarning: React.FC<{ show: boolean; children: React.ReactNode }> = ({ show, children }) =>
  show ? (
    <p role="status" className="flex items-start gap-1.5 text-xs text-amber-800">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  ) : null;
