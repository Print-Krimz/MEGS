import type { ApplicationStatus, TalentPoolInvitationStatus } from "./enums";

export const OFFER_DECLINE_REASONS = [
  { value: "NOT_INTERESTED", label: "Not interested in this role" },
  { value: "UNAVAILABLE_EMPLOYED", label: "Currently employed or no longer looking" },
  { value: "SALARY_MISMATCH", label: "Pay does not match" },
  { value: "LOCATION_COMMUTE", label: "Location or commute" },
  { value: "OTHER", label: "Other reason" },
] as const;

export type OfferDeclineReason = (typeof OFFER_DECLINE_REASONS)[number]["value"];

export interface PublicTracking {
  trackingCode: string;
  applicantName: string;
  jobTitle: string;
  clientName: string | null;
  status: ApplicationStatus;
  appliedAt: string;
  nextInterview: { type: string; scheduledAt: string } | null;
  venue: string | null;
  updatedAt: string;
}

export interface PublicOffer {
  invitationId: number;
  status: TalentPoolInvitationStatus;
  applicantFirstName: string;
  jobTitle: string;
  clientName: string | null;
  location: string | null;
  message: string | null;
  expiresAt: string | null;
}

export interface PublicOfferResponseBody {
  token: string;
  decision: "ACCEPT" | "DECLINE";
  declineReason?: OfferDeclineReason;
}

export interface PublicOfferResult {
  status: "ACCEPTED" | "DECLINED";
  applicationId?: number;
}
