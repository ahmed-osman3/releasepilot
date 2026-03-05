import type { NormalizedAscError } from './fetch'

export type AscIssueCategory =
  | 'localization'
  | 'url'
  | 'pricing'
  | 'review_notes'
  | 'unknown'

export type AscIssueCode =
  | 'missing_localization'
  | 'missing_url'
  | 'pricing_required'
  | 'missing_review_notes'
  | 'unknown_submission_issue'

export type NormalizedAscIssue = {
  id: string
  category: AscIssueCategory
  code: AscIssueCode
  title: string
  detail: string
  blocking: boolean
  locale?: string
  field?: string
  sourcePointer?: string
  ascErrorCode?: string
}

function compactText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function buildIssueId(error: NormalizedAscError, index: number): string {
  return error.id?.trim() || `asc-issue-${index + 1}`
}

function detectCategory(text: string, pointer: string): AscIssueCategory {
  if (
    pointer.includes('localization') ||
    text.includes('localization') ||
    text.includes('description') ||
    text.includes('keywords') ||
    text.includes("what's new") ||
    text.includes('promotional text')
  ) {
    return 'localization'
  }

  if (
    pointer.includes('url') ||
    text.includes('url') ||
    text.includes('website') ||
    text.includes('support') ||
    text.includes('privacy policy') ||
    text.includes('privacy url') ||
    text.includes('marketing url')
  ) {
    return 'url'
  }

  if (
    pointer.includes('price') ||
    text.includes('price') ||
    text.includes('pricing') ||
    text.includes('cleared for sale')
  ) {
    return 'pricing'
  }

  if (text.includes('review note') || text.includes('review notes')) {
    return 'review_notes'
  }

  return 'unknown'
}

function detectCode(
  category: AscIssueCategory,
  text: string,
  pointer: string,
): AscIssueCode {
  if (category === 'localization') return 'missing_localization'
  if (category === 'url') return 'missing_url'
  if (category === 'pricing') return 'pricing_required'
  if (category === 'review_notes') return 'missing_review_notes'

  if (pointer.includes('pricing') || text.includes('pricing')) {
    return 'pricing_required'
  }

  return 'unknown_submission_issue'
}

function detectField(text: string, pointer: string): string | undefined {
  const haystack = `${pointer} ${text}`

  if (haystack.includes('privacy')) return 'privacyPolicyUrl'
  if (haystack.includes('support')) return 'supportUrl'
  if (haystack.includes('marketing')) return 'marketingUrl'
  if (haystack.includes('keyword')) return 'keywords'
  if (haystack.includes('promotional')) return 'promotionalText'
  if (haystack.includes("what's new") || haystack.includes('whats new')) {
    return 'whatsNew'
  }
  if (haystack.includes('description')) return 'description'
  if (haystack.includes('price')) return 'priceSchedule'
  if (haystack.includes('review note')) return 'reviewNotes'

  return undefined
}

function maybeExtractLocale(text: string): string | undefined {
  const localeMatch = text.match(/\b[a-z]{2}(?:-[A-Z]{2})\b/)
  return localeMatch?.[0]
}

export function normalizeAscIssues(
  errors: Array<NormalizedAscError>,
): Array<NormalizedAscIssue> {
  return errors.map((error, index) => {
    const title = error.title?.trim() || 'App Store Connect issue'
    const detail = error.detail?.trim() || title
    const pointer =
      typeof error.source?.pointer === 'string' ? error.source.pointer : ''
    const text = compactText(`${title} ${detail}`)
    const normalizedPointer = compactText(pointer)
    const category = detectCategory(text, normalizedPointer)
    const code = detectCode(category, text, normalizedPointer)

    return {
      id: buildIssueId(error, index),
      category,
      code,
      title,
      detail,
      blocking: true,
      locale: maybeExtractLocale(detail) ?? maybeExtractLocale(title),
      field: detectField(text, normalizedPointer),
      sourcePointer: pointer || undefined,
      ascErrorCode: error.code,
    }
  })
}
