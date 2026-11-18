export interface NotePreset {
  label: string;
  text: string;
}

export const COMPLIANCE_NOTE_PRESETS = {
  APPROVED: [
    { label: "Clear copy verified", text: "Verified clear, legible, and valid document copy." },
    { label: "Matches candidate ID", text: "Verified name and document details match the applicant record." },
    { label: "Valid & current", text: "Document verified current and within validity period." },
  ],
  REJECTED: [
    { label: "Blurry / unreadable", text: "Document scan is blurry or unreadable. Please upload a clearer copy." },
    { label: "Expired document", text: "Document is already expired. Please upload a current copy." },
    { label: "Name mismatch", text: "Name on the uploaded document does not match the applicant profile." },
    { label: "Incomplete / cut off", text: "Uploaded file is cropped or missing required pages." },
    { label: "Wrong document", text: "Uploaded file does not match this requirement. Upload the correct document." },
  ],
} as const satisfies Record<"APPROVED" | "REJECTED", NotePreset[]>;

export const INTERVIEW_NOTE_PRESETS = {
  INITIAL_PASS: [
    { label: "Strong communicator", text: "Clear communication, relevant background, and meets role requirements." },
    { label: "Meets qualifications", text: "Verified work history and skills match client requirements." },
  ],
  FINAL_PASS: [
    { label: "Client approved", text: "Client approved the candidate following the final interview." },
    { label: "Selected & agreed terms", text: "Client approved candidate; schedule and terms confirmed." },
  ],
  FAIL: [
    { label: "Skills mismatch", text: "Skills and experience did not meet the role requirements." },
    { label: "Client declined", text: "Client did not select the candidate after the final evaluation." },
    { label: "Schedule / salary mismatch", text: "Candidate availability or salary expectations did not match." },
  ],
  NO_SHOW: [
    { label: "Did not attend", text: "Candidate did not attend the scheduled interview." },
    { label: "Unreachable", text: "Candidate could not be reached on the scheduled interview date." },
  ],
} as const satisfies Record<"INITIAL_PASS" | "FINAL_PASS" | "FAIL" | "NO_SHOW", NotePreset[]>;

const DEFAULT_REJECTION_PRESETS: readonly NotePreset[] = [
  { label: "Did not meet criteria", text: "Candidate did not meet the role or client requirements." },
  { label: "Position filled", text: "Selected another candidate; position has been filled." },
];

export const CLOSE_REJECTION_PRESETS: Record<string, readonly NotePreset[]> = {
  QUALIFICATIONS_MISMATCH: [
    { label: "Experience gap", text: "Work experience and skills did not match the job requirements." },
    { label: "Missing qualification", text: "Required license, certification, or education requirement was not met." },
  ],
  FAILED_SCREENING_INTERVIEW: [
    { label: "Screening not passed", text: "Candidate did not pass the initial screening evaluation." },
    { label: "Communication / fit", text: "Communication or role readiness did not meet screening standards." },
  ],
  CLIENT_DECLINED: [
    { label: "Client selected another", text: "Client declined the candidate after reviewing profile and qualifications." },
    { label: "Not a client fit", text: "Client decided not to proceed with the candidate for this opening." },
  ],
  FAILED_FINAL_INTERVIEW: [
    { label: "Final interview not passed", text: "Candidate did not pass the final client interview." },
    { label: "Panel feedback", text: "Client interview panel did not select the candidate." },
  ],
  SALARY_EXPECTATION_UNMET: [
    { label: "Above budget", text: "Candidate's expected salary exceeded the approved client rate." },
    { label: "Terms not agreed", text: "Could not align on compensation and benefits package." },
  ],
  FAILED_COMPLIANCE: [
    { label: "Unverified requirements", text: "Pre-employment requirements could not be verified." },
    { label: "Incomplete clearance", text: "Candidate could not submit valid pre-employment clearances." },
  ],
  CLIENT_CANCELLED_REQUEST: [
    { label: "Request cancelled", text: "Client cancelled the manpower request for this role." },
  ],
  CLIENT_WITHDREW_SELECTION: [
    { label: "Selection withdrawn", text: "Client withdrew the selection before deployment." },
  ],
  POSITION_FILLED: [
    { label: "Headcount filled", text: "Required headcount for this opening has already been filled." },
  ],
  DECLINED_CONTRACT: [
    { label: "Declined offer terms", text: "Candidate declined the employment contract terms." },
  ],
  MISSED_SIGNING: [
    { label: "Missed signing", text: "Candidate did not attend the scheduled contract signing." },
  ],
  OTHER: DEFAULT_REJECTION_PRESETS,
};

export function getRejectionNotePresets(reasonCode: string): readonly NotePreset[] {
  return CLOSE_REJECTION_PRESETS[reasonCode] ?? DEFAULT_REJECTION_PRESETS;
}

export const CLOSE_BACKOUT_PRESETS: readonly NotePreset[] = [
  { label: "Accepted other offer", text: "Candidate informed TA they accepted another job offer." },
  { label: "Did not show up", text: "Candidate did not attend and did not respond to follow-up." },
  { label: "Personal reasons", text: "Candidate withdrew due to personal or family reasons." },
  { label: "Schedule / commute", text: "Candidate withdrew due to shift schedule or work location." },
];

export const ARCHIVE_REASON_PRESETS: readonly NotePreset[] = [
  { label: "Position filled", text: "Position has already been filled." },
  { label: "Unresponsive", text: "Candidate has been unresponsive to follow-ups." },
  { label: "Withdrew", text: "Candidate withdrew their application." },
];

export const RESTORE_REASON_PRESETS: readonly NotePreset[] = [
  { label: "Reopened / available", text: "Candidate recontacted and confirmed availability for consideration." },
  { label: "New opening match", text: "Restored to active pipeline for an open requisition." },
];

export const DOC_UPDATE_REASON_PRESETS: readonly NotePreset[] = [
  { label: "Current copy expired", text: "Current copy expired. Please upload a renewed document." },
  { label: "Blurry or unreadable copy", text: "Blurry or unreadable copy. Please upload a clearer photo or scan." },
  { label: "Missing back page / signature", text: "Missing back page or signature. Please upload the complete document." },
];

export const SKIP_TO_FINAL_PRESETS: readonly NotePreset[] = [
  { label: "Client waived review", text: "Client waived initial endorsement." },
  { label: "Urgent direct interview", text: "Urgent request — direct to final interview." },
  { label: "Returning worker", text: "Returning worker re-endorsement." },
];

export const DECLINE_RESCHEDULE_PRESETS: readonly NotePreset[] = [
  { label: "Fixed panel schedule", text: "Client panel schedule is fixed." },
  { label: "No remaining slots", text: "No remaining interview slots available." },
  { label: "Urgent start date", text: "Deployment start date is urgent." },
];

export const DEPLOYMENT_NOTE_PRESETS: readonly NotePreset[] = [
  { label: "Report to site supervisor", text: "Report to client site supervisor on shift start." },
  { label: "Confirmed first day", text: "Confirmed first working day and reporting instructions." },
];

export const CLIENT_DECISION_PRESETS = {
  APPROVED: [
    { label: "Approved for final interview", text: "Client approved the candidate for the final interview." },
    { label: "Shortlisted by hiring manager", text: "Shortlisted by client hiring manager after profile review." },
  ],
  DECLINED: [
    { label: "Selected another candidate", text: "Client selected another candidate for this opening." },
    { label: "Did not match criteria", text: "Candidate profile did not match client requirements." },
    { label: "Headcount on hold", text: "Client placed this headcount on hold." },
  ],
} as const satisfies Record<"APPROVED" | "DECLINED", readonly NotePreset[]>;

export const DISMISS_CHECKIN_PRESETS: readonly NotePreset[] = [
  { label: "Left office before turn", text: "Candidate left the office before being called for their turn." },
  { label: "Duplicate check-in", text: "Duplicate walk-in check-in for an active candidate." },
  { label: "Applied online instead", text: "Candidate applied online instead." },
  { label: "Did not meet age or ID requirement", text: "Candidate did not meet the minimum age or valid ID requirement." },
];

export const CONFIRM_START_NOTE_PRESETS: readonly NotePreset[] = [
  { label: "Reported on site", text: "Candidate reported on site for their scheduled start." },
  { label: "Confirmed with site supervisor", text: "Confirmed candidate start with the client site supervisor." },
];

export const AGREEMENT_UPDATE_PRESETS: readonly NotePreset[] = [
  { label: "Extended per client request", text: "Deployment agreement extended per client request." },
  { label: "Updated schedule or site terms", text: "Updated deployment schedule or site terms." },
];
