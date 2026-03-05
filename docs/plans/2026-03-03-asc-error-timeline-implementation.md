# App Store Connect Error Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve structured App Store Connect submission errors, write them into the release timeline, and render expandable inline error details while restoring submission sidebar context.

**Architecture:** Extend the App Store Connect fetch layer to normalize full ASC error payloads instead of collapsing them to strings. Persist compact error previews plus structured failure payloads on timeline events, then update the submission workspace so the timeline is the primary surface for submit failures and the right-side panel shows repo and automation context again.

**Tech Stack:** TanStack Start, React 19, TypeScript, Vitest, Drizzle ORM, PostgreSQL

---

### Task 1: Add structured ASC error normalization

**Files:**
- Modify: `src/lib/app-store-connect/fetch.ts`
- Modify: `src/lib/app-store-connect/submissions.ts`
- Test: `src/lib/app-store-connect/submissions.test.ts`

**Step 1: Write the failing test**

Add a test in `src/lib/app-store-connect/submissions.test.ts` that mocks a 409 App Store Connect response with a top-level error and nested `meta.associatedErrors`, then asserts the submit helper preserves:

```ts
expect(result.error).toContain('not in valid state')
expect(result.errors?.[0]).toMatchObject({
  status: '409',
  code: 'STATE_ERROR.ENTITY_STATE_INVALID',
  title: expect.stringContaining('not in valid state'),
})
expect(result.errors?.[0].associatedErrors?.length).toBeGreaterThan(0)
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/app-store-connect/submissions.test.ts`

Expected: FAIL because the current fetch layer only returns a flat `error` string and drops structured details.

**Step 3: Write minimal implementation**

In `src/lib/app-store-connect/fetch.ts`:

- add normalized error types for top-level ASC errors and associated errors
- parse `json.errors` defensively
- return both `error` and `errors`

In `src/lib/app-store-connect/submissions.ts`:

- thread the structured `errors` result through submit helpers that need to surface submission failures

Implementation shape:

```ts
export type NormalizedAscError = {
  id?: string
  status?: string
  code?: string
  title?: string
  detail?: string
  source?: Record<string, unknown>
  meta?: Record<string, unknown>
  associatedErrors?: NormalizedAscAssociatedError[]
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/app-store-connect/submissions.test.ts`

Expected: PASS with the new structured error assertions.

**Step 5: Commit**

```bash
git add src/lib/app-store-connect/fetch.ts src/lib/app-store-connect/submissions.ts src/lib/app-store-connect/submissions.test.ts
git commit -m "feat: normalize app store connect submission errors"
```

### Task 2: Persist structured failure payloads in release timeline events

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0007_release_timeline_event_payload.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/lib/apps/server.ts`
- Modify: `src/lib/release-timeline-events.ts`
- Test: `src/lib/submission-dashboard.test.ts`

**Step 1: Write the failing test**

Add a server-oriented test near `src/lib/submission-dashboard.test.ts` or a new focused test in the same area that asserts failed submit logging produces:

```ts
expect(failureEvent.detail).toContain('not in valid state')
expect(failureEvent.payload).toMatchObject({
  errors: [
    expect.objectContaining({
      code: 'STATE_ERROR.ENTITY_STATE_INVALID',
    }),
  ],
})
```

If extracting helpers is necessary, test the helper that builds the timeline preview and payload from normalized ASC errors.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/submission-dashboard.test.ts`

Expected: FAIL because timeline events do not currently have a payload field or failure payload helper.

**Step 3: Write minimal implementation**

In `src/db/schema.ts` and a new drizzle migration:

- add nullable `payload` JSON column to `release_timeline_events`

In `src/lib/apps/server.ts`:

- extend `logTimelineEvent` to accept `payload`
- on submit/resubmit failure, log `ASC_REQUEST_FAILED` with:
  - `detail`: compact summary string for collapsed timeline view
  - `payload`: normalized structured ASC error body

In `src/lib/release-timeline-events.ts`:

- update failure event copy so the default title and activity text still read clearly when no payload exists

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/submission-dashboard.test.ts`

Expected: PASS with payload-aware failure event expectations.

**Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/0007_release_timeline_event_payload.sql drizzle/meta/_journal.json src/lib/apps/server.ts src/lib/release-timeline-events.ts src/lib/submission-dashboard.test.ts
git commit -m "feat: store structured release timeline failures"
```

### Task 3: Render expandable inline ASC failure details in the timeline

**Files:**
- Modify: `src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/index.tsx`
- Modify: `src/lib/submission-dashboard.ts`
- Modify: `src/styles.css`
- Test: `src/lib/submission-dashboard.test.ts`

**Step 1: Write the failing test**

Add a rendering-focused test that builds a timeline item with `ASC_REQUEST_FAILED` payload and asserts:

```ts
expect(item.preview).toContain('not in valid state')
expect(item.expandable).toBe(true)
expect(item.structuredErrors?.[0]?.associatedErrors?.length).toBe(1)
```

If the route file is too large to test directly, extract small pure helpers from the route into `src/lib/submission-dashboard.ts` and test those helpers instead.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/submission-dashboard.test.ts`

Expected: FAIL because timeline items do not currently model expandable structured failure state.

**Step 3: Write minimal implementation**

In `src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/index.tsx`:

- remove submit failure dependence on the top action banner for ASC responses
- add local expansion state per timeline row
- render headline, preview, and inline expanded failure details for `ASC_REQUEST_FAILED`
- keep non-error events rendering as simple rows

In `src/lib/submission-dashboard.ts`:

- add helper(s) for preview text, human-readable titles, and payload mapping

In `src/styles.css`:

- add only the minimal styling needed for expanded timeline error blocks and nested associated error rows

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/submission-dashboard.test.ts`

Expected: PASS with helper coverage for collapsed and expanded failure content.

**Step 5: Commit**

```bash
git add src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/index.tsx src/lib/submission-dashboard.ts src/styles.css src/lib/submission-dashboard.test.ts
git commit -m "feat: show app store failures inline in timeline"
```

### Task 4: Restore sidebar context and immediate timeline refresh after failed submits

**Files:**
- Modify: `src/routes/apps/$appId/submissions/_header/route.tsx`
- Modify: `src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/index.tsx`
- Modify: `src/lib/submission-dashboard.ts`
- Test: `src/lib/submission-dashboard.test.ts`

**Step 1: Write the failing test**

Add assertions for two behaviors:

```ts
expect(activity[0]?.text).toBeDefined()
expect(sidebarContext.githubRepoFullName).toBe('owner/repo')
```

and for submit failure refresh behavior:

```ts
expect(invalidateSpy).toHaveBeenCalled()
```

Again, prefer extracting pure helpers if direct route testing is too expensive.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/submission-dashboard.test.ts`

Expected: FAIL because the detail route currently drops repo/branch context and does not invalidate after failed submit attempts.

**Step 3: Write minimal implementation**

In `src/routes/apps/$appId/submissions/_header/route.tsx`:

- pass through `githubRepoFullName`, `watchedBranch`, and `githubInstallationId`

In `src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/index.tsx`:

- consume the restored loader data
- render a compact sidebar card for repo and automation context
- show recent activity derived from timeline events
- always invalidate after submit/resubmit attempts so new timeline rows appear on failure too

In `src/lib/submission-dashboard.ts`:

- reuse `buildActivity` or extend it for sidebar-friendly activity entries

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/submission-dashboard.test.ts`

Expected: PASS with restored context and refresh behavior covered.

**Step 5: Commit**

```bash
git add src/routes/apps/$appId/submissions/_header/route.tsx src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/index.tsx src/lib/submission-dashboard.ts src/lib/submission-dashboard.test.ts
git commit -m "feat: restore submission sidebar context"
```

### Task 5: Run verification and capture final regressions

**Files:**
- Modify: `docs/plans/2026-03-03-asc-error-timeline-design.md`
- Modify: `docs/plans/2026-03-03-asc-error-timeline-implementation.md`

**Step 1: Run focused tests**

Run: `pnpm test src/lib/app-store-connect/submissions.test.ts src/lib/submission-dashboard.test.ts`

Expected: PASS

**Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

**Step 3: Run full test suite**

Run: `pnpm test`

Expected: PASS

**Step 4: Update docs if implementation diverged**

If the exact payload shape or helper extraction differs from the original design, update both plan docs to match the final implementation.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-03-asc-error-timeline-design.md docs/plans/2026-03-03-asc-error-timeline-implementation.md
git commit -m "docs: finalize asc error timeline plan"
```
