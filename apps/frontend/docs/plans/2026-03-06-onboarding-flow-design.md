# Onboarding Flow Design

## Context
ReleasePilot currently splits onboarding across separate screens:
- `/auth` for sign-in
- `/apps/connect` for App Store Connect (ASC) API key
- `/apps/add` for selecting app + GitHub repo/branch

Reference project (`packages/itsyconnect-macos-main`) uses a single setup wizard flow with clear step progression. We want to port that onboarding feel while staying a Next.js web app and introducing auth as the first stage.

## Goal
Implement a cohesive onboarding wizard with this sequence:
1. Auth
2. Team name (UI-only)
3. ASC key
4. Install GitHub App

## Constraints
- Keep app as Next.js web (no Electron-specific setup behavior).
- Team name is UI-only for this slice (no DB schema or API changes).
- Reuse existing APIs and callbacks where possible.
- Do not break existing `/apps/connect` and `/apps/add` routes in this slice.

## Chosen Approach
Create a new single onboarding route (`/onboarding`) with internal step state and route users there immediately after auth.

Why this approach:
- Best match for desired wizard UX from the reference app.
- Minimal backend changes by reusing existing ASC and GitHub endpoints.
- Incremental: existing setup routes stay available during migration.

## Architecture
- Keep `/auth` as unauthenticated entry.
- Change auth success redirect from `/apps` to `/onboarding`.
- Add authenticated route: `/onboarding` under shell layout.
- Implement `OnboardingClient` wizard with 4 steps:
  - Step 1: Team name (local state only)
  - Step 2: ASC key connection via `POST /api/apps/connect-key`
  - Step 3: GitHub App installation via `/api/github/install/start?returnTo=%2Fonboarding`
  - Step 4: Completion CTA to `/apps/add` (primary) or `/apps` (secondary)
- Use GitHub callback query params to determine install result:
  - `?github=installed`
  - `?github=install_failed&message=...`
  - `?github=auth_required`

## UI/UX
- Single-page wizard with:
  - Header/title/description per step
  - Progress indicator
  - Back/Continue actions
  - Inline validation and error banners
- Team name step is purely presentational and stored in component state.
- ASC step mirrors current required fields (issuer ID, key ID, private key).
- GitHub step presents install CTA + retry path on failure.

## Component Plan
- Add: `src/app/(shell)/onboarding/page.tsx`
- Add: `src/app/(shell)/onboarding/OnboardingClient.tsx`
- Modify: `src/app/auth/AuthClient.tsx` (callbackURL)
- Optionally modify: onboarding links/messages in existing screens to point to `/onboarding` where appropriate

No backend or DB changes required for this first slice.

## Data Flow
1. User signs in at `/auth`.
2. Better Auth redirects to `/onboarding`.
3. Team name entered locally, step advances.
4. ASC credentials submitted to `/api/apps/connect-key`.
   - On success, wizard advances.
   - On failure, show API error and remain on step.
5. User clicks install GitHub App.
   - Redirect to GitHub via existing start route.
   - Callback returns user to `/onboarding?...`.
6. Wizard reads query params and marks step complete on `github=installed`.
7. User continues to `/apps/add` to select app/repo/branch.

## Error Handling
- Team name empty: disable Continue.
- ASC fields missing: local validation before request.
- ASC API/network failure: show inline error, preserve entered values.
- GitHub install failure (`github=install_failed`): show retriable error state.
- Auth required callback case (`github=auth_required`): show informational error and sign-in prompt.

## Security
- Continue using existing authenticated API routes and server checks.
- No new secret storage behavior in this slice.
- Team name remains non-persistent by explicit decision.

## Testing Strategy
### Manual happy path
1. Sign in at `/auth`.
2. Land on `/onboarding`.
3. Enter team name and continue.
4. Submit valid ASC key and continue.
5. Install GitHub App and return with `github=installed`.
6. Finish onboarding and land on `/apps/add`.

### Manual failure paths
- ASC invalid credentials -> error visible, cannot proceed.
- ASC network error -> error visible, values preserved.
- GitHub install failure query -> error visible with retry.
- Empty team name -> continue disabled.

### Regression checks
- `/apps/connect` still connects ASC key.
- `/apps/add` still loads apps/repos and connects an app.
- Existing authenticated routes remain protected by shell layout.

## Future Follow-Ups
- Persist team name to database and surface in sidebar/profile.
- Add server-driven onboarding completion checks/redirects.
- Merge residual setup pages into onboarding-only flow.
