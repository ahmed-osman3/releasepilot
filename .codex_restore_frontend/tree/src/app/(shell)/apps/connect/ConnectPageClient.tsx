'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Key, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function ConnectPageClient() {
  const router = useRouter()
  const [issuerId, setIssuerId] = useState('')
  const [keyId, setKeyId] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!issuerId.trim() || !keyId.trim() || !privateKey.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
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
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (result.error || !result.success) {
        setError(result.error ?? 'Something went wrong.')
        return
      }
      router.push('/apps')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <div className="max-w-xl mx-auto">
        <Link
          href="/apps"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3.5" />
          Back to Apps
        </Link>

        <div className="animate-fade-in-up">
          <div className="flex items-start gap-4 mb-8">
            <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Key className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">Connect API Key</h1>
              <p className="text-[13px] text-muted-foreground mt-1">
                Enter your App Store Connect API credentials
              </p>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="issuerId" className="text-[13px] text-foreground">
                  Issuer ID
                </Label>
                <Input
                  id="issuerId"
                  value={issuerId}
                  onChange={(e) => setIssuerId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="bg-background/50 border-border/60 text-foreground placeholder:text-muted-foreground/50 h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyId" className="text-[13px] text-foreground">
                  Key ID
                </Label>
                <Input
                  id="keyId"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  placeholder="XXXXXXXXXX"
                  className="bg-background/50 border-border/60 text-foreground placeholder:text-muted-foreground/50 h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="privateKey" className="text-[13px] text-foreground">
                  Private Key (.p8)
                </Label>
                <Textarea
                  id="privateKey"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  rows={5}
                  className="bg-background/50 border-border/60 text-foreground placeholder:text-muted-foreground/50 font-mono text-[12px]"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-[12px] text-destructive-foreground">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Shield className="size-3" />
                  Encrypted with AES-256
                </div>
                <Button type="submit" disabled={loading} size="sm" className="gap-1.5">
                  {loading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Save & connect'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
