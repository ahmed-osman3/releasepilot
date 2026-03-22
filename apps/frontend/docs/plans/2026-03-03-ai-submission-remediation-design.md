# AI Submission Remediation Design

**Date:** 2026-03-03

## Goal

Add the first backend architecture for AI-assisted App Store Connect submission fixes without changing the product's manual submission model.

## Agreed Product Boundary

- The operator still submits manually.
- Release Pilot waits for a real App Store Connect error response.
- `Fix with AI` is only enabled when there are active ASC errors to work from.
- The remediation flow is assist-only for now.
- The backend worker owns repository access and context building.
- The worker receives repo identity and branch, not prebuilt repo context.

## Core Flow

1. Operator submits a review submission manually.
2. App Store Connect returns structured errors.
3. The server normalizes those errors into typed issues.
4. `Fix with AI` starts a remediation run using:
   - connected app id
   - review submission id
   - related version id when available
   - latest ASC errors
5. The backend worker resolves GitHub credentials, materializes the watched repo branch, and pins the run to a commit SHA.
6. The worker reads selected repository files plus current ASC metadata.
7. The worker returns a structured proposal with rationale and proposed changes.
8. The operator reviews and later approves selected changes.
9. A separate apply step will use typed ASC mutation helpers.

## Architecture

### 1. ASC Issue Normalizer

The new normalizer converts raw ASC errors into a small internal issue taxonomy. The worker should reason primarily over normalized issues, with raw ASC errors preserved as supporting evidence.

Initial issue categories:

- `localization`
- `url`
- `pricing`
- `review_notes`
- `unknown`

Initial issue codes:

- `missing_localization`
- `missing_url`
- `pricing_required`
- `missing_review_notes`
- `unknown_submission_issue`

This taxonomy is intentionally small for v1. It is enough to unlock AI remediation without introducing an overbuilt planning layer.

### 2. Backend Remediation Worker

The worker is a single backend module for now. It owns:

- repository materialization
- repo context collection
- proposal generation

It does not yet apply changes automatically. It returns a proposal payload only.

The worker runs in phases internally:

- `materialize_repository`
- `collect_context`
- `generate_proposal`

This keeps the runtime simple while still giving the code clear seams.

### 3. Repo Materialization Boundary

The worker resolves GitHub installation credentials server-side and clones the watched branch into a temporary directory. It then records the resolved commit SHA for auditability.

The client never sends repository contents or derived repo context.

### 4. ASC Tool Boundary

The worker currently exposes only the ASC capabilities that already exist in the codebase:

- `getVersionLocalizations`
- `updateVersionLocalization`

Future app-info, URL, and pricing tools should be added to this boundary later instead of letting the worker mutate ASC through raw requests.

## Current Implementation Slice

The initial implementation includes:

- ASC issue normalization
- tests for the issue normalizer
- GitHub repo materialization helper
- repository context collection
- remediation worker scaffold
- `generateSubmissionRemediationPlan` server entrypoint

This is enough to start a real remediation run from the backend and produce a structured proposal payload.

## Known Gaps

- no UI wiring for the new remediation entrypoint yet
- no persisted remediation run record yet
- no approval/apply flow yet
- no typed ASC write tools for app info URLs or pricing yet
- no async worker queue yet

## Design Rationale

This design deliberately avoids introducing a separate planner service. The worker receives normalized issues, raw ASC errors, current metadata, and repo identity, then decides how to construct a proposal. That keeps the system simple while still preserving the most important safety boundary: repository and ASC access remain server-owned, and ASC writes remain outside the proposal phase.
