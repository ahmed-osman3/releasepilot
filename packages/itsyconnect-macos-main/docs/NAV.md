# Navigation persistence

How the app remembers where the user was across restarts.

## Flow on app launch

1. Electron loads `/`
2. `proxy.ts` checks `/api/health` – if setup needed → `/setup`, otherwise → `/dashboard?entry=1`
3. `NavigationTracker` (in dashboard layout) calls `saveNavigation()` on every route change
4. `saveNavigation` **skips** any URL with `entry=1` param – this is a transient startup redirect, not a real user navigation
5. Dashboard page detects `entry=1` and runs the entry redirect effect:
   - Reads `getLastUrl()` from localStorage
   - If saved URL is exactly `/dashboard` → stay on portfolio (user explicitly chose it)
   - If saved URL is `/dashboard/apps/{id}/...` and app ID is valid → restore it
   - If no saved URL (first launch, after setup) → go to first app's overview
   - If saved app ID is invalid (deleted app) → go to first app's overview

## Flow after setup

1. Setup page does `router.push("/dashboard?entry=1")`
2. No URL has been saved yet (localStorage is empty for nav-state)
3. Entry redirect: `getLastUrl()` returns `undefined` → fallback to `/dashboard/apps/{firstApp}`

## localStorage structure

```json
{
  "lastUrl": "/dashboard/apps/123/reviews",
  "lastAppId": "123",
  "apps": {
    "123": "/reviews",
    "456": "/testflight"
  }
}
```

- **`lastUrl`** – last URL the user navigated to (any `/dashboard` path). Used by entry redirect to restore location.
- **`lastAppId`** – last app the user viewed. Used by sidebar to show app nav even when on portfolio page.
- **`apps`** – per-app sub-path memory. When switching apps via the app switcher, restores the last sub-page within that app.

## Key files

- **`src/lib/nav-state.ts`** – read/write localStorage, `saveNavigation`, `getLastUrl`, `getLastAppId`, `getAppState`
- **`src/app/dashboard/layout.tsx`** – `NavigationTracker` component that calls `saveNavigation` on every route change
- **`src/app/dashboard/page.tsx`** – entry redirect effect (the `isEntry` useEffect)
- **`src/proxy.ts`** – initial redirect from `/` to `/dashboard?entry=1` or `/setup`
- **`src/components/layout/app-sidebar.tsx`** – uses `getLastAppId()` to show sidebar nav when on portfolio

## Rules

- Never save URLs with `entry=1` – they're transient startup redirects
- Portfolio (`/dashboard`) is saved like any other URL when the user navigates there
- `lastAppId` is only updated when visiting an app page, never cleared by visiting portfolio
- The entry redirect only runs when `entry=1` is present – normal navigation to `/dashboard` renders the portfolio directly
