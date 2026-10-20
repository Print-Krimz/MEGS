import { STAFF_STAGE_LABELS } from "../../lib/ta-copy";
import type { ApplicationStatus } from "../../lib/types/enums";

/** Stage name from the shared TA glossary, so Reports reads the same as Overview and Applications. */
export const analyticsStageLabel = (stage: string, fallback: string): string =>
  stage === "APPLIED" ? STAFF_STAGE_LABELS.SUBMITTED : STAFF_STAGE_LABELS[stage as ApplicationStatus] ?? fallback;
