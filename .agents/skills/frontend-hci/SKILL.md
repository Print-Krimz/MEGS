---
name: frontend-hci
description: Human-Computer Interaction (HCI) UI/UX engineering guidelines for the Recruitment Management System (MEGS). Enforces clarity, simplicity, consistency, anti-AI-slop visual restraint, error prevention, plain language, and a 10-point HCI review checklist.
---

# Human-Computer Interaction (HCI) UI/UX Guidelines

This skill provides authoritative Human-Computer Interaction (HCI) engineering guidelines for designing, building, refactoring, and reviewing frontend user interfaces across the Recruitment Management System (MEGS).

Any agent or developer implementing frontend UI must strictly adhere to these principles.

---

## 1. Core Philosophy: Industrial Usability & Clarity

MEGS is a high-volume operational business/HR platform used daily by recruiters, hiring managers, talent acquisition specialists, and applicants. 

1. **Simplicity Over Cleverness:** Choose the simplest, most understandable layout and interaction model. Never overcomplicate UI components.
2. **Cognitive Load Minimization:** Reduce the mental effort required to complete tasks. Users should focus on evaluating candidates and managing requisitions—not deciphering the interface.
3. **No Gratuitous Redesigns:** Do not redesign screens just to make them look different. Preserve working functionality. Improve the interface **only** when it directly increases **usability, understandability, consistency, accessibility, efficiency, or error prevention**.
4. **The Default Rule:** When uncertain, choose the **simpler and more understandable solution**.

---

## 2. Plain Language & Microcopy (No IT/Technical Jargon)

Interfaces must speak the language of the end user (recruiter, applicant, HR manager), not the software engineer or database architect.

| ❌ Avoid (Technical/Verbose Jargon) | ✅ Use (Clear, Natural User Language) |
|:---|:---|
| `POST /api/v1/mrf mutation failed: 500` | "Unable to submit job requisition. Please try again." |
| `Foreign key constraint violation on candidate_id` | "Candidate record could not be found." |
| `Execute KnnVectorEmbeddingMatch` | "Calculating candidate match score..." |
| `Null boolean flag in compliance_records` | "Compliance documents pending submission." |
| `Click here to initiate the creation of a new job requisition record` | "Create Requisition" |
| `Recruiter override flag toggled to true` | "Manual score applied" |

### Microcopy Rules
- **No Redundant Explanations:** If a button says "Export CSV", do not place a subtitle below it saying *"Click this button to export data to a CSV spreadsheet file."*
- **Action-Oriented Verbs:** Buttons and links must clearly state the outcome (e.g., `Save Changes`, `Approve Requisition`, `Schedule Interview`, `Reject Applicant`).
- **Eliminate Duplicated Labels:** Do not repeat the page title inside cards, section headers, and table headers on the same screen.

---

## 3. Cognitive Ergonomics: Recognition Over Recall

Users should never be required to memorize steps, codes, or backend IDs to complete a task.

1. **Contextual Information:** Always display relevant context alongside IDs (e.g., show `Software Engineer II (MRF-2026-004)` instead of just `004` or a raw UUID).
2. **Predictable Mental Models:** Follow established web patterns. Search bars belong at the top/table header, primary actions at the top-right or bottom-right of forms, destructive actions isolated with warning styles, and filters adjacent to data tables.
3. **Persistent State Clues:** Highlight active filters, current pagination pages, and selected tabs clearly so users instantly know their location in the workflow.

---

## 4. Strict UI Consistency & Interaction Predictability

Maintain visual and behavioral uniformity across the entire application.

- **Terminology Consistency:** Use the exact same term everywhere. Do not call an entity a "Job Request" on one page, an "MRF" on another, and a "Requisition" on a third.
- **Button Placement:**
  - Form dialogs: Secondary / Cancel on the left; Primary action on the right.
  - Destructive actions (e.g., Delete, Reject): Visually separated from primary positive actions, styled in semantic red/destructive tokens.
  - Table row actions: Consistently grouped in the far-right column.
- **Form Controls:** Consistent label positioning (stacked above inputs), standard padding (`h-9` or `h-10` input heights), unified border colors, and identical validation error styling.
- **Feedback & Notifications:** Success, error, and info toasts must appear in the same screen quadrant (e.g., top-right) with identical duration and dismiss behaviors.

---

## 5. Visibility of System Status (Mandatory 4-State UI)

Every screen, async component, and data-bound container must explicitly handle all 4 states:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Component State Matrix                   │
├──────────────┬──────────────────────────────────────────────┤
│ 1. Loading   │ Subdued skeleton loaders matching table/card │
│              │ shapes. Never show blank flashing screens.   │
├──────────────┼──────────────────────────────────────────────┤
│ 2. Error     │ Clear, human-readable error with a distinct  │
│              │ "Retry" button. Never expose raw stacktraces.│
├──────────────┼──────────────────────────────────────────────┤
│ 3. Empty     │ Friendly icon, clear explanation why it's    │
│              │ empty, and a single direct CTA to add data.  │
├──────────────┼──────────────────────────────────────────────┤
│ 4. Success   │ High-density, accessible tabular or card     │
│              │ data with visual hierarchy intact.           │
└──────────────┴──────────────────────────────────────────────┘
```

- **In-Flight Action Indicators:** Buttons executing async mutations must show inline spinners and disabled states (`isPending`) to prevent duplicate submissions.
- **Clear Progress Indicators:** Multi-step workflows (e.g., candidate hiring pipeline stages, MRF approvals) must clearly show completed steps, current step, and upcoming steps.

---

## 6. Error Prevention & Forgiving Design

Preventing errors is vastly superior to displaying good error messages.

1. **Constraint-Driven Inputs:** Use datepickers, numeric inputs with min/max, dropdowns, and searchable comboboxes instead of unconstrained free-text fields where structured data is required.
2. **Smart Defaults & Auto-Fill:** Pre-fill known user data (e.g., logged-in recruiter name, current date, linked MRF department) to reduce manual keystrokes and eliminate typos.
3. **Destructive Confirmation:** Irreversible actions (e.g., deleting records, rejecting an application, withdrawing candidate) must require an explicit confirmation dialog stating the exact consequences.
4. **Safe Inline Validation:** Validate form fields on blur or submit rather than aggressively on every single keystroke before the user finishes typing.
5. **Non-Destructive Navigation:** Warn users when navigating away from forms with unsaved changes.

---

## 7. Anti-AI-Slop & Visual Restraint

Avoid generic, decorative, and overengineered visual noise that degrades operational utility.

```text
❌ BANNED AI-SLOP PATTERNS
├── Multi-colored rainbow gradient borders on everyday form cards
├── Giant decorative hero banners in operational HR dashboards
├── Pointless floating glassmorphism blur orbs and drop shadows
├── Gratuitous staggered entry animations on table rows and buttons
├── Pill badges applied to every single piece of data on a page
├── Meaningless decorative icons next to every single heading and label
└── Oversized typography that forces users to scroll constantly
```

### Visual Restraint Directives
- **Visual Hierarchy:** Only 1 primary action button per visual area. Use secondary (outline) or tertiary (ghost) styling for auxiliary actions.
- **Icon Discipline:**
  - Never use an icon if plain text is clearer.
  - Never use an icon purely for decoration without semantic purpose.
  - Every icon-only button must have an `aria-label` and tooltip.
- **Information Density:** Balance clean whitespace with high information density. Recruiters need to scan 20+ candidate rows efficiently without excessive paging or scrolling.

---

## 8. Efficiency, Progressive Disclosure & Smart Automation

Optimize the UI for daily, repetitive workflows to minimize friction and clicks.

- **Minimize Clicks & Keystrokes:** Common tasks (e.g., advancing a candidate, adding an interview note, filtering by stage) should take no more than 1–2 clicks.
- **Searchable Comboboxes:** For lists longer than 7 items, use searchable comboboxes instead of standard native select dropdowns.
- **Progressive Disclosure:**
  - Keep primary views focused on everyday data.
  - Move advanced settings, raw audit logs, deep metadata, and scoring calculation formulas into collapsible accordions, tabs, slide-out drawers, or detail modals.
- **Automation Over Manual Entry:** Link related records automatically (e.g., selecting an MRF should auto-fill client name, department, salary range, and target date).

---

## 9. Universal Accessibility (a11y) & Responsiveness

Accessibility is a non-negotiable standard.

1. **Color Contrast:** All text must meet WCAG 2.1 AA contrast standards (minimum `4.5:1` for normal text, `3:1` for large text/icons). Never rely on color alone to convey status (always pair color with text/icons).
2. **Keyboard Navigability:** All interactive controls (buttons, links, inputs, dialogs, dropdowns) must be reachable and operable via `Tab`, `Enter`, `Space`, and arrow keys.
3. **Focus Rings:** Ensure visible focus indicators (`focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-500`). Never remove focus rings without an accessible replacement.
4. **Form Association:** Every input must have an associated `<label htmlFor={id}>`. Errors must link via `aria-describedby` and set `aria-invalid="true"`.
5. **Responsive Layouts:**
   - **Desktop (>= 1024px):** Full multi-column tables, side-by-side split panes, multi-pane candidate evaluation.
   - **Tablet (768px - 1023px):** Collapsible sidebars, adaptive table scrolling, optimized modal widths.
   - **Mobile (< 768px):** Stacked layouts, responsive card representations for tables, touch-friendly tap targets (minimum `44x44px`).

---

## 10. The 10-Point HCI Review Checklist

Before implementing, submitting, or approving any frontend UI changes, evaluate the interface against these 10 questions:

```text
┌── 10-POINT HCI EVALUATION CHECKLIST ───────────────────────────────────────┐
│                                                                            │
│  1. [ ] Understandability: Can a first-time user understand this screen    │
│         without an explanation or manual?                                  │
│  2. [ ] Zero Duplication: Is any text, button, action, or data label       │
│         redundantly repeated?                                              │
│  3. [ ] Plain Language: Is any wording unnecessarily technical, verbose,  │
│         or engineering-centric?                                            │
│  4. [ ] Smart Automation: Can any manual input or repetitive click be      │
│         safely automated or auto-filled?                                   │
│  5. [ ] Consistency: Is the same concept, entity, or action named and      │
│         styled identically across the app?                                 │
│  6. [ ] Anti-Slop: Are there unnecessary decorative icons, gradients,      │
│         excessive badges, or visual clutter?                               │
│  7. [ ] Next-Step Clarity: Does the interface clearly guide the user on    │
│         what to do next?                                                   │
│  8. [ ] Error Recovery: Can the user easily cancel, undo, or recover from  │
│         mistakes without data loss?                                        │
│  9. [ ] Task-Based Hierarchy: Is visual prominence given to what the user   │
│         actually needs rather than secondary info?                         │
│ 10. [ ] Purpose-Built Design: Does the UI look intentionally crafted for   │
│         an HR/recruitment platform rather than generic AI slop?            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```
