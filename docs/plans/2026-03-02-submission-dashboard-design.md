# Submission Dashboard Refresh Design

**Date:** March 2, 2026

**Goal**

Refresh the submission detail screen so it reads as a release operations dashboard instead of a collection of incomplete cards. The updated flow should emphasize the current release state, surface health and monitoring context in the right rail, and remove low-value CTAs that do not match the app's present scope.

**Problem**

The current screen has the correct broad structure, but the experience feels unfinished:
- the hero card does not clearly establish the release state as the primary focus
- the right rail spends too much space on controls that are not useful in the current product scope
- informational system status is spread across the page instead of grouped into a clear monitoring flow

**Design Direction**

Use the existing dark glass visual system, but tighten the hierarchy and density. The screen should feel like a monitoring console for a single release:
- stronger hero typography and status treatment
- compact operational status strip below the hero message
- denser, more useful right rail with informational modules instead of actions
- timeline styling that feels more deliberate and lifecycle-oriented

## Layout

Keep the existing high-level composition:
- top application header with icon, app name, version selector, notifications, and avatar
- two-column content area beneath the header
- larger left column for primary release context
- narrower right rail for supporting monitoring context

This preserves the route structure and avoids unnecessary navigation changes.

## Hero Section

The hero becomes the anchor of the page and should include:
- current release label
- prominent status pill derived from the current App Store version state
- automation state shown as a paired badge or inline label
- a clear "Next Action" summary sentence
- last checked / last event timestamp copy
- a compact operational strip for GitHub connection, watched branch, CI/build status, and App Store status

The hero should feel more intentional than the current card, with clearer separation between the main message and supporting system indicators.

## Right Rail

Replace the current CTA-driven rail with a monitoring stack:

### Automation

Keep repository context, watched branch, and connection state. This card explains what automation is attached to the release without prompting action-heavy workflows.

### Health Check

Replace the current button stack with an informational card. For now it should display mocked values where integrations are missing.

Planned rows:
- App Store status
- Last merge to `main`
- Last released build
- Automation heartbeat / latest sync

These are informational only. No retry, reconnect, resubmit, or disable controls belong in this module.

### Automation Activity

Retain the recent activity list, but tighten spacing and presentation so it reads as an event summary rather than a placeholder log.

### Raw App Store Response

Keep the diagnostic payload view as a lower-priority support panel.

## Timeline

Retain the existing release timeline on the left column, but restyle it to feel closer to a lifecycle progression:
- clearer distinction between completed, active, warning, and error states
- more readable event rows
- consistent spacing and connector treatment

The timeline remains event-driven and based on the existing release timeline data.

## Data Model

### Real Data

Use existing route loader data for:
- app name and icon
- version selector options
- App Store submission status
- rejection state
- GitHub repository and watched branch
- release timeline events
- derived activity feed
- raw App Store response panel

### Mocked For Now

Render mocked informational values for fields not yet integrated:
- last merge to `main`
- last released build
- richer health check timestamps where no source exists yet

The component structure should allow these mocked fields to later switch to real data with a fallback path if integrations fail.

## Component Strategy

Avoid introducing broad new abstractions prematurely. This refresh can be implemented inside the existing submission routes with small helper extraction only where it improves readability or testability.

Expected touch points:
- `src/routes/apps/$appId/submissions/_header/route.tsx`
- `src/routes/apps/$appId/submissions/_header/$versionId/index.tsx`
- `src/styles.css`

If the hero or health check logic becomes unwieldy, extract small presentational helpers or data-formatting helpers rather than creating a large component system.

## Accessibility

Preserve semantic structure and readable contrast:
- maintain text contrast within glass cards
- keep status indicators paired with text, not color alone
- ensure timeline and health check rows are readable at smaller widths
- preserve keyboard usability for the version selector and scrollable panels

## Testing

The refresh is mostly presentational, but the new derived informational blocks should be testable through helper functions where possible. Prefer testing any extracted formatting or mocked health check data assembly over brittle snapshot-heavy route tests.

## Out of Scope

The following are explicitly out of scope for this change:
- live GitHub merge data integration
- live build release integration
- automation control workflows
- inline metadata editing
- new backend endpoints

## Success Criteria

This refresh is successful when:
- the page immediately communicates the current release state
- the right rail feels useful without relying on action buttons
- the health check surfaces the missing operational context requested by product
- the new mocked fields are clearly structured for later integration
