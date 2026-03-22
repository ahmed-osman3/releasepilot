# App Store Connect Error Timeline Design

**Date:** 2026-03-03

## Goal

Make App Store Connect submission failures readable inside the release timeline, while restoring the missing automation and metadata context in the submission workspace sidebar.

## Problem

The current submit flow collapses App Store Connect errors into a single string in the fetch layer. That loses the top-level Apple error metadata and any `meta.associatedErrors`, so the client cannot explain why a submission failed.

The timeline persistence is only partially useful in the current UI. The server logs `SUBMISSION_REQUESTED` and `ASC_REQUEST_FAILED`, but the page does not reliably refresh timeline data after a failed submit, so the operator does not immediately see the new failure event.

The submission workspace also dropped app-level context that already exists in the data layer. The detail route no longer carries the repo, watched branch, installation, and related automation context into the right-side panel, which makes the workspace feel detached from the automation goal of the product.

## User Experience

### Timeline as the primary error surface

Submission and resubmission attempts remain part of the release timeline:

- Submit click writes `SUBMISSION_REQUESTED`
- Resubmit click writes `RESUBMISSION_REQUESTED`
- Successful ASC response writes `SUBMISSION_ACCEPTED`
- Failed ASC response writes `ASC_REQUEST_FAILED`

The failure event is shown inline in the timeline with:

- a short title such as `Submission failed`
- a one-line preview based on the top-level ASC summary
- an expand/collapse control on that timeline row

When expanded, the same timeline row shows:

- top-level ASC status, code, title, and detail
- a structured list of associated errors
- contextual labels derived from error source or metadata when present
- an optional raw JSON disclosure for debugging

This removes the split between a transient banner and a separate detail surface. The operator can read the full failure in the same chronological place where the action happened.

### Sidebar context restoration

The right-side panel should again support the automation-oriented workflow instead of acting only as a raw response bucket. It should show:

- app identity context
- repo and watched branch metadata
- GitHub installation presence
- recent activity derived from timeline events
- metadata editing controls when the version is editable

The raw App Store response section is no longer the primary place for submit failures. Rejection detail can still live in the side panel when useful, but submit errors belong in the timeline.

## Data Model

### Structured ASC errors

Introduce a normalized App Store Connect error shape that preserves:

- `id`
- `status`
- `code`
- `title`
- `detail`
- `source`
- `meta`
- normalized `associatedErrors`

The fetch layer should return this structured payload instead of immediately reducing errors to a single string.

### Timeline event payloads

`release_timeline_events` currently stores only `detail`. That is enough for previews but not enough for expandable structured failures. Add a nullable JSON payload column for event metadata so failure events can store the normalized ASC error object.

Expected usage:

- `detail` stores the short preview text used in collapsed timeline rows
- `payload` stores the structured error body used by expanded timeline rows

Non-error events can leave `payload` null.

## Server Flow

### Fetch layer

`ascFetch` should parse all ASC errors into a normalized collection and return:

- `error`: human-readable summary string for simple callers
- `errors`: structured normalized errors for richer callers

### Submit flow

`submitReviewSubmissionServer` should:

1. log the requested submission event before the ASC mutation
2. call ASC
3. on success, log `SUBMISSION_ACCEPTED`
4. on failure, compute a compact preview string and log `ASC_REQUEST_FAILED` with both:
   - `detail`: preview string
   - `payload`: structured normalized ASC error object
5. return the structured error to the client

### Metadata flow

Metadata update failures can continue using the same structured error path where applicable, but the immediate priority is submission and resubmission failures.

## Client Flow

### Immediate timeline refresh

After submit or resubmit, the route should invalidate regardless of success or failure so the newly written timeline row appears immediately.

### Expandable timeline failures

The timeline item model should accept optional structured payload data. For `ASC_REQUEST_FAILED` rows:

- collapsed state shows headline + preview
- expanded state shows the full structured breakdown

Expansion state can be local UI state keyed by timeline event id.

### Error banner behavior

The current top action banner should not be the primary failure surface for ASC submit errors. It can be removed or reduced to a minimal fallback for unexpected client-side exceptions.

## Testing

Add coverage for:

- ASC error normalization, including nested `associatedErrors`
- submit flow logging a requested event then a failed event with structured payload
- client rendering of collapsed and expanded timeline failure rows
- route invalidation after failed submit so timeline updates are visible immediately
- restored sidebar context rendering from loader data

## Risks

- Existing timeline rows have no payload and must continue rendering cleanly
- ASC error shapes are inconsistent, so normalization must be defensive
- Adding a JSON payload column requires a migration and careful typing in Drizzle

## Out of Scope

- broad unification of every server error shape in the app
- redesigning the full submission workspace layout beyond the timeline-first error handling and sidebar context restoration
