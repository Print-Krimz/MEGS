# MRF Multi-Select Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow recruiters to select multiple document requirements via categorized checkboxes and add custom items in one batch submission to a Manpower Request.

**Architecture:** Add a bulk backend route in Express and Prisma to insert multiple compliance templates in one transaction. Update the frontend API client and rewrite the MRF detail page dialog from a single-item combobox to categorized checkbox groups with quick toggles and custom requirement tags.

**Tech Stack:** Express 5, TypeScript, Prisma 7, React 19, Vite, TanStack Query, Tailwind CSS v4, Lucide React.

## Global Constraints
- Plain language only: replace "Statutory" with "Government Documents".
- Strictly avoid AI writing artifacts and gratuitous UI decoration. Follow `.agents/skills/frontend-hci/SKILL.md`.
- No em dashes anywhere in code, comments, or UI microcopy.
- Existing requirements already assigned to an MRF must appear disabled with an `(Already added)` label.
- Zero type errors on `npx tsc --noEmit` in both `backend` and `frontend`.

---

### Task 1: Backend Bulk Compliance Template API

**Files:**
- Modify: `backend/src/schemas/ta.schema.ts`
- Modify: `backend/src/services/ta/ta.mrf.service.ts`
- Modify: `backend/src/controllers/ta/ta.mrf.controller.ts`
- Modify: `backend/src/routes/ta/ta.routes.ts`

**Interfaces:**
- Consumes: Prisma client `prisma.manpowerRequest` and `prisma.mRFComplianceTemplate`.
- Produces: `POST /api/v1/ta/mrfs/:id/compliance-templates/bulk` endpoint accepting `{ documentLabels: string[] }`.

- [ ] **Step 1: Add validation schema in `backend/src/schemas/ta.schema.ts`**
Add `createComplianceTemplatesBulk` schema validating `id` parameter and `body.documentLabels` as a string array between 1 and 50 items.

```typescript
createComplianceTemplatesBulk: z.object({
  params: z.object({ id: boundedIdText }),
  body: z.object({
    documentLabels: z
      .array(requiredText("Document label", FIELD_LIMITS.label))
      .min(1, "At least one document label is required")
      .max(50, "Cannot add more than 50 requirements at once"),
    isRequired: z.boolean().optional(),
  }),
}),
```

- [ ] **Step 2: Add bulk service method in `backend/src/services/ta/ta.mrf.service.ts`**
Add `addMRFComplianceTemplatesBulk`:
- Find the Manpower Request by `id`. If missing, throw Error("Manpower Request not found").
- Find existing compliance templates for `mrfId`.
- Extract existing lowercase labels into a Set.
- Filter out duplicate labels from input.
- If no unique labels remain, return empty array with zero count.
- Run `prisma.mRFComplianceTemplate.createMany` with `{ mrfId, documentLabel, isRequired }`.
- Fetch and return newly created templates.

- [ ] **Step 3: Add controller handler in `backend/src/controllers/ta/ta.mrf.controller.ts`**
Add `addMRFComplianceTemplatesBulkHandler`:
- Parse `mrfId` from `req.params.id`.
- Extract `documentLabels` and optional `isRequired` from `req.body`.
- Invoke service method.
- Return success response with 201 status code.

- [ ] **Step 4: Register route in `backend/src/routes/ta/ta.routes.ts`**
Mount `router.post("/mrfs/:id/compliance-templates/bulk", validate(taSchema.createComplianceTemplatesBulk), addMRFComplianceTemplatesBulkHandler);` above the parameterized `:templateId` delete route.

- [ ] **Step 5: Verify backend TypeScript compilation**
Run `npx tsc --noEmit` in `backend/` and verify clean output.

- [ ] **Step 6: Commit backend changes**
```bash
git add backend/src/schemas/ta.schema.ts backend/src/services/ta/ta.mrf.service.ts backend/src/controllers/ta/ta.mrf.controller.ts backend/src/routes/ta/ta.routes.ts
git commit -m "feat(ta): add bulk MRF compliance templates endpoint"
```

---

### Task 2: Frontend API Client and Requirement Preset Grouping

**Files:**
- Modify: `frontend/src/lib/api/ta.api.ts`
- Modify: `frontend/src/lib/hr-constants.ts`

**Interfaces:**
- Consumes: Backend route `POST /api/v1/ta/mrfs/:id/compliance-templates/bulk`.
- Produces: `taApi.addMRFComplianceTemplatesBulk(mrfId, documentLabels)` and categorized preset helpers in `hr-constants.ts`.

- [ ] **Step 1: Add bulk API method in `frontend/src/lib/api/ta.api.ts`**
```typescript
addMRFComplianceTemplatesBulk: (
  mrfId: number | string,
  data: { documentLabels: string[]; isRequired?: boolean }
) =>
  post<any>(`/api/v1/ta/mrfs/${mrfId}/compliance-templates/bulk`, data),
```

- [ ] **Step 2: Add requirement categories helper in `frontend/src/lib/hr-constants.ts`**
Export a structured grouping helper with plain language:
```typescript
export interface RequirementCategoryGroup {
  id: string;
  title: string;
  items: CompliancePreset[];
}

export const REQUIREMENT_GROUPS: RequirementCategoryGroup[] = [
  {
    id: "government",
    title: "Government Documents",
    items: COMPLIANCE_201_PRESETS.filter(
      (p) => p.category === "STATUTORY" || p.category === "LEGAL"
    ),
  },
  {
    id: "medical",
    title: "Medical Clearances",
    items: COMPLIANCE_201_PRESETS.filter((p) => p.category === "MEDICAL"),
  },
  {
    id: "credentials",
    title: "Education & Credentials",
    items: COMPLIANCE_201_PRESETS.filter(
      (p) => p.category === "ACADEMIC" || p.category === "EMPLOYMENT"
    ),
  },
];
```

- [ ] **Step 3: Verify frontend TypeScript compilation**
Run `npx tsc --noEmit` in `frontend/` and verify clean output.

- [ ] **Step 4: Commit frontend API and constant changes**
```bash
git add frontend/src/lib/api/ta.api.ts frontend/src/lib/hr-constants.ts
git commit -m "feat(ta): add frontend bulk templates API and categorized preset groups"
```

---

### Task 3: Multi-Select Requirement Dialog in MRFDetailPage

**Files:**
- Modify: `frontend/src/pages/ta/MRFDetailPage.tsx`

**Interfaces:**
- Consumes: `taApi.addMRFComplianceTemplatesBulk`, `REQUIREMENT_GROUPS`, `templates` from `mrfQuery.data`.
- Produces: Multi-select checkbox dialog for MRF document requirements.

- [ ] **Step 1: Update component state and mutation in `MRFDetailPage.tsx`**
Replace single-template string state with:
- `selectedReqs: string[]` (array of selected document labels)
- `customReqText: string` (input text for adding custom requirement)
- Replace `addTemplateMutation` with `addTemplatesBulkMutation` calling `taApi.addMRFComplianceTemplatesBulk(mrfId, { documentLabels: selectedReqs, isRequired: true })`.
- Invalidate `["ta", "mrf", mrfId]` on success, close dialog, and clear selection.

- [ ] **Step 2: Implement selection toggling logic**
- Toggle individual item in/out of `selectedReqs`.
- Toggle whole group: if all non-disabled group items are checked, deselect them; otherwise add all unchecked non-disabled items to `selectedReqs`.
- Add custom item: trim text, check if already in existing templates or `selectedReqs`, append to `selectedReqs`, clear custom text.
- Remove custom item tag from `selectedReqs`.

- [ ] **Step 3: Replace dialog UI in `MRFDetailPage.tsx`**
Replace the combobox dialog with:
- Dialog title: "Add requirements"
- Dialog description: "Select documents candidates must submit for this request."
- Scrollable content area:
  - Loop over `REQUIREMENT_GROUPS`.
  - Group title with item count and "Select all" / "Deselect all" button.
  - Checkbox items showing document label and description. If already present in `templates`, render checked and disabled with `(Already added)`.
  - Custom requirement section with text input and "+ Add" button.
  - Tag chips for custom-added items with an "x" remove button.
- Footer:
  - Cancel button: resets `selectedReqs` and `customReqText`, closes dialog.
  - Primary button: "Add [N] requirements" (or "Add requirement" when N=1). Disabled when `selectedReqs.length === 0`. Displays spinner during mutation.

- [ ] **Step 4: Verify frontend TypeScript compilation**
Run `npx tsc --noEmit` in `frontend/` and verify clean output.

- [ ] **Step 5: Commit UI changes**
```bash
git add frontend/src/pages/ta/MRFDetailPage.tsx
git commit -m "feat(ta): replace MRF requirement combobox with multi-select checkboxes"
```

---

### Task 4: End-to-End Type Check and HCI Usability Verification

**Files:**
- Verify: `backend/` and `frontend/`

- [ ] **Step 1: Run backend and frontend type checks**
Execute `npx tsc --noEmit` in `backend/` and `frontend/`. Confirm 0 errors.

- [ ] **Step 2: Audit against 10-point HCI Checklist**
1. Understandability: Labels are clear and plain language.
2. Zero duplication: No repeated titles or duplicate requirements.
3. Plain language: "Statutory" replaced with "Government Documents".
4. Smart automation: Group "Select all" shortcuts reduce 10 clicks to 1.
5. Consistency: Buttons, checkboxes, and dialogs match MEGS design system.
6. Anti-slop: No decorative gradients or AI slop icons.
7. Next-step clarity: Action button states exact number of items to add.
8. Error recovery: Selections can be toggled off; Cancel discards safely.
9. Task hierarchy: Standard documents first, custom documents optional.
10. Purpose-built: Built specifically for Philippine HR recruitment compliance.

- [ ] **Step 3: Commit and summarize implementation**
```bash
git status
```
