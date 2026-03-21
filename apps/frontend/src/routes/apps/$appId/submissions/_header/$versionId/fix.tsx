import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  getAppSubmissions,
  getVersionMetadata,
  applyVersionMetadata,
  suggestRejectionFixServer,
  submitVersionForReviewServer,
} from '@/lib/apps/server'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { SuggestedLocaleEdits } from '@/lib/ai/suggest-rejection-fix'
import {
  ArrowLeft,
  Loader2,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export const Route = createFileRoute('/apps/$appId/submissions/_header/$versionId/fix')(
  {
    component: FixPage,
    loader: async ({ params }) => {
      const connectedAppId = Number(params.appId)
      const versionId = params.versionId
      if (Number.isNaN(connectedAppId)) {
        return {
          connectedAppId: 0,
          versionId: '',
          rejectionReason: null,
          localizations: [],
          error: 'Invalid app',
        }
      }
      const [subsResult, metaResult] = await Promise.all([
        getAppSubmissions({ data: { connectedAppId } }),
        getVersionMetadata({ data: { connectedAppId, versionId } }),
      ])
      const rejectionReason = subsResult.rejectionReasons?.[versionId] ?? null
      const localizations = metaResult.localizations ?? []
      const error = subsResult.error ?? metaResult.error
      return {
        connectedAppId,
        versionId,
        rejectionReason,
        localizations,
        error,
      }
    },
  },
)

function FixPage() {
  const router = useRouter()
  const { connectedAppId, versionId, rejectionReason, localizations, error } =
    Route.useLoaderData()

  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [, setSuggestedEdits] = useState<Record<string, SuggestedLocaleEdits>>(
    {},
  )
  const [editedValues, setEditedValues] = useState<
    Record<string, SuggestedLocaleEdits>
  >({})
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applySuccess, setApplySuccess] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentMetadata = localizations.map((loc) => ({
    localeId: loc.id,
    locale: loc.locale,
    description: loc.description,
    keywords: loc.keywords,
    promotionalText: loc.promotionalText,
    whatsNew: loc.whatsNew,
  }))

  const handleGetSuggestions = async () => {
    if (!rejectionReason) return
    setSuggestError(null)
    setSuggestLoading(true)
    try {
      const result = await suggestRejectionFixServer({
        data: {
          rejectionReason,
          currentMetadata,
        },
      })
      setExplanation(result.explanation)
      setSuggestedEdits(result.suggestedEdits)
      setEditedValues(JSON.parse(JSON.stringify(result.suggestedEdits)))
    } catch (err) {
      setSuggestError(
        err instanceof Error ? err.message : 'Failed to get suggestions',
      )
    } finally {
      setSuggestLoading(false)
    }
  }

  const updateEdit = (
    localeId: string,
    field: keyof SuggestedLocaleEdits,
    value: string,
  ) => {
    setEditedValues((prev) => ({
      ...prev,
      [localeId]: {
        ...prev[localeId],
        [field]: value,
      },
    }))
  }

  const handleApply = async () => {
    setApplyError(null)
    setApplySuccess(false)
    setApplyLoading(true)
    try {
      for (const [localeId, updates] of Object.entries(editedValues)) {
        const filtered: SuggestedLocaleEdits = {}
        if (updates.description !== undefined)
          filtered.description = updates.description
        if (updates.keywords !== undefined) filtered.keywords = updates.keywords
        if (updates.promotionalText !== undefined)
          filtered.promotionalText = updates.promotionalText
        if (updates.whatsNew !== undefined) filtered.whatsNew = updates.whatsNew
        if (Object.keys(filtered).length === 0) continue
        const result = await applyVersionMetadata({
          data: {
            connectedAppId,
            versionId,
            localeId,
            updates: filtered,
          },
        })
        if (result.error) {
          setApplyError(result.error)
          setApplyLoading(false)
          return
        }
      }
      setApplySuccess(true)
      await router.invalidate()
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply')
    } finally {
      setApplyLoading(false)
    }
  }

  const handleSubmitForReview = async () => {
    setSubmitError(null)
    setSubmitLoading(true)
    try {
      const result = await submitVersionForReviewServer({
        data: { connectedAppId, versionId },
      })
      if (result.error) setSubmitError(result.error)
      else await router.invalidate()
    } finally {
      setSubmitLoading(false)
    }
  }

  const hasEdits = Object.keys(editedValues).length > 0

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/apps/$appId/submissions"
          params={{ appId: String(connectedAppId) }}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3.5" />
          Back to Submissions
        </Link>

        <div className="animate-fade-in">
          {/* Header */}
          <div className="flex items-start gap-4 mb-8">
            <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                Fix with AI
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1">
                AI-suggested metadata edits to resolve the rejection
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Error */}
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-[12px] text-destructive-foreground">
                  {error}
                </p>
              </div>
            )}

            {/* Rejection reason */}
            {rejectionReason && (
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2.5">
                  <AlertCircle className="size-3.5 text-destructive" />
                  <span className="text-[12px] font-semibold text-destructive-foreground uppercase tracking-wide">
                    Rejection reason
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {rejectionReason}
                </p>
              </div>
            )}

            {localizations.length > 0 && (
              <>
                {/* Get suggestions button */}
                <div>
                  <Button
                    onClick={handleGetSuggestions}
                    disabled={suggestLoading || !rejectionReason}
                    size="sm"
                    className="gap-1.5"
                  >
                    {suggestLoading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" />
                        Get AI suggestions
                      </>
                    )}
                  </Button>
                  {suggestError && (
                    <div className="mt-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                      <p className="text-[12px] text-destructive-foreground">
                        {suggestError}
                      </p>
                    </div>
                  )}
                </div>

                {/* AI explanation */}
                {explanation && (
                  <div className="glass-card rounded-xl p-5 animate-fade-in-up">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Sparkles className="size-3.5 text-primary" />
                      <span className="text-[12px] font-semibold text-primary uppercase tracking-wide">
                        AI Analysis
                      </span>
                    </div>
                    <div className="text-[13px] text-muted-foreground leading-relaxed space-y-2">
                      {explanation.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Editable suggestions */}
                {hasEdits && (
                  <div className="space-y-4 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-foreground">
                        Suggested edits
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Edit before applying
                      </span>
                    </div>
                    {Object.entries(editedValues).map(([localeId, edits]) => {
                      const loc = localizations.find((l) => l.id === localeId)
                      return (
                        <LocaleEditForm
                          key={localeId}
                          locale={loc?.locale ?? localeId}
                          edits={edits}
                          onChange={(field, value) =>
                            updateEdit(localeId, field, value)
                          }
                        />
                      )
                    })}

                    {/* Apply errors/success */}
                    {applyError && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                        <p className="text-[12px] text-destructive-foreground">
                          {applyError}
                        </p>
                      </div>
                    )}
                    {applySuccess && (
                      <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2 flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-success" />
                        <p className="text-[12px] text-success">
                          Changes applied. Submit for review below.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleApply}
                      disabled={applyLoading}
                      size="sm"
                      className="gap-1.5"
                    >
                      {applyLoading ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        'Apply fixes'
                      )}
                    </Button>
                  </div>
                )}

                {/* Submit for review */}
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={submitLoading}
                    onClick={handleSubmitForReview}
                  >
                    {submitLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Submit for review
                  </Button>
                  {submitError && (
                    <div className="mt-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                      <p className="text-[12px] text-destructive-foreground">
                        {submitError}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {localizations.length === 0 && !error && (
              <div className="glass-card rounded-xl p-6 text-center">
                <p className="text-[13px] text-muted-foreground">
                  No localizations found for this version.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LocaleEditForm({
  locale,
  edits,
  onChange,
}: {
  locale: string
  edits: SuggestedLocaleEdits
  onChange: (field: keyof SuggestedLocaleEdits, value: string) => void
}) {
  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wide bg-primary/10 px-2 py-0.5 rounded-full">
        {locale}
      </span>
      {edits.description !== undefined && (
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">
            Description
          </Label>
          <Textarea
            value={edits.description}
            onChange={(e) => onChange('description', e.target.value)}
            rows={3}
            className="bg-background/50 border-border/60 text-foreground text-[12px] leading-relaxed"
          />
        </div>
      )}
      {edits.keywords !== undefined && (
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">Keywords</Label>
          <Textarea
            value={edits.keywords}
            onChange={(e) => onChange('keywords', e.target.value)}
            rows={2}
            className="bg-background/50 border-border/60 text-foreground text-[12px]"
          />
        </div>
      )}
      {edits.promotionalText !== undefined && (
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">
            Promotional text
          </Label>
          <Textarea
            value={edits.promotionalText}
            onChange={(e) => onChange('promotionalText', e.target.value)}
            rows={2}
            className="bg-background/50 border-border/60 text-foreground text-[12px]"
          />
        </div>
      )}
      {edits.whatsNew !== undefined && (
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">
            What&apos;s New
          </Label>
          <Textarea
            value={edits.whatsNew}
            onChange={(e) => onChange('whatsNew', e.target.value)}
            rows={2}
            className="bg-background/50 border-border/60 text-foreground text-[12px]"
          />
        </div>
      )}
    </div>
  )
}
