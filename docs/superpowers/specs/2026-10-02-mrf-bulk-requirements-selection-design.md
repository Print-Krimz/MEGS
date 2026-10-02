# Design: MRF Multi-Select Requirement Checkboxes

## 1. Overview
Recruiters currently add document requirements to a Manpower Request one item at a time through a combobox. This process requires reopening the modal and searching repeatedly for each document.

This change replaces the single-select combobox with categorized multi-select checkboxes, quick bundle toggles, custom document entry, and a bulk backend endpoint.

## 2. Terminology and Microcopy
- Replace the technical label "Statutory" with plain language: "Government Documents".
- Category groups:
  1. **Government Documents**: SSS Static / E-1 Form, PhilHealth Member Data Record (MDR), Pag-IBIG Member ID Form, BIR Form 1902 / 2316, NBI Clearance, Police Clearance, Barangay Clearance.
  2. **Medical Clearances**: 5-Panel Drug Test Certificate, Fit-to-Work Medical Certificate.
  3. **Education & Credentials**: College / High School Diploma, Transcript of Records (TOR), Certificate of Employment (COE), Driver's License (Professional), PRC Board License, TESDA NC II Certificate.

## 3. UI and Interaction Design
- **Dialog header**:
  - Title: "Add requirements"
  - Subtitle: "Select documents candidates must submit for this request."
- **Preset sections**:
  - Render presets grouped by category.
  - Display a "Select all" / "Deselect all" toggle for each category group.
  - Disable any preset already present on the Manpower Request with an `(Already added)` label.
- **Custom requirement entry**:
  - Text input below preset groups: "Custom requirement name (optional)".
  - "Add" button and Enter key support to append custom labels into the selection set.
  - Prevent duplicate custom entries.
- **Dialog footer**:
  - "Cancel" button: resets selection and closes dialog.
  - Primary button: "Add [N] requirements" (disabled when N = 0, displays spinner when mutation is pending).

## 4. API and Data Model
- **Route**: `POST /api/v1/ta/mrfs/:id/compliance-templates/bulk`
- **Controller**: `addMRFComplianceTemplatesBulkHandler` in `backend/src/controllers/ta/ta.mrf.controller.ts`
- **Validation**: `createComplianceTemplatesBulk` in `backend/src/schemas/ta.schema.ts`
  - Validates `id` parameter.
  - Validates `body.documentLabels` as a non-empty array of bounded strings (1 to 50 items).
- **Service**: `addMRFComplianceTemplatesBulk` in `backend/src/services/ta/ta.mrf.service.ts`
  - Confirms MRF existence.
  - Reads existing templates for the MRF to skip duplicates case-insensitively.
  - Executes `prisma.mRFComplianceTemplate.createMany` for new labels with `isRequired: true`.
  - Returns created records count and records list.
- **Frontend client**: `taApi.addMRFComplianceTemplatesBulk(mrfId, documentLabels)` in `frontend/src/lib/api/ta.api.ts`.

## 5. Error Prevention and Edge Cases
- Recruiter cannot submit with zero items selected.
- Existing items cannot be selected again.
- Custom requirement input trims whitespace and rejects blank submissions.
- Submissions retain dialog state if the network fails so recruiters do not lose selections.

## 6. Verification Plan
1. Run `npx tsc --noEmit` in `backend/` and `frontend/`.
2. Open MRF detail page in browser.
3. Open "Add requirements" dialog.
4. Click "Select all" under Government Documents; confirm all 7 toggle together.
5. Verify existing items display as disabled.
6. Add a custom requirement and verify it appears in the selected list.
7. Click "Add [N] requirements" and confirm the list updates immediately with all selected documents.
