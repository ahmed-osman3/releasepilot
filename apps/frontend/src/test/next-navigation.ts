export function useRouter() {
  return {
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
    prefetch: async () => undefined,
    back: () => undefined,
    forward: () => undefined,
  }
}

export function useSearchParams() {
  return new URLSearchParams()
}

export function usePathname() {
  return '/'
}

export function useParams() {
  return {}
}
