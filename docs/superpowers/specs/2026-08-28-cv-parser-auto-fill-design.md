# Design Specification: CV Parser & Profile Auto-Fill

**Date:** 2026-08-28  
**Feature:** Auto-Extracting Applicant Profile from Uploaded Resume (Opportunity 1)  
**Status:** Approved for Implementation Planning  
**Target Users:** Job Applicants, Talent Acquisition Specialists  

---

## 1. Overview & Problem Statement

Currently, when an applicant registers and builds their profile in `ProfilePage.tsx`, they must manually type 24 individual personal fields, repeatedly open modal dialogs to input past work experience and education history, and add skills one by one. This manual repetition leads to high applicant drop-off.

Since applicants already possess a resume document (PDF), this feature introduces an **"Auto-Fill from Resume"** assisted automation. Applicants upload their resume once; the server extracts structured profile data via Google Gemini Flash (`@google/genai`) and populates the form for applicant review and confirmation.

---

## 2. Architecture & Data Flow

```
[Applicant: ProfilePage]
       │
       │ 1. Click "Auto-Fill from Resume" & select PDF
       │ 2. POST /api/applicant/profile/auto-fill-resume (multipart/form-data)
       ▼
[Backend: Applicant Router & Controller]
       │
       ├── 3. Upload resume to Supabase Storage ('applicant-assets')
       ├── 4. Set ApplicantProfile.resumeUrl to stored URL
       ├── 5. Extract raw text from PDF buffer using pdf-parse
       ├── 6. Pass text to Gemini Flash (extractProfileFromResumeText)
       │      with strict structured JSON schema
       └── 7. Return { resumeUrl, parsedData } to Client
       │
       ▼
[Applicant Frontend]
       │ 8. Merge parsed personal fields into active form state (formData)
       │ 9. Smart-merge extracted skills into unique tag list
       │ 10. Append extracted work experiences and educations
       │ 11. Display banner prompting user to review and click "Save Changes"
       ▼
[Applicant: Review & Save]
       │ 12. Applicant inspects fields, makes adjustments, and clicks "Save Changes"
       ▼
[Database Commits]
```

---

## 3. Detailed Component Specifications

### 3.1 Backend Gemini Extraction Service (`backend/src/utils/gemini.ts`)

Introduce `extractProfileFromResumeText(resumeText: string): Promise<ParsedResumeProfile>`.

#### Structured Output Schema:
```typescript
export interface ParsedResumeProfile {
  personal: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    mobileNumber?: string;
    professionalSummary?: string;
    province?: string;
    city?: string;
    address?: string;
    gender?: string;
    civilStatus?: string;
    nationality?: string;
    dateOfBirth?: string; // YYYY-MM-DD
  };
  workExperiences: Array<{
    company: string;
    title: string;
    startDate: string;   // YYYY-MM-DD or YYYY-MM
    endDate?: string | null;
    isCurrent?: boolean;
    summary?: string;
  }>;
  educations: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    gradYear?: number;
    startDate?: string;
    endDate?: string;
  }>;
  skills: string[];
}
```

#### Extraction Rules & Normalization:
- **Date Formatting:** Dates are parsed and standardized to `YYYY-MM-DD` or `YYYY-MM`.
- **Philippine Phone Numbers:** Standardized to Philippine mobile format (`+63 9...` or `09...`).
- **Degree Names:** Normalized to standard options (*High School, Vocational, Associate's, Bachelor's, Master's, Doctorate*).
- **Bullet Points:** Cleanly joined into coherent paragraphs for `summary`.

---

### 3.2 Backend Endpoint & Controller (`backend/src/controllers/applicant/applicant.controller.ts`)

- **Route:** `POST /api/applicant/profile/auto-fill-resume`
- **Auth:** `authenticateJWT`, `requireRole("APPLICANT")`
- **File Validation:** PDF, max 10MB.
- **Workflow:**
  1. Validate uploaded file presence.
  2. Upload file to Supabase bucket `applicant-assets`.
  3. Extract text buffer via `pdf-parse`. Validate minimum text length (>= 50 chars).
  4. Call `extractProfileFromResumeText(text)`.
  5. Update `ApplicantProfile.resumeUrl` in database.
  6. Return `200 OK` with `{ status: "success", data: { resumeUrl, parsedData } }`.

---

### 3.3 Frontend Client Integration (`frontend/src/pages/applicant/ProfilePage.tsx`)

1. **Header Action:**
   - Add `"Auto-Fill from Resume"` button with `Upload` / `Sparkles` icon next to the primary action buttons in the profile header.
   - Hidden `<input type="file" accept=".pdf" />` triggered on button click.

2. **Loading Feedback:**
   - Disable button and display loading spinner: *"Parsing resume with AI..."*.

3. **State Integration:**
   - **Personal Info:** Fill empty or updated form fields in `formData` state.
   - **Skills:** Merge parsed skills with existing skills avoiding duplicates:
     ```typescript
     setSkills(prev => Array.from(new Set([...prev, ...parsedSkills])));
     ```
   - **Experiences & Educations:** Append parsed entries to draft lists for one-click review/editing.
   - **Banner Feedback:** Show an informative alert banner at the top informing the applicant that fields were populated from their resume and need their final confirmation.

---

## 4. Edge Cases, Security & Validation

1. **Unparseable / Image-Only PDFs:**
   - If `pdf-parse` yields `< 50` characters of extractable text, return a descriptive error:
     *"The uploaded PDF contains no extractable text (it may be a scanned image). Please enter your details manually or upload a text-based PDF."*
2. **Malformed AI JSON Output:**
   - Fallback to safe parsing with structured defaults; never crash the server.
3. **Data Protection & Privacy:**
   - Files are stored in applicant-isolated paths within Supabase storage with private bucket ACLs.
   - Only the authenticated applicant (`req.user.id`) can trigger auto-fill on their profile.
4. **Draft Safety (Human-in-the-loop):**
   - The extraction does not blindly overwrite database records for experiences and education; the applicant reviews the form fields on screen before clicking "Save Changes".

---

## 5. Testing & Verification Plan

1. **Unit / Integration Tests:**
   - Test PDF text extraction with standard sample resumes.
   - Test Gemini schema adherence and date normalization.
   - Test `POST /api/applicant/profile/auto-fill-resume` endpoint permissions and file upload validations.
2. **Frontend End-to-End Verification:**
   - Upload sample resume on `ProfilePage.tsx`.
   - Verify all 4 tabs (Personal, Experience, Education, Skills) are populated correctly.
   - Verify skill de-duplication.
   - Click "Save Changes" and verify persistence across page reloads.
