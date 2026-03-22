export type AscErrorCategory = 'auth' | 'connection' | 'api'

export interface AscErrorEntry {
  code: string
  title: string
  detail: string
  source?: { pointer?: string }
}

export interface AscError {
  category: AscErrorCategory
  message: string
  statusCode?: number
  method?: string
  path?: string
  entries?: AscErrorEntry[]
}

export function parseAscError(status: number, responseText: string): AscError {
  let detail: string | undefined
  let entries: AscErrorEntry[] | undefined

  try {
    const body = JSON.parse(responseText) as { errors?: Array<Record<string, unknown>> }
    if (Array.isArray(body.errors)) {
      entries = body.errors.map((entry) => ({
        code: (entry.code as string) ?? '',
        title: (entry.title as string) ?? '',
        detail: (entry.detail as string) ?? '',
        source: entry.source as { pointer?: string } | undefined,
      }))
      detail = entries[0]?.detail
    }
  } catch {
    // Ignore parse failures and fall back to status-based messages.
  }

  if (status === 401 || status === 403) {
    return {
      category: 'auth',
      message: detail ?? 'API key may be invalid or expired',
      statusCode: status,
      entries,
    }
  }

  if (status >= 500) {
    return {
      category: 'connection',
      message: detail ?? 'App Store Connect is temporarily unavailable',
      statusCode: status,
      entries,
    }
  }

  return {
    category: 'api',
    message: detail ?? `App Store Connect returned an error (${status})`,
    statusCode: status,
    entries,
  }
}

export function networkError(): AscError {
  return {
    category: 'connection',
    message: 'Could not connect to App Store Connect',
  }
}
