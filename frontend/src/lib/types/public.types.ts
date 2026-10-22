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

export interface CheckInJob {
  id: number;
  title: string;
  clientName: string | null;
  location: string | null;
}

export interface CheckInSubmitBody {
  jobPostingId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNumber?: string;
  birthDate: string;
  turnstileToken: string;
  /** Optional biodata photo or PDF, up to 5 MB. */
  file?: File;
}

export interface CheckInCreated {
  alreadyCheckedIn?: false;
  publicId: string;
  viewToken: string;
  queueNumber: string;
  statusPath: string;
}

/** 200 with no link: the same person already checked in today. */
export interface CheckInAlready {
  alreadyCheckedIn: true;
  queueNumber: string;
}

export type CheckInSubmitResult = CheckInCreated | CheckInAlready;

export interface PublicCheckInStatus {
  queueNumber: string;
  status: "PENDING" | "CONFIRMED" | "DISMISSED";
  firstName: string;
  jobTitle: string;
  createdAt: string;
  expiresAt: string;
  /** Filled once the check-in is confirmed. */
  tracking: PublicTracking | null;
}
