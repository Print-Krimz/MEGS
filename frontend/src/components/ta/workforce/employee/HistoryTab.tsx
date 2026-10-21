import React from "react";
import { Timeline, type TimelineItem } from "../../../common";
import type { EmploymentEvent } from "../../../../lib/types/employee.types";
import { formatDateTime } from "../../../../lib/utils";
import { employmentEventLabel } from "../../../../lib/labels";
import { SECTION_HEADING } from "./shared";

/** Employment events, newest first as the server returns them. */
export const HistoryTab: React.FC<{ events: EmploymentEvent[] }> = ({ events }) => {
  const items: TimelineItem[] = events.map((event) => ({
    id: String(event.id),
    title: employmentEventLabel(event.eventType),
    status: { label: "Recorded", tone: "neutral" },
    meta: [
      { label: "Date", value: formatDateTime(event.effectiveDate) },
      ...(event.actor ? [{ label: "By", value: event.actor.email }] : []),
    ],
    body: event.description,
  }));

  return (
    <div className="space-y-4">
      <h2 className={SECTION_HEADING}>Employment history</h2>
      {items.length === 0 ? (
        <p className="py-2 text-sm text-slate-600">No employment events recorded.</p>
      ) : (
        <Timeline ariaLabel="Employment history" items={items} />
      )}
    </div>
  );
};
