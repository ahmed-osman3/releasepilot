# Onboarding Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified Next.js onboarding wizard that runs Auth -> Team name (UI-only) -> ASC key -> Install GitHub App.

**Architecture:** Keep `/auth` as the sign-in entry, redirect authenticated users into a new `/onboarding` wizard route, and reuse existing backend routes (`/api/apps/connect-key`, `/api/github/install/start`, GitHub callback query params). Team name is local state only in this slice and does not require schema or API changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Better Auth, existing ReleasePilot UI components, Vitest (if testable helpers are extracted).

---

### Task 1: Add Onboarding Route Shell

**Files:**
- Create: `src/app/(shell)/onboarding/page.tsx`

**Step 1: Write the failing test**

No route-level test harness currently exists for App Router pages; skip automated test for this route creation.

**Step 2: Run test to verify it fails**

Skip (no route test harness).

**Step 3: Write minimal implementation**

Create `src/app/(shell)/onboarding/page.tsx`:

```tsx
import OnboardingClient from './OnboardingClient'

export default function OnboardingPage() {
  return <OnboardingClient />
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -s tsc --noEmit`
Expected: PASS with no type errors from the new page.

**Step 5: Commit**

```bash
git add src/app/(shell)/onboarding/page.tsx
git commit -m "feat: add onboarding route"
```

### Task 2: Build Step-Based Onboarding Client UI

**Files:**
- Create: `src/app/(shell)/onboarding/OnboardingClient.tsx`
- Modify: `src/components/ui/*` only if a missing primitive is required (avoid unless necessary)

**Step 1: Write the failing test**

If extracting helper logic (recommended), create:
- `src/app/(shell)/onboarding/onboarding-state.ts`
- `src/app/(shell)/onboarding/onboarding-state.test.ts`

Test example:

```ts
import { resolveGithubStatus } from './onboarding-state'

it('returns installed state when github=installed', () => {
  expect(resolveGithubStatus(new URLSearchParams('github=installed'))).toBe('installed')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest src/app/(shell)/onboarding/onboarding-state.test.ts`
Expected: FAIL with missing module/function.

**Step 3: Write minimal implementation**

- Implement `OnboardingClient.tsx` with 4 steps:
  - Step 1 Team Name (state only)
  - Step 2 ASC form (issuerId, keyId, privateKey)
  - Step 3 GitHub install CTA and callback status banner
  - Step 4 Completion CTA to `/apps/add`
- Implement helper `resolveGithubStatus(searchParams)` in `onboarding-state.ts` for query parsing.
- Include back/continue controls and disabled states for invalid input.

**Step 4: Run test to verify it passes**

Run:
- `pnpm vitest src/app/(shell)/onboarding/onboarding-state.test.ts`
- `pnpm -s tsc --noEmit`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/(shell)/onboarding/OnboardingClient.tsx src/app/(shell)/onboarding/onboarding-state.ts src/app/(shell)/onboarding/onboarding-state.test.ts
git commit -m "feat: add onboarding wizard client"
```

### Task 3: Wire ASC Key Step to Existing API

**Files:**
- Modify: `src/app/(shell)/onboarding/OnboardingClient.tsx`

**Step 1: Write the failing test**

Add helper tests for step advancement logic if extracted:
- `canAdvanceStep({ step, teamName, ascFields, ascConnected })`

```ts
it('blocks step 2 advance when ASC fields are incomplete', () => {
  expect(canAdvanceStep({ step: 2, teamName: 'X', ascFields: { issuerId: '', keyId: '', privateKey: '' }, ascConnected: false })).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest src/app/(shell)/onboarding/onboarding-state.test.ts`
Expected: FAIL for missing helper.

**Step 3: Write minimal implementation**

- Add ASC submit action in step 2:
  - POST `/api/apps/connect-key`
  - On success: mark `ascConnected=true`, clear error, advance to step 3.
  - On failure: render inline error and keep current values.
- Add loading state (`Connecting...`) and disable submit while in-flight.

**Step 4: Run test to verify it passes**

Run:
- `pnpm vitest src/app/(shell)/onboarding/onboarding-state.test.ts`
- `pnpm -s tsc --noEmit`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/(shell)/onboarding/OnboardingClient.tsx src/app/(shell)/onboarding/onboarding-state.ts src/app/(shell)/onboarding/onboarding-state.test.ts
git commit -m "feat: connect onboarding ASC step to API"
```

### Task 4: Wire GitHub Install Step and Callback Status

**Files:**
- Modify: `src/app/(shell)/onboarding/OnboardingClient.tsx`
- Modify: `src/app/api/github/install/callback/route.ts` (only if returnTo handling needs adjustment)

**Step 1: Write the failing test**

Extend `onboarding-state.test.ts` for callback parsing:

```ts
it('returns failed state with message when install_failed is present', () => {
  const params = new URLSearchParams('github=install_failed&message=boom')
  expect(resolveGithubStatus(params)).toEqual({ status: 'failed', message: 'boom' })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest src/app/(shell)/onboarding/onboarding-state.test.ts`
Expected: FAIL until helper supports full status shape.

**Step 3: Write minimal implementation**

- In step 3, add button/link to:
  - `/api/github/install/start?returnTo=%2Fonboarding`
- Parse query params on load:
  - `github=installed` -> mark GitHub step complete
  - `github=install_failed` -> show error with retry CTA
  - `github=auth_required` -> show sign-in guidance
- Keep callback route behavior unchanged unless `returnTo` compatibility bug is discovered.

**Step 4: Run test to verify it passes**

Run:
- `pnpm vitest src/app/(shell)/onboarding/onboarding-state.test.ts`
- `pnpm -s tsc --noEmit`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/(shell)/onboarding/OnboardingClient.tsx src/app/(shell)/onboarding/onboarding-state.ts src/app/(shell)/onboarding/onboarding-state.test.ts src/app/api/github/install/callback/route.ts
git commit -m "feat: add github install step to onboarding"
```

### Task 5: Update Auth Redirect to Start Onboarding

**Files:**
- Modify: `src/app/auth/AuthClient.tsx`

**Step 1: Write the failing test**

No auth UI test harness exists; skip automated test for callbackURL wiring.

**Step 2: Run test to verify it fails**

Skip (no existing auth component test harness).

**Step 3: Write minimal implementation**

Change callback URL in `signInWithGithub`:

```ts
callbackURL: '/onboarding'
```

**Step 4: Run test to verify it passes**

Run: `pnpm -s tsc --noEmit`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/auth/AuthClient.tsx
git commit -m "feat: redirect post-auth users to onboarding"
```

### Task 6: Add Onboarding Navigation and Fallback Entry

**Files:**
- Modify: `src/app/(shell)/apps/page.tsx`
- Modify: `src/components/Sidebar.tsx` (optional link only if desired)

**Step 1: Write the failing test**

No dashboard rendering tests currently exist; skip automated test.

**Step 2: Run test to verify it fails**

Skip (no dashboard test harness).

**Step 3: Write minimal implementation**

- On apps dashboard empty/setup states, update CTA copy to push users toward `/onboarding` where appropriate.
- Keep existing `/apps/connect` and `/apps/add` links working to avoid regression.
- If adding sidebar entry, keep it temporary and minimal to avoid nav clutter.

**Step 4: Run test to verify it passes**

Run: `pnpm -s tsc --noEmit`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/(shell)/apps/page.tsx src/components/Sidebar.tsx
git commit -m "chore: surface onboarding entry points"
```

### Task 7: Full Validation and Documentation Update

**Files:**
- Modify: `README.md` (if onboarding steps are documented)
- Modify: `docs/plans/2026-03-06-onboarding-flow-design.md` only if behavior changed during implementation

**Step 1: Write the failing test**

Create a manual QA checklist document update in PR notes (no automated E2E harness yet).

**Step 2: Run test to verify it fails**

Run full checks first and capture failures:

```bash
pnpm -s tsc --noEmit
pnpm test
```

Expected: Any failures are pre-existing or introduced; fix introduced issues before finalizing.

**Step 3: Write minimal implementation**

- Address any regressions from the onboarding changes.
- Update README onboarding section if needed.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm -s tsc --noEmit
pnpm test
```

Expected: PASS (or document known unrelated failures explicitly).

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-03-06-onboarding-flow-design.md
git commit -m "docs: align onboarding docs with new flow"
```

## Notes
- Keep changes DRY and YAGNI: no persistence for team name in this iteration.
- Reuse existing server routes; avoid duplicating ASC/GitHub install backend logic.
- Skills referenced: @brainstorming, @writing-plans.
