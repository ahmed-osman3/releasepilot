# Manual Release Console PRD

**Date:** March 3, 2026

**Owner:** Release Pilot

## Summary

Release Pilot will shift from an automation-first demo toward a manual release console for iOS engineers. Instead of background agents driving the release loop, the operator will manually trigger App Store Connect actions, inspect the resulting state, apply metadata fixes, and build a realistic release timeline from those actions and responses.

The first version will support real App Store Connect reads and writes for the latest editable version of a connected app. GitHub pull requests, build automation, and background orchestration remain out of scope for this phase.

## Problem

The current product framing emphasizes autonomous automation, but the implementation and demo need a more credible operational path first.

Today the product lacks a practical middle ground between:
- static mockups that do not prove workflow value
- full automation that requires more backend scope than the product is ready to support

iOS engineers evaluating Release Pilot need to see that the app can already serve as a useful release operations console:
- it should show the active App Store release clearly
- it should allow manual submission-related actions
- it should record what happened in a timeline
- it should expose real App Store feedback and support manual correction loops

## Product Goal

Deliver a manual release workspace for a connected app that lets an operator:
- view the latest editable App Store version as the active working release
- manually submit that version for review
- manually refresh and inspect App Store review state
- review rejection feedback and raw response details
- apply metadata fixes directly to App Store Connect
- resubmit after fixes
- build a persisted, believable timeline of release activity

## Target User

Primary user: iOS engineers responsible for preparing and shipping App Store releases.

These users value:
- operational clarity
- technical credibility
- direct visibility into App Store state
- explicit control over release actions
- auditability of what happened and when

## Non-Goals

This phase will not include:
- autonomous agents or background automation loops
- GitHub PR generation or merge tracking
- CI-triggered build watching
- automated code fixes
- multi-version release management
- historical read-only views for older versions

## User Story

As an iOS engineer, I want to manage the current App Store release manually from one workspace so I can submit, inspect feedback, apply metadata fixes, and track the release path without leaving the product.

## Product Requirements

### 1. Active Release Selection

For each connected app, Release Pilot must resolve and display only the latest editable App Store version as the active working release.

Requirements:
- the operator does not choose from multiple versions in this phase
- the active release is derived on page load
- older versions are not surfaced in the UI for now

### 2. Manual Release Workspace

The submission route should behave as a single release workspace for the active version.

The page should include:
- current release status
- next recommended operator action
- manual action controls
- release timeline
- raw App Store response or rejection detail
- metadata editing surface

### 3. Manual Operator Actions

The operator must be able to trigger the following actions directly:
- refresh release state from App Store Connect
- submit current version for review
- inspect rejection details
- apply metadata fixes
- resubmit after fixes

The UI must present these as explicit user actions, not automated system steps.

### 4. Real App Store Connect Reads and Writes

This phase must use real App Store Connect integration for:
- loading app versions
- determining the active editable version
- reading submission and review state
- reading rejection notes when available
- loading version localization metadata
- patching localization metadata
- submitting a version for review

### 5. Persisted Timeline

Every important manual action or meaningful App Store response should be logged into the timeline for the active version.

Examples:
- working version loaded
- submission requested
- submission accepted
- review feedback received
- metadata fix applied
- resubmission requested
- App Store request failed

The timeline must reflect actual user actions and real ASC responses rather than inferred automation events.

### 6. Error Handling

The product must handle App Store Connect failures explicitly.

Requirements:
- read failures on page load should show a recoverable error state
- write failures should surface the exact error message where possible
- failed operator actions should be eligible for timeline logging
- the UI should avoid optimistic success states for ASC writes

## UX Requirements

The product should read as a release operations console, not a marketing dashboard.

Key UX principles:
- one release in focus
- clear state hierarchy
- explicit operator control
- technical transparency
- timeline as the source of truth for what happened

Primary page sections:
- Release Status
- Operator Actions
- Timeline
- Raw App Store Response
- Metadata Fix Surface

## Functional Flow

### Load

On page load, the app must:
- resolve the connected app
- fetch App Store versions
- select the latest editable version
- fetch its metadata
- fetch its latest submission or review state
- load timeline events for that version

### Submission

When the operator submits for review:
- log the request event
- call App Store Connect submission API
- log either success or failure
- refresh visible release state

### Review Feedback Refresh

When the operator refreshes status:
- fetch current review or submission state from App Store Connect
- detect new feedback or changed state
- record a timeline event when new response data is observed
- update the release workspace

### Metadata Fix

When the operator edits metadata:
- patch the selected localization in App Store Connect
- log a metadata fix event with useful detail
- refresh visible metadata and release state

## Success Criteria

This phase is successful when:
- a connected app opens into one active release workspace without version selection
- an operator can manually submit the current version for review
- the app can refresh and display real App Store state and rejection feedback
- an operator can apply metadata fixes to App Store Connect
- the timeline tells a coherent story of release actions and responses
- the experience feels credible to iOS engineers evaluating the product

## Open Items For Next Phase

The next phase can extend this foundation with:
- read-only historical views for older versions
- GitHub PR creation and review tracking
- build detection after merge
- richer issue classification
- selective automation on top of the manual workflow
