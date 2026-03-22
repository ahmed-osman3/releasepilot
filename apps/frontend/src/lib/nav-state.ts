const LAST_APP_KEY = "releasepilot:last-app-id"

export function getLastAppId(): string | undefined {
  if (typeof window === "undefined") return undefined

  try {
    const value = window.localStorage.getItem(LAST_APP_KEY)
    return value ?? undefined
  } catch {
    return undefined
  }
}

export function setLastAppId(appId: string): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(LAST_APP_KEY, appId)
  } catch {
    // ignore storage failures
  }
}
