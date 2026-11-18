import React, { useEffect, useState } from "react";
import { CalendarPlus, Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "../ui";
import { downloadInterviewIcs } from "../../lib/schedule-location";

export interface OnlineInterviewActionsProps {
  interviewId: number;
  title: string;
  scheduledAt?: string | null;
  meetingUrl: string;
  joinVariant?: "primary" | "outline";
}

/** Join, copy link, and `.ics` download actions for an upcoming online interview. */
export const OnlineInterviewActions: React.FC<OnlineInterviewActionsProps> = ({
  interviewId,
  title,
  scheduledAt,
  meetingUrl,
  joinVariant = "outline",
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(meetingUrl);
      setCopied(true);
    } catch {
      // Clipboard blocked in restricted browser contexts; URL stays visible on screen.
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant={joinVariant} size="sm">
        <a href={meetingUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Join online interview
        </a>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        onClick={handleCopy}
      >
        {copied ? "Link copied" : "Copy link"}
      </Button>
      {scheduledAt && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<CalendarPlus className="h-3.5 w-3.5" />}
          onClick={() =>
            downloadInterviewIcs({
              interviewId,
              title,
              scheduledAt,
              location: meetingUrl,
            })
          }
        >
          Add to calendar
        </Button>
      )}
    </div>
  );
};
