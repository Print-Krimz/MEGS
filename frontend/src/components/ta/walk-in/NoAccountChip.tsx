import React from "react";
import { UserX } from "lucide-react";
import { cn } from "../../../lib/utils";
import { TA_STATUS_TONE_CLASSES } from "../../../lib/ta-copy";

/**
 * Marks a worker who cannot use the applicant portal, so the TA records replies or texts offers.
 * Shows nothing when the worker has an account or the account state is unknown.
 */
export const NoAccountChip: React.FC<{ hasPortalAccess?: boolean | null; className?: string }> = ({
  hasPortalAccess,
  className,
}) => {
  if (hasPortalAccess !== false) return null;
  return (
    <span
      title="No applicant account. You record their replies or text them an offer link."
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium",
        TA_STATUS_TONE_CLASSES.warning,
        className,
      )}
    >
      <UserX aria-hidden="true" className="size-3.5" />
      No account
    </span>
  );
};
