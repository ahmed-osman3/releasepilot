import OpenAI from 'openai'

export interface LocaleMetadata {
  localeId: string
  locale: string
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
}

export interface SuggestedLocaleEdits {
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
}

export interface SuggestRejectionFixResult {
  /** Human-readable explanation and suggestions (markdown) */
  explanation: string
  /** Per-locale suggested edits; only fields that should change are set */
  suggestedEdits: Record<string, SuggestedLocaleEdits>
}

const systemPrompt = `You are an expert App Store reviewer assistant. Given a rejection reason and the app's current store listing metadata (description, keywords, promotional text, "What's New"), suggest concrete edits to resolve the rejection. Return only the JSON object, no extra text.`

function buildUserPrompt(
  rejectionReason: string,
  currentMetadata: LocaleMetadata[]
): string {
  const metaBlob = currentMetadata
    .map(
      (m) =>
        `Locale: ${m.locale} (id: ${m.localeId})\n  description: ${m.description ?? '(empty)'}\n  keywords: ${m.keywords ?? '(empty)'}\n  promotionalText: ${m.promotionalText ?? '(empty)'}\n  whatsNew: ${m.whatsNew ?? '(empty)'}`
    )
    .join('\n\n')
  return `Rejection reason from App Store:\n${rejectionReason}\n\nCurrent metadata per locale:\n${metaBlob}\n\nRespond with a JSON object of this exact shape (use null for unchanged fields):\n{\n  "explanation": "Short markdown explanation of what to change and why.",\n  "suggestedEdits": {\n    "<localeId>": {\n      "description": "new value or null",\n      "keywords": "new value or null",\n      "promotionalText": "new value or null",\n      "whatsNew": "new value or null"\n    }\n  }\n}\nOnly include localeIds that need changes. Omit a key entirely if that field should not change.`
}

/**
 * Call OpenAI to suggest metadata edits to address an App Store rejection.
 * No ASC write; user must approve before applying.
 */
export async function suggestRejectionFix(
  rejectionReason: string,
  currentMetadata: LocaleMetadata[]
): Promise<SuggestRejectionFixResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  const openai = new OpenAI({ apiKey })
  const userPrompt = buildUserPrompt(rejectionReason, currentMetadata)
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  })
  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from AI')
  }
  const parsed = JSON.parse(content) as {
    explanation?: string
    suggestedEdits?: Record<string, Record<string, string | null>>
  }
  const raw = parsed.suggestedEdits ?? {}
  const suggestedEdits: Record<string, SuggestedLocaleEdits> = {}
  for (const [localeId, fields] of Object.entries(raw)) {
    if (!fields || typeof fields !== 'object') continue
    const out: SuggestedLocaleEdits = {}
    if (fields.description != null && fields.description !== '') out.description = fields.description
    if (fields.keywords != null && fields.keywords !== '') out.keywords = fields.keywords
    if (fields.promotionalText != null && fields.promotionalText !== '') out.promotionalText = fields.promotionalText
    if (fields.whatsNew != null && fields.whatsNew !== '') out.whatsNew = fields.whatsNew
    if (Object.keys(out).length > 0) suggestedEdits[localeId] = out
  }
  return {
    explanation: parsed.explanation ?? 'No explanation provided.',
    suggestedEdits,
  }
}
