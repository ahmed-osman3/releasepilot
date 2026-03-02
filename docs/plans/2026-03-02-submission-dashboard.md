# Submission Dashboard Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the submission detail screen so the hero and right rail match the approved monitoring flow, replacing low-value CTA blocks with an informational health check and mocked operational status rows.

**Architecture:** Keep the current submissions route structure intact and implement the refresh inside the existing `_header` route and version detail page. Extract small pure helpers for derived display data so presentational logic stays readable and testable, and add only the CSS needed to sharpen hierarchy within the existing dark glass design system.

**Tech Stack:** React 19, TanStack Router, Tailwind CSS v4, Vitest

---

### Task 1: Extract testable submission dashboard view-model helpers

**Files:**
- Create: `src/lib/submission-dashboard.ts`
- Create: `src/lib/submission-dashboard.test.ts`
- Modify: `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  buildHealthChecks,
  buildHeroSystemStatus,
} from '@/lib/submission-dashboard'

describe('buildHealthChecks', () => {
  it('returns informational rows with mocked fallback values', () => {
    const checks = buildHealthChecks({
      appStoreStatus: 'WAITING_FOR_REVIEW',
      githubRepoFullName: 'ahmed/app',
      watchedBranch: 'main',
    })

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'App Store Status', value: 'Waiting For Review' }),
        expect.objectContaining({ label: 'Last Merge to main', value: expect.any(String) }),
        expect.objectContaining({ label: 'Last Released Build', value: expect.any(String) }),
      ]),
    )
  })
})

describe('buildHeroSystemStatus', () => {
  it('builds the compact status strip entries for the hero', () => {
    const items = buildHeroSystemStatus({
      appVersionState: 'READY_FOR_REVIEW',
      githubRepoFullName: 'ahmed/app',
      watchedBranch: 'main',
    })

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'GitHub', tone: 'ok' }),
        expect.objectContaining({ label: 'Branch', value: 'main' }),
        expect.objectContaining({ label: 'App Store' }),
      ]),
    )
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: FAIL because `src/lib/submission-dashboard.ts` does not exist yet

**Step 3: Write minimal implementation**

Create `src/lib/submission-dashboard.ts` with:
- `buildHealthChecks(...)`
- `buildHeroSystemStatus(...)`
- small helpers for humanizing App Store states and mocked fallback strings
- lightweight exported types for health check rows and hero strip items

Update `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx` to import these helpers once they exist, without changing the layout yet.

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/submission-dashboard.ts src/lib/submission-dashboard.test.ts src/routes/apps/$appId/submissions/_header/$versionId/index.tsx
git commit -m "feat: add submission dashboard view-model helpers"
```

### Task 2: Refresh the submissions header shell

**Files:**
- Modify: `src/routes/apps/$appId/submissions/_header/route.tsx`
- Modify: `src/styles.css`

**Step 1: Write the failing test**

Create a narrow DOM-oriented test in `src/lib/submission-dashboard.test.ts` or a new route-adjacent test that asserts the header still exposes the app name, version selector, and utility controls after the shell refresh.

```ts
it('keeps version navigation context visible in the header shell', () => {
  expect(true).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: FAIL on the placeholder assertion

**Step 3: Write minimal implementation**

Update `src/routes/apps/$appId/submissions/_header/route.tsx` to:
- tighten the top bar spacing and composition
- improve the app identity block styling
- keep the version selector prominent and readable
- preserve current navigation behavior

Update `src/styles.css` to add any new shell-level classes needed for:
- stronger panel backdrop
- refined inner borders
- improved top-level spacing rhythm

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: PASS after replacing the placeholder with a real assertion or removing the temporary test in favor of helper coverage if route rendering is too noisy

**Step 5: Commit**

```bash
git add src/routes/apps/$appId/submissions/_header/route.tsx src/styles.css src/lib/submission-dashboard.test.ts
git commit -m "feat: refine submission dashboard shell"
```

### Task 3: Rebuild the hero section around release monitoring

**Files:**
- Modify: `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx`
- Modify: `src/styles.css`
- Test: `src/lib/submission-dashboard.test.ts`

**Step 1: Write the failing test**

Add helper-level assertions for the hero content assembly:

```ts
it('derives the monitoring next action for non-rejected connected releases', () => {
  const nextAction = buildNextAction({
    appVersionState: 'WAITING_FOR_REVIEW',
    hasGithubRepo: true,
    isRejected: false,
  })

  expect(nextAction).toBe('Monitoring App Store Connect review progress')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: FAIL because `buildNextAction` is not implemented yet

**Step 3: Write minimal implementation**

Extend `src/lib/submission-dashboard.ts` with `buildNextAction(...)`.

Update `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx` to rebuild the hero card so it includes:
- stronger current release header
- prominent status pill
- automation active label
- next action block
- last checked metadata row
- compact system strip using `buildHeroSystemStatus(...)`

Add supporting CSS in `src/styles.css` for any custom hero grid, strip, or accent treatments that Tailwind utilities alone do not express cleanly.

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/submission-dashboard.ts src/lib/submission-dashboard.test.ts src/routes/apps/$appId/submissions/_header/$versionId/index.tsx src/styles.css
git commit -m "feat: redesign submission dashboard hero"
```

### Task 4: Replace action-heavy right rail controls with informational monitoring modules

**Files:**
- Modify: `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx`
- Modify: `src/styles.css`
- Test: `src/lib/submission-dashboard.test.ts`

**Step 1: Write the failing test**

Add a helper-level test for the health check rows so the mocked content stays intentional:

```ts
it('includes mocked operational rows when integrations are unavailable', () => {
  const checks = buildHealthChecks({
    appStoreStatus: 'MONITORING',
    githubRepoFullName: null,
    watchedBranch: null,
  })

  expect(checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: 'Last Merge to main', value: expect.stringContaining('Mocked') }),
      expect.objectContaining({ label: 'Last Released Build', value: expect.stringContaining('Mocked') }),
    ]),
  )
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: FAIL until mocked fallback wording is standardized

**Step 3: Write minimal implementation**

Update `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx` to:
- remove the retry / AI fix / resubmit / disable CTA stack
- keep the automation context card, but restyle it to match the approved direction
- add a new informational `Health Check` card using `buildHealthChecks(...)`
- retain and tighten the activity card
- retain the raw App Store response card beneath it

Update `src/styles.css` for any reusable row styles needed by the health check module.

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/submission-dashboard.ts src/lib/submission-dashboard.test.ts src/routes/apps/$appId/submissions/_header/$versionId/index.tsx src/styles.css
git commit -m "feat: add informational health checks to submission dashboard"
```

### Task 5: Restyle the release timeline to fit the new dashboard hierarchy

**Files:**
- Modify: `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx`
- Modify: `src/styles.css`

**Step 1: Write the failing test**

Add a simple helper assertion if timeline status formatting is extracted; otherwise create a manual verification checklist for this presentational task and treat lint/build as the regression gate.

```ts
it('maps timeline statuses to the expected dashboard tones', () => {
  expect(true).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: FAIL on the placeholder assertion, unless helper extraction makes a more concrete test possible

**Step 3: Write minimal implementation**

Adjust the timeline presentation in `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx` so it:
- reads more like a lifecycle progression
- uses clearer spacing, dot treatments, and copy hierarchy
- better distinguishes completed, active, warning, and error entries

Add only the CSS needed in `src/styles.css` for timeline polish that is not practical as inline utilities.

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: PASS after replacing the placeholder with a concrete helper assertion or removing it in favor of lint/build verification

**Step 5: Commit**

```bash
git add src/routes/apps/$appId/submissions/_header/$versionId/index.tsx src/styles.css src/lib/submission-dashboard.test.ts
git commit -m "feat: polish submission release timeline"
```

### Task 6: Run regression checks and finalize

**Files:**
- Modify: `src/routes/apps/$appId/submissions/_header/route.tsx`
- Modify: `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx`
- Modify: `src/styles.css`
- Modify: `src/lib/submission-dashboard.ts`
- Modify: `src/lib/submission-dashboard.test.ts`

**Step 1: Run targeted tests**

Run: `pnpm test src/lib/submission-dashboard.test.ts`
Expected: PASS

**Step 2: Run project lint**

Run: `pnpm lint src/routes/apps/$appId/submissions/_header/route.tsx src/routes/apps/$appId/submissions/_header/$versionId/index.tsx src/lib/submission-dashboard.ts src/lib/submission-dashboard.test.ts src/styles.css`
Expected: PASS or zero relevant findings for touched files

**Step 3: Run production build**

Run: `pnpm build`
Expected: PASS

**Step 4: Manual verification**

Check in the browser that:
- the hero establishes the release state clearly
- the right rail no longer contains the removed CTAs
- health check rows show mocked informational values cleanly
- the layout still works at desktop and narrow laptop widths
- scrollable areas remain usable

**Step 5: Commit**

```bash
git add src/routes/apps/$appId/submissions/_header/route.tsx src/routes/apps/$appId/submissions/_header/$versionId/index.tsx src/styles.css src/lib/submission-dashboard.ts src/lib/submission-dashboard.test.ts
git commit -m "feat: refresh submission monitoring dashboard"
```
