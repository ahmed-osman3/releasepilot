import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  getAppReviewSubmissions,
  getVersionMetadata,
  applyVersionMetadata,
  suggestRejectionFixServer,
  submitReviewSubmissionServer,
} from '@/lib/apps/server'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { SuggestedLocaleEdits } from '@/lib/ai/suggest-rejection-fix'
import {
  ArrowLeft,
  Loader2,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Save,
  Terminal,
} from 'lucide-react'

export const Route = createFileRoute(
  '/apps/$appId/submissions/_header/$reviewSubmissionId/fix',
)({
  component: FixPage,
  loader: async ({ params }) => {
    const connectedAppId = Number(params.appId)
    const reviewSubmissionId = params.reviewSubmissionId
    if (Number.isNaN(connectedAppId)) {
      return {
        connectedAppId: 0,
        reviewSubmissionId: '',
        versionId: null as string | null,
        rejectionReason: null,
        localizations: [],
        error: 'Invalid app',
      }
    }

    const subsResult = await getAppReviewSubmissions({
      data: { connectedAppId },
    })
    const submission =
      subsResult.submissions.find((s) => s.id === reviewSubmissionId) ?? null
    const rejectionReason = submission?.rejectionReason ?? null
    const versionId = submission?.appStoreVersion?.id ?? null

    const metaResult = versionId
      ? await getVersionMetadata({ data: { connectedAppId, versionId } })
      : { localizations: [], error: undefined }

    const localizations = metaResult.localizations ?? []
    const error = subsResult.error ?? metaResult.error

    return {
      connectedAppId,
      reviewSubmissionId,
      versionId,
      rejectionReason,
      localizations,
      error,
    }
  },
})

function FixPage() {
  const router = useRouter()
  const {
    connectedAppId,
    reviewSubmissionId,
    versionId,
    rejectionReason,
    localizations,
    error,
  } = Route.useLoaderData()

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
        data: { rejectionReason, currentMetadata },
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
      [localeId]: { ...prev[localeId], [field]: value },
    }))
  }

  const handleApply = async () => {
    if (!versionId) return
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
      const result = await submitReviewSubmissionServer({
        data: {
          connectedAppId,
          reviewSubmissionId,
          versionId: versionId ?? undefined,
          isResubmission: true,
        },
      })
      if (result.error) setSubmitError(result.error)
      else await router.invalidate()
    } finally {
      setSubmitLoading(false)
    }
  }

  const hasEdits = Object.keys(editedValues).length > 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 lg:py-10">
        <Link
          to="/apps/$appId/submissions/$reviewSubmissionId"
          params={{
            appId: String(connectedAppId),
            reviewSubmissionId,
          }}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to workspace
        </Link>

        <div className="mt-6 animate-fade-in">
          <div className="flex items-start gap-3 pb-6">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/8">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
                AI-Assisted Fix
              </h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Analyze the rejection and generate metadata fixes automatically
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {error && (
              <div className="flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="size-3" />
                {error}
              </div>
            )}

            {rejectionReason && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                <div className="flex items-center gap-2 pb-2">
                  <Terminal className="size-3 text-destructive" />
                  <span className="font-mono text-[11px] font-medium tracking-wider text-destructive">
                    REJECTION REASON
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">
                  {rejectionReason}
                </p>
              </div>
            )}

            {localizations.length > 0 && (
              <>
                <Button
                  onClick={handleGetSuggestions}
                  disabled={suggestLoading || !rejectionReason}
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  {suggestLoading ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3" />
                      Get AI Suggestions
                    </>
                  )}
                </Button>

                {suggestError && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertTriangle className="size-3" />
                    {suggestError}
                  </div>
                )}

                {explanation && (
                  <div className="animate-fade-in-up rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <div className="flex items-center gap-2 pb-2">
                      <Sparkles className="size-3 text-primary" />
                      <span className="font-mono text-[11px] font-medium tracking-wider text-primary">
                        AI ANALYSIS
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      {explanation.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}

                {hasEdits && (
                  <div className="animate-fade-in-up space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-medium text-foreground">
                        Suggested Edits
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Review and edit before applying
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

                    {applyError && (
                      <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                        <AlertTriangle className="size-3" />
                        {applyError}
                      </div>
                    )}
                    {applySuccess && (
                      <div className="flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-xs text-success">
                        <CheckCircle2 className="size-3" />
                        Changes applied to App Store Connect.
                      </div>
                    )}

                    <Button
                      onClick={handleApply}
                      disabled={applyLoading || !versionId}
                      size="sm"
                      className="gap-1.5 text-xs"
                    >
                      {applyLoading ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Save className="size-3" />
                      )}
                      Apply Fixes
                    </Button>
                  </div>
                )}

                <Separator className="bg-border/30" />

                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={submitLoading}
                    onClick={handleSubmitForReview}
                  >
                    {submitLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Send className="size-3" />
                    )}
                    Resubmit for Review
                  </Button>
                  {submitError && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                      <AlertTriangle className="size-3" />
                      {submitError}
                    </div>
                  )}
                </div>
              </>
            )}

            {localizations.length === 0 && !error && (
              <div className="rounded-lg border border-border/30 bg-muted/10 px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">
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
    <div className="rounded-lg border border-border/30 bg-background/20 p-4 space-y-3">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/8 px-2 py-0.5 font-mono text-[11px] font-medium text-primary">
        {locale}
      </span>
      {edits.description !== undefined && (
        <div className="metadata-field space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            Description
          </Label>
          <Textarea
            value={edits.description}
            onChange={(e) => onChange('description', e.target.value)}
            rows={3}
            className="border-border/40 bg-background/50 text-xs leading-relaxed text-foreground"
          />
        </div>
      )}
      {edits.keywords !== undefined && (
        <div className="metadata-field space-y-1">
          <Label className="text-[11px] text-muted-foreground">Keywords</Label>
          <Textarea
            value={edits.keywords}
            onChange={(e) => onChange('keywords', e.target.value)}
            rows={2}
            className="border-border/40 bg-background/50 text-xs text-foreground"
          />
        </div>
      )}
      {edits.promotionalText !== undefined && (
        <div className="metadata-field space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            Promotional Text
          </Label>
          <Textarea
            value={edits.promotionalText}
            onChange={(e) => onChange('promotionalText', e.target.value)}
            rows={2}
            className="border-border/40 bg-background/50 text-xs text-foreground"
          />
        </div>
      )}
      {edits.whatsNew !== undefined && (
        <div className="metadata-field space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            What&apos;s New
          </Label>
          <Textarea
            value={edits.whatsNew}
            onChange={(e) => onChange('whatsNew', e.target.value)}
            rows={2}
            className="border-border/40 bg-background/50 text-xs text-foreground"
          />
        </div>
      )}
    </div>
  )
}
