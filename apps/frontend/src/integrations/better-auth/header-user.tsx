import { authClient } from '@/lib/auth-client'
import { useNavigate } from '@tanstack/react-router'

export default function BetterAuthHeader() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="h-8 w-full rounded-lg bg-muted/50 animate-pulse" />
    )
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2.5">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="size-7 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="size-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-[11px] font-semibold text-primary">
              {session.user.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-foreground truncate leading-tight">
            {session.user.name || 'User'}
          </p>
          <button
            onClick={() => authClient.signOut()}
            className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      className="w-full h-8 text-[12px] font-medium rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
      onClick={() => navigate({ to: '/auth' })}
    >
      Sign in
    </button>
  )
}
