# Review Submissions Pivot PRD

**Date:** March 3, 2026

**Owner:** Release Pilot

## Summary

Release Pilot will replace its deprecated App Store submission model with App Store Connect's `reviewSubmissions` domain. Instead of treating an App Store version as the primary submission object, the product will treat a review submission as the primary release-review entity and attach version data as related context.

This is not a thin API swap. The current version-centric contract is redundant, incomplete, and does not reflect how the newer App Store Connect workflow behaves. Release Pilot should pivot its server and route contracts so review-submission state, identity, and actions are modeled directly.

## Problem

The current implementation is built around deprecated submission routes and a version-first mental model:
- submission reads are derived from deprecated endpoints
- submission writes assume a version can be submitted directly
- route params and server contracts use `versionId` as the primary identifier
- the newer `reviewSubmissions` flow is not represented as a first-class concept

This creates several product and engineering problems:
- the implementation does not match the current App Store Connect review workflow
- the contract hides important distinctions between app versions and review submissions
- submission behavior is brittle because the old model no longer works reliably
- future review actions will be harder to add if the deprecated abstraction remains in place

## Product Goal

Deliver a release review workspace that uses `reviewSubmissions` as the primary domain model while still exposing related app version data needed for operator context and metadata workflows.

The product should let an operator:
- view review submissions for a connected app
- open a single review submission workspace
- inspect review-submission state and related app version state together
- submit an existing review submission or create one when needed
- continue using related version metadata editing flows where applicable
- track actions and state changes against the review submission lifecycle

## Target User

Primary user: iOS engineers operating App Store releases through Release Pilot.

These users need:
- accurate representation of App Store Connect review state
- confidence that manual actions map to real ASC behavior
- a clear distinction between release version data and review-submission state
- stable identifiers for current and future review workflows

## Non-Goals

This phase will not include:
- support for every historical review submission edge case in the UI
- redesigning the entire release console experience
- introducing background automation or orchestration
- changing metadata editing to operate on a new domain model beyond the required relationship lookup
- removing app version data from the product entirely

## User Story

As an iOS engineer, I want Release Pilot to represent App Store review work using real `reviewSubmissions` so that submission actions, state inspection, and follow-up operations match App Store Connect's current behavior.

## Product Requirements

### 1. Review Submission Becomes the Primary Domain

Release Pilot must treat `reviewSubmissions` as the source of truth for review workflow state and submission actions.

Requirements:
- server reads for the release review workspace must be based on `reviewSubmissions`
- server writes must submit through `reviewSubmissions` semantics
- deprecated submission endpoints must no longer drive release-review behavior

### 2. New Server Contract

The current `submissions` contract based on raw app versions may change.

Requirements:
- the server must expose a normalized review-submission view model
- each item must include the review submission id
- each item must include related app version context when available
- rejection detail should still be attached when it can be resolved from related version review detail
- route loaders should consume normalized review-submission data rather than raw ASC response objects

Expected normalized fields:
- `id`
- `state`
- `submittedDate`
- `platform`
- related `appStoreVersion`
- related `rejectionReason`

### 3. Route and Identifier Pivot

The review workspace must pivot from `versionId` to `reviewSubmissionId` as its primary route parameter.

Requirements:
- submission detail routes should key off `reviewSubmissionId`
- any action that still needs version metadata must read the related version id from the selected review submission
- navigation logic must stop assuming the current page identity is always a version id

### 4. Review Submission Actions

Manual actions must map to the new review-submission model.

Requirements:
- submit actions must operate on a review submission id
- if no eligible review submission exists, the server may create one using app-level context before submitting
- successful writes must return enough data for the UI to navigate or refresh against the correct review submission
- failures must surface explicit ASC error messages where possible

### 5. Related Version Context Remains Available

The operator still needs version-specific context in the workspace.

Requirements:
- show related app version id and version string when available
- preserve metadata editing by resolving the related app version from the selected review submission
- preserve rejection-note lookup through the related version review detail flow until a better source exists

### 6. Timeline Continuity

Release Pilot must continue to log meaningful release-review actions and responses.

Requirements:
- timeline events should remain coherent through the domain pivot
- event logging may continue to include related version ids when needed for continuity
- new actions should be attributable to the relevant review submission and, where applicable, its related version

## UX Requirements

The release console should present the review submission as the primary unit of work.

Key UX principles:
- the current review object is explicit
- related version context is supporting information, not the primary identity
- operator actions map cleanly to visible review state
- the page avoids mixing deprecated and current review concepts

Primary page sections should continue to support:
- review status
- operator actions
- timeline
- rejection or diagnostic detail
- metadata fix surface tied to the related version

## Functional Flow

### Load

On page load, the app must:
- resolve the connected app
- fetch review submissions for that app
- normalize the selected review submission into a UI-safe contract
- resolve related app version data for display
- resolve rejection detail from the related version when applicable
- load timeline data for the current workspace

### Submission

When the operator submits for review:
- resolve the target review submission
- create a review submission first if required
- submit the review submission through the new ASC flow
- log success or failure
- refresh the workspace using the review submission id

### Refresh

When the operator refreshes status:
- fetch current review-submission state from App Store Connect
- refresh related version context if needed
- detect meaningful state changes
- log timeline events for state changes or failures

### Metadata Fix

When the operator edits metadata:
- resolve the related app version from the selected review submission
- patch metadata through the existing version-localization flow
- log the action and refresh affected workspace data

## Success Criteria

This phase is successful when:
- deprecated submission endpoints no longer drive release-review behavior
- the review workspace is keyed by `reviewSubmissionId`
- operators can inspect and submit real review submissions through Release Pilot
- related version data still powers metadata fixes and rejection context
- the server exposes a stable normalized contract for review submissions
- the product behavior matches App Store Connect's current review model closely enough to support future review workflows

## Open Items For Next Phase

The next phase can extend this foundation with:
- explicit handling for apps with multiple concurrent or historical review submissions
- cancellation and other review-submission lifecycle actions
- richer distinction between review-submission state and app-version release state in the UI
- deeper diagnostics for review submission items and included relationships
- removal of now-obsolete version-first helper functions once the pivot is complete
