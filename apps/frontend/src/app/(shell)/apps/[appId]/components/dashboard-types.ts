import type { ReleaseTimelineEventType } from '@/lib/release-timeline-events'

export type DashboardTone = 'ok' | 'warn' | 'error'

export type DashboardTimelineItem = {
  id: number
  eventType: ReleaseTimelineEventType
  title: string
  detail: string
  when: string
  status: DashboardTone
}

export type DashboardViewModel = {
  appName: string
  appIdentifier: string
  appInitial: string
  iconUrl: string | null
  statusLabel: string
  versionLabel: string
  branchLabel: string
  lastUpdatedLabel: string
  actionTitle: string
  actionDescription: string
  githubRepoLabel: string
  prLabel: string
  prStatusLabel: string
  filesChangedLabel: string
  githubUpdatedLabel: string
  buildLabel: string
  buildStatusLabel: string
  buildUpdatedLabel: string
  timelineItems: DashboardTimelineItem[]
  modeLabel: string
  lastRunLabel: string
}
