'use client'

import { useState } from 'react'
import { ArrowRight, Github, Shield, Sparkles } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export default function AuthClient() {
  const [error, setError] = useState<string | null>(null)

  const signInWithGithub = async () => {
    setError(null)
    try {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/onboarding',
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'GitHub auth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
      )
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a1221]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[320px] w-[320px] rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white backdrop-blur-xl lg:p-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
              <Sparkles className="size-3.5" />
              ReleasePilot
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
              Ship App Store releases with less firefighting.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-cyan-50/80 lg:text-base">
              Connect App Store Connect and GitHub once, then manage submission
              loops, rejection fixes, and release signals from one place.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Feature
                title="GitHub App Ready"
                text="Installation and repo mapping are built into onboarding."
              />
              <Feature
                title="Traceable Automation"
                text="Every action and status change is visible in the timeline."
              />
            </div>
          </section>

          <section className="rounded-3xl border border-white/15 bg-slate-950/75 p-7 text-white shadow-2xl shadow-black/30 backdrop-blur-xl lg:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
              Sign In
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Continue with GitHub
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Use your GitHub account to access and configure your release
              workspace.
            </p>

            <Button
              onClick={signInWithGithub}
              className="mt-6 h-11 w-full justify-between rounded-xl bg-white text-slate-900 hover:bg-slate-100"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Github className="size-4" />
                Sign in with GitHub
              </span>
              <ArrowRight className="size-4" />
            </Button>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2.5 text-xs text-emerald-100">
              <Shield className="mt-0.5 size-3.5 shrink-0" />
              Session-protected routes: apps and API actions require
              authentication.
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-cyan-100/80">{text}</p>
    </div>
  )
}
