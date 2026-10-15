# Design system: MEGS public and auth surfaces

Scope: landing page, login, register, OTP, forgot password, MFA modals. Applicant, TA and Admin portals keep their navy dashboard theme. Tokens live in `frontend/src/index.css`; the red/blue world is scoped by the `.theme-megs` class (landing root, `AuthLayout` root, and portaled `Dialog`/`Sheet` content).

## Color
- **Red** `#C8102E` (`primary`, hover `#A30D25`): identity and the single primary action per viewport. Never a large fill.
- **Navy** `#0B2F5B` (`secondary`), `#081D38` (`megs-navy-900`): headings, outline buttons, the dark contact/footer band, the auth brand panel.
- **Blue** `#1A55C4` (`accent`, `ring`): links, focus ring, informational state.
- **Neutrals**: page `#F6F7F9`, surface `#FFFFFF`, muted `#F1F3F6`, border `#DDE2E9`, control border `#8793A3`, text `#0F1B2D`, muted text `#4B5A6E`.
- **Feedback**: destructive `#B42318` (always with icon and text), success `#047857`, warning `#B45309`.

## Type
Archivo Variable, self-hosted via `@fontsource-variable/archivo/wdth.css`. `.font-display` = width 112%, weight 800, tracking -0.02em for headings. Body and UI use the normal width. Sentence-case headings; no tracked all-caps eyebrows.

## Components
shadcn/ui (Radix, `new-york` style) in `src/components/shadcn`, restyled to semantic tokens: Button (default red, secondary navy, outline navy, ghost, link; `h-11` default, `h-12` lg), Input (`h-11`), InputGroup, Field, InputOTP (6 slots), Dialog (scrolls inside the viewport), Sheet, Tabs, Checkbox, Alert, Spinner, Separator. No shadows except overlays (the app theme sets `--shadow-xs: none`, so never put `shadow-xs` on a control or it cancels the focus ring). Disabled primary buttons turn neutral grey (`bg-border`, muted text), never washed-out red. Focus rings are a full-strength 2px blue. Toasts (shared Sonner component) use Archivo, sentence case and rounded corners; errors already shown inline are not toasted. Radius `rounded-md` for controls, `rounded-lg` for panels.
Shared auth pieces in `src/components/auth`: `AuthTextField`, `AuthPasswordField` (strength meter appears once typing starts), `OtpCodeField`, `AuthHeading`, `AuthError`, `AuthStep`, `AuthStepper`. Shared landing pieces in `src/components/public`: `SectionHeader`, `motion.tsx` (`MotionRoot`, `Reveal`).

## Layout
Landing: light hero with an audience switch (Find a job / Hire workers) and a four-industry photo mosaic (warehousing, gaming, retail, hospitality) over a credentials plate, so no single sector is implied; then jobs, employers, industries, about, branches, and a navy contact close. Each section heading carries a short red rule. Only one red action per viewport: the header Create account is navy, the hero Search Jobs is red. Auth: split layout from `md` up (navy brand panel with a 4px red top edge, logo, one headline and three reassurance points, no imagery, so the form stays the focus; form column), compact top bar with the logo below `md`, no floating card. Skip-to-content links on landing and auth. A help link to the contact section shows on sign-in and password-reset screens only.

## Motion
`motion/react` through `LazyMotion` + `m.*`, `MotionConfig reducedMotion="user"`. Landing: hero rise (350ms, staggered), one-shot section reveal (12px, 250ms), sliding indicator on nav and hero tabs. Auth: 160ms step cross-fade, 180ms error height. No looping, parallax or scroll-jacking.

## Do / Don't
- Do pair every error with an icon and text; keep one red action per viewport; keep focus rings blue.
- Don't use raw hex or palette classes in these surfaces; don't add gradients, glass, or icon-tile card grids.
