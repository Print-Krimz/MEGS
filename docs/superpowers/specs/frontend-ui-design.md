# MEGS Frontend UI Design Specification: Industrial Utilitarian

**Goal:** Transform the current UI from a generic, AI-generated "SaaS Bento-grid" design into a professional, credible, high-density **Industrial Utilitarian** recruitment platform.

## 1. Core Design Philosophy

*   **Information Density Over Whitespace:** Operational tools require seeing maximum relevant data at a glance. We will reduce padding, utilize compact typography, and remove oversized decorative containers.
*   **Structural Borders Over Shadows:** Drop shadows (`shadow-sm`, `shadow-card`, etc.) are banned. Separation of elements will be achieved through crisp, 1px solid borders and subtle background color contrasts (e.g., white vs. `slate-50`).
*   **Sharp Geometry:** Rounded corners (`rounded-lg`, `rounded-xl`, pill-shaped badges) are banned. All elements (buttons, inputs, containers, badges) will use square corners (`rounded-none`) or extremely minimal rounding (`rounded-sm` max) to convey clinical precision.
*   **No Decorative Fluff:** Zero gradients, zero glassmorphism, zero floating blobs, zero "bento-box" style dashboards that emphasize layout aesthetics over data accessibility.

## 2. Global Token Updates (`index.css`)

*   **Radius:** `--radius-sm`, `--radius-md`, `--radius-lg` will all be set to `0` (or max `2px` for focus rings).
*   **Shadows:** `--shadow-sm`, `--shadow-card`, `--shadow-dropdown`, `--shadow-modal` will be replaced with hard borders (`border border-slate-300`).
*   **Typography:** Base text size reduced slightly for data tables. Universal use of `tabular-nums` for metrics, dates, and scores.

## 3. Layout Restructuring

### 3.1. Dashboards (TA / Admin)
*   **Current State:** 4x4 Grid of isolated white cards floating on a gray background (Bento grid).
*   **Target State:** Full-bleed master-detail panels. A unified grid view where metrics are arranged in a tight top-bar ribbon, and the primary focus is a large, high-density data table or list.

### 3.2. Forms & Dossiers
*   **Current State:** Centered, floating cards.
*   **Target State:** Left-aligned or multi-column structural forms that stretch across the available container, using fieldsets with distinct borders.

## 4. Component Primitives

*   **Buttons:** Square corners. Solid backgrounds for primary actions, sharp 1px borders for secondary actions. Hover states should be a clear, instant color shift—no slow animations.
*   **Status Badges:** Square, high-contrast, uppercase. E.g., `[ SUBMITTED ]` in a sharp box rather than a rounded pill.
*   **Tables:** Striped rows (`even:bg-slate-50`), compact cell padding (`px-3 py-2`), distinct header borders.
*   **Loading States:** Fast, utilitarian progress bars or skeletal rows. No bouncing dots or playful spinners.

## 5. Color Palette Refinements

*   Maintain the core `teal` (primary) and `slate` (neutrals), but deepen the contrast.
*   **Background:** True white (`#ffffff`) for main content areas, with `slate-100` (`#f1f5f9`) for navigation and sidebars.
*   **Borders:** `slate-300` for structural separation, `slate-400` for input borders.
*   **Text:** `slate-900` for primary data, `slate-600` for labels. No light gray text that fails WCAG contrast.
