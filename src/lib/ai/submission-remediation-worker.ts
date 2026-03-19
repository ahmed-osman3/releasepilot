import OpenAI from 'openai'
import type { NormalizedAscError } from '@/lib/asc/submissions'
import type { NormalizedAscIssue } from '@/lib/asc/issues'
import type { VersionLocalization } from '@/lib/asc/localizations'
import {
  collectRepositoryContext,
  materializeRepository,
} from '@/lib/github/repo-materializer'

export type RemediationProposal = {
  summary: string
  rationale: string
  missingInformation: Array<string>
  proposedChanges: {
    localizations: Array<{
      locale?: string
      field: string
      value: string
      reason: string
    }>
    urls: Array<{
      field: string
      value: string
      reason: string
    }>
    pricing: Array<{
      field: string
      value: string
      reason: string
    }>
  }
  availableTools: Array<string>
}

type WorkerInput = {
  userId: string
  installationId: string
  repoFullName: string
  branch: string
  issues: Array<NormalizedAscIssue>
  errors: Array<NormalizedAscError>
  localizations: Array<VersionLocalization>
}

const SYSTEM_PROMPT = `You are a backend remediation worker for App Store Connect submission failures.
You are given normalized issues, the raw App Store Connect errors, current localization metadata, and selected repository files.
Return only JSON with:
{
  "summary": string,
  "rationale": string,
  "missingInformation": string[],
  "proposedChanges": {
    "localizations": [{"locale": string | null, "field": string, "value": string, "reason": string}],
    "urls": [{"field": string, "value": string, "reason": string}],
    "pricing": [{"field": string, "value": string, "reason": string}]
  }
}
Do not invent pricing changes unless a pricing issue is present.
Prefer concise, directly applicable values.`

type ParsedRemediationProposal = {
  summary?: string
  rationale?: string
  missingInformation?: Array<string>
  proposedChanges?: {
    localizations?: Array<{
      locale?: string
      field: string
      value: string
      reason: string
    }>
    urls?: Array<{
      field: string
      value: string
      reason: string
    }>
    pricing?: Array<{
      field: string
      value: string
      reason: string
    }>
  }
}

function buildFallbackProposal(
  issues: Array<NormalizedAscIssue>,
  commitSha: string,
): RemediationProposal {
  return {
    summary: `Prepared remediation context for ${issues.length} App Store Connect issue${issues.length === 1 ? '' : 's'} at ${commitSha.slice(0, 7)}.`,
    rationale:
      'The remediation worker normalized the latest submission errors and captured repository context. OPENAI_API_KEY is not configured, so no AI-generated change proposal was produced yet.',
    missingInformation: ['Configure OPENAI_API_KEY to generate proposed fixes.'],
    proposedChanges: {
      localizations: [],
      urls: [],
      pricing: [],
    },
    availableTools: ['getVersionLocalizations', 'updateVersionLocalization'],
  }
}

function buildUserPrompt({
  issues,
  errors,
  localizations,
  repoContext,
}: {
  issues: Array<NormalizedAscIssue>
  errors: Array<NormalizedAscError>
  localizations: Array<VersionLocalization>
  repoContext: Array<{ path: string; content: string }>
}): string {
  return JSON.stringify(
    {
      issues,
      errors,
      currentLocalizations: localizations,
      repositoryContext: repoContext,
    },
    null,
    2,
  )
}

export async function runSubmissionRemediationWorker(
  input: WorkerInput,
): Promise<RemediationProposal & { repoCommitSha: string }> {
  const materializedRepo = await materializeRepository({
    userId: input.userId,
    installationId: input.installationId,
    repoFullName: input.repoFullName,
    branch: input.branch,
  })

  try {
    const repoContext = await collectRepositoryContext(materializedRepo.checkoutPath)
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return {
        ...buildFallbackProposal(input.issues, materializedRepo.commitSha),
        repoCommitSha: materializedRepo.commitSha,
      }
    }

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildUserPrompt({
            issues: input.issues,
            errors: input.errors,
            localizations: input.localizations,
            repoContext,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No remediation proposal was returned by OpenAI')
    }

    const parsed = JSON.parse(content) as ParsedRemediationProposal

    return {
      summary: parsed.summary ?? 'Generated remediation proposal.',
      rationale: parsed.rationale ?? 'No rationale provided.',
      missingInformation: Array.isArray(parsed.missingInformation)
        ? parsed.missingInformation
        : [],
      proposedChanges: {
        localizations: parsed.proposedChanges?.localizations || [],
        urls: parsed.proposedChanges?.urls || [],
        pricing: parsed.proposedChanges?.pricing || [],
      },
      availableTools: ['getVersionLocalizations', 'updateVersionLocalization'],
      repoCommitSha: materializedRepo.commitSha,
    }
  } finally {
    await materializedRepo.cleanup()
  }
}
