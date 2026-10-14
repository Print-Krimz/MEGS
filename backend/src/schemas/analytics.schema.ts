import { z } from "zod";
import { boundedText, boundedId, dateOnly, FIELD_LIMITS } from "./field-limits.js";

const dateFilters = {
  range: z.enum(["7d", "30d", "90d", "custom"]).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
};

const filterFields = {
  ...dateFilters,
  clientId: boundedId.optional(),
  mrfId: boundedId.optional(),
  jobPostingId: boundedId.optional(),
  stage: boundedText(FIELD_LIMITS.name).optional(),
  recruiterId: boundedText(128).optional(),
  mineOnly: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
};

export const analyticsSchema = {
  filters: z.object({ query: z.object(filterFields).strict().superRefine((query, ctx) => {
    const hasOneDate = Boolean(query.startDate || query.endDate);
    if (query.range === "custom" && (!query.startDate || !query.endDate)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Both dates are required for a custom range" });
    }
    if (hasOneDate && (!query.startDate || !query.endDate)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Both start and end dates are required" });
    }
    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Start date must be on or before end date" });
    }
  }) }),
  report: z.object({ query: z.object({ ...filterFields, format: z.enum(["pdf", "xlsx"]).optional() }).strict().superRefine((query, ctx) => {
    const hasOneDate = Boolean(query.startDate || query.endDate);
    if ((query.range === "custom" || hasOneDate) && (!query.startDate || !query.endDate)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Both start and end dates are required" });
    }
    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Start date must be on or before end date" });
    }
  }) }),
};
