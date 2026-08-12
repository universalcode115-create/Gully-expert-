# GullyExpert Project TODO

- [x] Define database schema for users, service partners, services, bookings/job posts, and reviews
- [x] Implement backend tRPC routers for marketplace operations (providers, bookings, reviews, partner dashboard)
- [x] Implement role selection and partner onboarding during first-time login
- [x] Build public landing page with hero, service categories, and how-it-works
- [x] Build service provider discovery & filtering by category and location/proximity
- [x] Build detailed provider profile page (photo, verified badge, ratings, experience, base price, past work photos, contact buttons)
- [x] Build job posting system for customers
- [x] Build partner dashboard with online/offline toggle, incoming jobs, and management tools
- [x] Build ratings and reviews submission system
- [x] Add unit tests and verify all flows end-to-end

- [x] Add a services table/catalog and connect service IDs to partner profiles and job posts
- [x] Implement true latitude/longitude proximity filtering and distance sorting with a text-search fallback
- [x] Create a dedicated provider profile route and replace placeholder contact actions with phone/WhatsApp/request links
- [x] Add customer completion controls and completed-job review submission with backend eligibility checks
- [x] Remove placeholder verification/rating defaults so trust signals only reflect real data
- [x] Re-run TypeScript, Vitest, and production build validation after gap fixes
- [x] Complete responsive visual QA and runtime console review

## Notes

- Verified badges and ratings are data-backed; new partner profiles start unverified with no reviews.
- The default service catalog is stored in the database and can be extended without hardcoding new partner records.
- Location discovery uses browser geolocation only after the user explicitly selects the location action; area text search remains available as a fallback.

## Independent migration plan

- [x] Replace Manus OAuth with first-party email/password authentication and signed sessions
- [x] Remove Manus-only frontend login helpers, runtime API calls, and visible branding from application code
- [x] Add independent environment configuration and local setup documentation
- [x] Add native Node production start configuration and VPS deployment instructions suitable for GitHub-connected hosting
- [x] Document database migration, seed catalog, storage, domain, and deployment steps
- [x] Validate the standalone build, tests, authentication flow, and GitHub handoff
