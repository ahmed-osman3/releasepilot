'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BadgeCheck,
  CheckCircle2,
  Github,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Package,
  Upload,
  UserRound,
  XCircle,
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  canAdvanceFromTeamName,
  hasAscFormFields,
  resolveGithubInstallStatus,
} from './onboarding-state'

const WIZARD_STEPS = 3

type TestStatus = 'idle' | 'testing' | 'ok' | 'error'

export default function OnboardingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [teamName, setTeamName] = useState('My team')
  const [issuerId, setIssuerId] = useState('')
  const [keyId, setKeyId] = useState('')
  const [keyIdFromFile, setKeyIdFromFile] = useState(false)
  const [privateKey, setPrivateKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [ascError, setAscError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {
      'application/pkcs8': ['.p8'],
      'text/plain': ['.p8'],
    },
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) return
      handleKeyFileUpload(file)
    },
  })

  const githubStatus = useMemo(
    () => resolveGithubInstallStatus(searchParams),
    [searchParams],
  )

  useEffect(() => {
    if (githubStatus.kind === 'installed') {
      setStep(3)
    }
  }, [githubStatus.kind])

  async function testConnection(
    nextIssuerId: string,
    nextKeyId: string,
    nextPrivateKey: string,
  ) {
    setTestStatus('testing')
    setTestError('')
    setAscError(null)

    try {
      const response = await fetch('/api/apps/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerId: nextIssuerId,
          keyId: nextKeyId,
          privateKey: nextPrivateKey,
        }),
      })

      if (response.ok) {
        setTestStatus('ok')
        return
      }

      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      setTestStatus('error')
      setTestError(data.error ?? 'Connection failed')
    } catch {
      setTestStatus('error')
      setTestError('Network error')
    }
  }

  async function connectAscKey() {
    setSubmitting(true)
    setAscError(null)

    try {
      const response = await fetch('/api/apps/connect-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerId: issuerId.trim(),
          keyId: keyId.trim(),
          privateKey: privateKey.trim(),
        }),
      })

      const result = (await response.json()) as {
        success?: boolean
        error?: string
      }

      if (!response.ok || !result.success) {
        setAscError(result.error ?? 'Connection failed')
        return
      }

      setStep(3)
    } catch {
      setAscError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  function resetAscTestState() {
    if (testStatus !== 'idle') {
      setTestStatus('idle')
      setTestError('')
    }
  }

  function handleKeyFileUpload(file: File) {
    if (!file) return

    setKeyError(null)
    setAscError(null)
    resetAscTestState()
    setPrivateKey('')
    setKeyId('')
    setKeyIdFromFile(false)

    void file
      .text()
      .then((text) => {
        const trimmed = text.trim()

        if (
          !trimmed.startsWith('-----BEGIN PRIVATE KEY-----') ||
          !trimmed.endsWith('-----END PRIVATE KEY-----')
        ) {
          setKeyError(
            'Invalid key file - expected a .p8 private key from Apple.',
          )
          return
        }

        setPrivateKey(trimmed)

        const match = file.name.match(/AuthKey_([A-Z0-9]+)\.p8/)
        if (match) {
          const resolvedKeyId = match[1]
          setKeyId(resolvedKeyId)
          setKeyIdFromFile(true)

          if (issuerId.trim()) {
            void testConnection(issuerId.trim(), resolvedKeyId, trimmed)
          }
        }
      })
      .catch(() => {
        setKeyError('Failed to read key file.')
      })
  }

  function canAdvance(): boolean {
    if (step === 0) return true
    if (step === 1) return canAdvanceFromTeamName(teamName)
    if (step === 2) {
      return (
        hasAscFormFields({ issuerId, keyId, privateKey }) &&
        testStatus === 'ok' &&
        !submitting
      )
    }
    return true
  }

  async function handleNext() {
    if (step === 2) {
      if (testStatus !== 'ok') return
      await connectAscKey()
      return
    }

    if (step < WIZARD_STEPS) {
      setStep(step + 1)
      return
    }

    if (githubStatus.kind === 'installed') {
      router.push('/apps/add')
    } else {
      router.push('/apps')
    }
    router.refresh()
  }

  const isWelcome = step === 0

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            {step === 0 && <Package className="size-8" />}
            {step === 1 && <UserRound className="size-8" />}
            {step === 2 && <KeyRound className="size-8" />}
            {step === 3 && <Github className="size-8" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center">
            {step === 0 && 'Welcome to ReleasePilot'}
            {step === 1 && 'Developer account'}
            {step === 2 && 'App Store Connect'}
            {step === 3 && 'GitHub App'}
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            {step === 0 && 'Release management workspace for App Store teams'}
            {step === 1 && 'Name your developer account to get started.'}
            {step === 2 && 'Set up credentials to access your App Store apps.'}
            {step === 3 &&
              'Install GitHub App to connect repositories and branches (optional).'}
          </p>
        </div>

        {!isWelcome && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: WIZARD_STEPS }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 === step
                    ? 'w-8 bg-primary'
                    : i + 1 < step
                      ? 'w-4 bg-primary/40'
                      : 'w-4 bg-muted'
                }`}
              />
            ))}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-4">
            <ul className="flex w-fit flex-col items-start gap-3 text-sm text-muted-foreground mx-auto">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                Manage App Store releases and submissions in one place
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                Connect your App Store credentials and GitHub repositories
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
                Guided onboarding with clear setup steps
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 size-4 shrink-0 text-green-600" />
                Credentials are encrypted at rest
              </li>
            </ul>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Team name</label>
              <Input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canAdvance()) {
                    void handleNext()
                  }
                }}
                placeholder="My team"
                className="text-sm"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This label is used only during onboarding for now.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Go to{' '}
                  <a
                    href="https://appstoreconnect.apple.com/access/integrations/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    App Store Connect - Integrations - Team keys
                  </a>{' '}
                  and generate a key with Admin access.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Issuer ID</label>
              <Input
                value={issuerId}
                onChange={(event) => {
                  setIssuerId(event.target.value)
                  setAscError(null)
                  resetAscTestState()
                }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Private key (.p8)
              </label>
              <div
                {...getRootProps()}
                className={`rounded-md border px-3 py-3 text-sm cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:border-primary/40'
                }`}
              >
                <input
                  {...getInputProps({
                    onClick: (event) => {
                      ;(event.currentTarget as HTMLInputElement).value = ''
                    },
                  })}
                />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Upload className="size-4" />
                  <span>Drop .p8 here or click to choose file</span>
                </div>
              </div>
              {keyError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <XCircle className="size-3.5" />
                  {keyError}
                </p>
              )}
              {privateKey && !keyError && keyIdFromFile && (
                <>
                  {testStatus === 'idle' && (
                    <p className="text-xs text-muted-foreground">
                      Key loaded - key ID{' '}
                      <span className="font-mono">{keyId}</span>.
                      {issuerId.trim()
                        ? ' Click test connection to verify.'
                        : ' Enter issuer ID to start connection test.'}
                    </p>
                  )}
                  {testStatus === 'testing' && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Testing connection...
                    </p>
                  )}
                  {testStatus === 'ok' && (
                    <p className="flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle2 className="size-3.5" />
                      Connected - key ID{' '}
                      <span className="font-mono">{keyId}</span>
                    </p>
                  )}
                  {testStatus === 'error' && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <XCircle className="size-3.5" />
                      {testError || 'Connection failed'}
                    </p>
                  )}
                </>
              )}
              {privateKey && !keyError && !keyIdFromFile && (
                <p className="text-xs text-muted-foreground">
                  Key loaded. Enter the key ID below to continue.
                </p>
              )}
            </div>

            {privateKey && !keyIdFromFile && !keyError && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Key ID</label>
                <Input
                  value={keyId}
                  onChange={(event) => {
                    setKeyId(event.target.value)
                    setAscError(null)
                    resetAscTestState()
                  }}
                  placeholder="XXXXXXXXXX"
                  className="font-mono text-sm"
                />
                {testStatus === 'testing' && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Testing connection...
                  </p>
                )}
                {testStatus === 'ok' && (
                  <p className="flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle2 className="size-3.5" />
                    Connected - key ID{' '}
                    <span className="font-mono">{keyId}</span>
                  </p>
                )}
                {testStatus === 'error' && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <XCircle className="size-3.5" />
                    {testError || 'Connection failed'}
                  </p>
                )}
              </div>
            )}

            {(testStatus === 'idle' || testStatus === 'error') &&
              hasAscFormFields({ issuerId, keyId, privateKey }) && (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-4 hover:underline"
                  onClick={() =>
                    void testConnection(
                      issuerId.trim(),
                      keyId.trim(),
                      privateKey,
                    )
                  }
                >
                  Test connection
                </button>
              )}

            {ascError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <XCircle className="size-3.5" />
                {ascError}
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                Install the GitHub App to connect repositories and select
                branches. You can skip this for now.
              </p>
            </div>

            <a
              href="/api/github/install/start?returnTo=%2Fonboarding"
              className="inline-block"
            >
              <Button className="gap-2">
                <Github className="size-4" />
                Install GitHub App
              </Button>
            </a>

            {githubStatus.kind === 'installed' && (
              <p className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="size-3.5" />
                GitHub App installed
              </p>
            )}
            {githubStatus.kind === 'failed' && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <XCircle className="size-3.5" />
                {githubStatus.message ?? 'GitHub installation failed'}
              </p>
            )}
            {githubStatus.kind === 'auth_required' && (
              <p className="text-xs text-muted-foreground">
                Authentication is required before installing GitHub App.
              </p>
            )}

            <Link href="/apps" className="inline-block">
              <Button variant="ghost" size="sm">
                Skip app mapping for now
              </Button>
            </Link>
          </div>
        )}

        <div
          className={`flex items-center gap-2 ${isWelcome ? 'justify-center' : 'justify-end'}`}
        >
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              disabled={submitting || testStatus === 'testing'}
            >
              Back
            </Button>
          )}
          <Button
            onClick={() => void handleNext()}
            disabled={!canAdvance() || submitting || testStatus === 'testing'}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : step === WIZARD_STEPS ? (
              'Finish'
            ) : step === 0 ? (
              'Get started'
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
