# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Applicants** (Filipino jobseekers, often on mobile): search open roles, register, verify by email OTP, track applications.
- **Employers / client companies**: Philippine corporations that outsource manpower and want a service proposal or the company profile.
- **MEGS staff** (Talent Acquisition, Administrators): sign in with optional or required multi-factor authentication to run recruitment and deployment.

## Product Purpose

MEGS (MAR Employment for Good Services Inc.) is a DOLE-licensed Philippine manpower and recruitment agency, operating since May 1997. This web app is its public presence and its recruitment platform: job listings, candidate accounts, and staff portals. The public site must establish credibility, route applicants to open roles, and route employers to a proposal request.

## Positioning

PJAR Group company, PALSCON member, DOLE D.O. 40, S.2003 compliant contractor with six branches across Luzon, Visayas and Mindanao. Tagline: "Better People for Better Results."

## Capabilities and Constraints

- Frontend: React 19, Vite, TanStack Router, Tailwind v4, zod. Auth is a REST backend with Cloudflare Turnstile, email OTP and TOTP MFA modals. None of that changes.
- The applicant, TA and Admin portals keep their existing navy theme. The red/blue theme is scoped to the landing page and auth surfaces.
- Facts that must not be invented or dropped: 1997 founding, 6 branches, DOLE D.O. 40, PALSCON, PJAR, ₱100,000 accident insurance and ₱10,000 support figures, the three values (Integrity, Loyalty, Respect), branch addresses and contacts already in the code.

## Brand Commitments

Client-specified: red is the primary brand color, blue is the complement. Red must not dominate. Logo is the MEGS seal (`frontend/public/images/canva-ref/megs-seal.jpg`). Name format: "MEGS Inc." / "MAR Employment for Good Services Inc."

## Evidence on Hand

Real industry photographs (`public/images/canva-ref/industries/`), PJAR and PALSCON logos, the Philippines map image, branch data in `LandingBranches`. No testimonials or client logos exist; none may be fabricated.

## Product Principles

1. Credibility first: show licensing, affiliations and coverage plainly.
2. Two audiences, one clear action each: find a job, or request a proposal.
3. Authentication is calm and unambiguous: say what is needed, what went wrong, and what happens next.
4. Red marks identity and the primary action. Navy structures. Blue guides focus and links.

## Accessibility & Inclusion

WCAG AA contrast, visible focus, labelled fields, 44px touch targets, reduced-motion respected. Plain English with natural Filipino-business register.
