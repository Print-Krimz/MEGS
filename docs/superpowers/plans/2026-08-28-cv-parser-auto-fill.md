# CV Parser & Profile Auto-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an assisted automation ("Auto-Fill from Resume") on the Applicant Profile page that extracts personal info, work experience, education, and skills from an uploaded PDF CV using Google Gemini Flash, automatically populating the form for applicant review and confirmation.

**Architecture:** A single multipart upload endpoint receives the PDF, stores it to Supabase Storage, extracts raw text via `pdf-parse`, parses structured JSON via Gemini Flash (`@google/genai`), and returns the payload to React, which updates draft state and stages items into the active form for final applicant review.

**Tech Stack:** Express 5, TypeScript, `@google/genai` (Gemini Flash), `pdf-parse`, React 19, Vite, TanStack Query, Tailwind CSS v4, Lucide Icons.

## Global Constraints
- Only authenticated applicants can trigger auto-fill on their profile (`authenticateJWT`, `requireRole("APPLICANT")`).
- PDF file size must not exceed 10MB.
- Scanned/empty PDFs (<50 characters text) must return an actionable, friendly error.
- All candidate data remains in draft state until the user clicks "Save Changes" (with the exception of the uploaded resume URL which is attached to their profile assets).
- Maintain existing HCI standards: industrial utilitarian styling, plain language, and clear loading/error feedback.

---

### Task 1: Gemini Resume Profile Extraction Utility

**Files:**
- Modify: `backend/src/utils/gemini.ts`
- Test: `backend/tests/unit/gemini-cv-parser.test.ts`

**Interfaces:**
- Produces:
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
      dateOfBirth?: string;
    };
    workExperiences: Array<{
      company: string;
      title: string;
      startDate: string;
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

  export const extractProfileFromResumeText = async (resumeText: string): Promise<ParsedResumeProfile>;
  ```

- [ ] **Step 1: Write unit test for CV parsing function**
  Create `backend/tests/unit/gemini-cv-parser.test.ts` testing extraction output structure with a mock or live sample text.

- [ ] **Step 2: Run test to verify it fails (missing implementation)**
  Run `npm test backend/tests/unit/gemini-cv-parser.test.ts`.

- [ ] **Step 3: Implement `extractProfileFromResumeText` in `backend/src/utils/gemini.ts`**
  Add prompt instructing Gemini Flash to extract normalized personal details, experiences, educations, and skills with `responseMimeType: "application/json"`.

- [ ] **Step 4: Run test to verify it passes**
  Run `npm test backend/tests/unit/gemini-cv-parser.test.ts`.

---

### Task 2: Backend Controller, Service & Route

**Files:**
- Modify: `backend/src/services/applicant/applicant.service.ts`
- Modify: `backend/src/controllers/applicant/applicant.controller.ts`
- Modify: `backend/src/routes/applicant/applicant.routes.ts`

**Interfaces:**
- Produces: `POST /api/applicant/profile/auto-fill-resume` endpoint.
- Consumes: `extractProfileFromResumeText` from Task 1, `uploadFileToSupabase` from upload middleware, and `pdfParse`.

- [ ] **Step 1: Implement `autoFillFromResumeService` in `applicant.service.ts`**
  Handle PDF text parsing with `pdf-parse`, minimum text length validation (>= 50 chars), Gemini extraction call, and saving the resume URL in database.

- [ ] **Step 2: Implement `autoFillFromResume` controller in `applicant.controller.ts`**
  Validate file presence and handle error responses.

- [ ] **Step 3: Register route in `applicant.routes.ts`**
  Wire `router.post("/profile/auto-fill-resume", upload.single("file"), autoFillFromResume)`.

- [ ] **Step 4: Test endpoint with an API request**
  Verify with a mock PDF upload that the response returns `{ resumeUrl, parsedData }`.

---

### Task 3: Frontend API Client & ProfilePage Integration

**Files:**
- Modify: `frontend/src/lib/api/applicant.api.ts`
- Modify: `frontend/src/pages/applicant/ProfilePage.tsx`

**Interfaces:**
- Produces: `applicantApi.autoFillFromResume(file: File)` and UI button in `ProfilePage.tsx`.

- [ ] **Step 1: Add API client method in `applicant.api.ts`**
  Add `autoFillFromResume: async (file: File) => { ... }` sending `FormData`.

- [ ] **Step 2: Add "Auto-Fill from Resume" button and hidden file input in `ProfilePage.tsx`**
  Add button in the profile header with `Upload` / `Sparkles` icon and disabled/loading state.

- [ ] **Step 3: Implement response handler to populate form state**
  - Populate personal info fields in `formData`.
  - Smart-merge parsed skills with existing skills (`Array.from(new Set([...prev, ...skills]))`).
  - Stage extracted work experiences and educations.
  - Show notification toast and review banner: *"Profile details extracted. Review and click 'Save Changes' to apply."*

---

### Task 4: Verification & 10-Point HCI Review

**Files:**
- Check: `frontend/src/pages/applicant/ProfilePage.tsx`
- Check: `backend/src/services/applicant/applicant.service.ts`

- [ ] **Step 1: TypeScript compilation check**
  Run `npx tsc --noEmit` in `backend` and `frontend`.

- [ ] **Step 2: Manual End-to-End Verification**
  Upload sample PDF CV, verify all fields populate cleanly, adjust a field, and save changes. Verify persistent database save.

- [ ] **Step 3: 10-Point HCI Review**
  Ensure plain language, error boundaries, accessible keyboard navigation, and no UI slop or excessive badges.
