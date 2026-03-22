# Next.js Migration Design

**Date:** 2026-03-05

## Goal

Migrate the existing TanStack Start application in this repository to Next.js App Router while preserving all current product behavior and URL/API contracts.

## Agreed Constraints

- Full migration, not phased.
- Target framework: Next.js App Router.
- Preserve all existing routes and API paths exactly.
- Keep `@tanstack/react-query` as the client data layer.
- Use Node.js runtime for route handlers and auth.
- Prefer official CLI/doc-driven bootstrap commands instead of manual scaffolding when setup is needed.

## Architecture

### 1. Runtime and Rendering

- Next.js App Router becomes the only web runtime.
- Protected pages are server components that enforce auth before rendering.
- Interactive pages/components become client components where stateful UX is required.

### 2. Routing Model

The following paths remain unchanged:

- `/` (redirect to `/auth`)
- `/auth`
- `/apps`
- `/apps/connect`
- `/apps/add`
- `/apps/:appId/submissions`
- `/apps/:appId/submissions/:reviewSubmissionId`
- `/apps/:appId/submissions/:reviewSubmissionId/fix`
- `/api/auth/*`
- `/api/asc/*`
- `/api/github/install/start`
- `/api/github/install/callback`
- `/api/github/webhooks`

### 3. Auth and Session

- Better Auth is hosted by a Next catch-all route handler.
- Shared server auth helpers provide:
  - session read from request headers
  - `getCurrentUserId`
  - `requireCurrentUserId`
- Page-level auth redirect behavior remains the same as the TanStack `beforeLoad` logic.

### 4. Data and Mutation Model

- Existing Drizzle/Postgres modules remain in place.
- TanStack `createServerFn` abstractions are replaced with framework-agnostic server service functions.
- Next route handlers expose HTTP endpoints for client-triggered mutations and interactive fetches.
- React Query remains for client-side query/mutation coordination and caching.

### 5. UI Shell

- Global CSS and shell layout move to `src/app/layout.tsx` and App Router conventions.
- Sidebar shell behavior is preserved for non-auth routes.
- `/auth` keeps a shell-less presentation.

## API Mapping

### Keep and Port

- `GET/POST /api/auth/*` -> Better Auth handler
- `GET/POST/PATCH/PUT/DELETE /api/asc/*` -> ASC proxy
- `GET /api/github/install/start` -> GitHub app install redirect flow
- `GET /api/github/install/callback` -> setup callback
- `POST /api/github/webhooks` -> signature-verified webhook processing

### New Internal Endpoint Surface

Client-only interactions currently implemented through `createServerFn` are surfaced as Next route handlers (grouped by domain under `/api/apps/*`), with payload contracts kept compatible to minimize UI changes.

## Error Handling and Security

- All protected API handlers require authenticated user context.
- Webhook endpoint remains unauthenticated but strict-signature validated.
- ASC proxy keeps encrypted key usage and token generation behavior unchanged.
- Route handlers return explicit JSON error payloads with stable error messages where possible.

## Risks and Mitigations

1. Auth context drift between TanStack and Next request handling.
- Mitigation: centralize header-based session resolution in one auth helper module.

2. Client/server component boundary regressions.
- Mitigation: enforce explicit `use client` boundaries and keep server data fetching in parent server components.

3. Behavior differences from replacing `createServerFn`.
- Mitigation: preserve response shape and error strings; use targeted smoke tests on critical flows.

4. Path regressions for nested dynamic routes.
- Mitigation: explicit one-to-one route mapping checklist during implementation.

## Validation Criteria

- Unauthenticated access to protected pages redirects to `/auth`.
- GitHub sign-in flow works end-to-end.
- ASC key connection, GitHub install, app connect flow works.
- Submission workspace actions (submit/resubmit/refresh/apply metadata/fix) work.
- Webhook endpoint validates signatures and handles installation events.
- `pnpm exec tsc` and `pnpm test` pass after migration.
