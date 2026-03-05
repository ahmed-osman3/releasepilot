# AI Submission Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first backend path for AI-assisted App Store Connect remediation runs driven by real ASC submission errors.

**Architecture:** Manual submission remains the trigger. A server entrypoint normalizes the latest ASC errors, materializes the connected GitHub repo on the watched branch, gathers targeted repository context plus current ASC metadata, and returns a structured remediation proposal. Applying approved changes remains a separate step.

**Tech Stack:** TanStack Start server functions, TypeScript, Drizzle, Vitest, OpenAI SDK, GitHub App installation auth

---

### Task 1: Add ASC issue normalization

**Files:**
- Create: `src/lib/app-store-connect/issues.ts`
- Create: `src/lib/app-store-connect/issues.test.ts`

**Step 1: Write the failing test**

```ts
it('classifies pricing issues', () => {
  const issues = normalizeAscIssues([
    {
      title: 'Pricing is required',
      detail: 'A price schedule must be configured before submission.',
    },
  ])

  expect(issues[0]?.code).toBe('pricing_required')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/app-store-connect/issues.test.ts`
Expected: FAIL because `normalizeAscIssues` does not exist yet.

**Step 3: Write minimal implementation**

```ts
export function normalizeAscIssues(errors: NormalizedAscError[]) {
  return errors.map((error, index) => ({
    id: error.id ?? `asc-issue-${index + 1}`,
    category: 'unknown',
    code: 'unknown_submission_issue',
    title: error.title ?? 'App Store Connect issue',
    detail: error.detail ?? error.title ?? 'App Store Connect issue',
    blocking: true,
  }))
}
```

**Step 4: Expand classification rules**

Add lightweight heuristics for:

- localization fields
- required URLs
- pricing requirements
- review notes

**Step 5: Run test to verify it passes**

Run: `pnpm test src/lib/app-store-connect/issues.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/app-store-connect/issues.ts src/lib/app-store-connect/issues.test.ts
git commit -m "feat: add asc issue normalization"
```

### Task 2: Add GitHub repo materialization helper

**Files:**
- Modify: `src/lib/github/server.ts`
- Create: `src/lib/github/repo-materializer.ts`

**Step 1: Add installation token helper**

Expose a user-scoped helper that validates installation ownership and returns an installation access token.

**Step 2: Implement repo materialization**

Clone the connected repo branch into a temp directory and resolve the pinned commit SHA.

**Step 3: Add lightweight repo context collection**

Read a small set of files:

- `README.md`
- `package.json`
- `app.json`
- `app.config.js`
- `app.config.ts`
- `CHANGELOG.md`

**Step 4: Verify behavior**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/github/server.ts src/lib/github/repo-materializer.ts
git commit -m "feat: add github repo materialization for remediation"
```

### Task 3: Add backend remediation worker scaffold

**Files:**
- Create: `src/lib/ai/submission-remediation-worker.ts`

**Step 1: Define worker input/output schema**

Include:

- normalized issues
- raw ASC errors
- repo identity
- branch
- current localizations

**Step 2: Implement fallback path**

If `OPENAI_API_KEY` is missing, return a deterministic proposal shell with:

- summary
- rationale
- missing information
- empty proposed changes

**Step 3: Implement AI prompt path**

Use OpenAI JSON output to produce:

- summary
- rationale
- missing information
- grouped proposed changes

**Step 4: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/submission-remediation-worker.ts
git commit -m "feat: add submission remediation worker scaffold"
```

### Task 4: Add server remediation entrypoint

**Files:**
- Modify: `src/lib/apps/server.ts`

**Step 1: Add server function**

Create `generateSubmissionRemediationPlan` with input:

- `connectedAppId`
- `reviewSubmissionId`
- `versionId`
- `latestErrors`

**Step 2: Validate app wiring**

Ensure the connected app has:

- ASC credentials
- GitHub installation id
- GitHub repo full name
- watched branch

**Step 3: Load current ASC metadata**

If a version id exists, fetch current localizations before invoking the worker.

**Step 4: Return a structured plan payload**

Include:

- normalized issues
- repo full name
- branch
- pinned commit SHA
- proposal payload

**Step 5: Run targeted checks**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/apps/server.ts
git commit -m "feat: add submission remediation planning endpoint"
```

### Task 5: Wire the UI to the remediation endpoint

**Files:**
- Modify: `src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/fix.tsx`
- Modify: `src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/index.tsx`

**Step 1: Enable `Fix with AI` only when latest ASC errors are present**

Load the latest structured ASC failure payload from the timeline or page state.

**Step 2: Call the server remediation entrypoint**

Trigger `generateSubmissionRemediationPlan` instead of the current rejection-only suggestion path.

**Step 3: Render grouped proposals**

Show:

- summary
- rationale
- repo commit SHA
- localization proposals
- URL proposals
- pricing proposals

**Step 4: Keep apply/resubmit manual**

Do not automatically apply or resubmit in this task.

**Step 5: Run focused tests**

Run: `pnpm test`
Expected: PASS for affected suites

**Step 6: Commit**

```bash
git add src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/fix.tsx src/routes/apps/$appId/submissions/_header/$reviewSubmissionId/index.tsx
git commit -m "feat: surface ai submission remediation plans"
```
