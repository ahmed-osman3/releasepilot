import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile as execFileCallback } from 'node:child_process'
import {
  createInstallationAccessTokenForUser,
  createInstallationClient,
} from './server'

const execFile = promisify(execFileCallback)

export type MaterializedRepository = {
  checkoutPath: string
  branch: string
  commitSha: string
  cleanup: () => Promise<void>
}

async function resolveHeadCommitSha(
  userId: string,
  installationId: string,
  repoFullName: string,
  branch: string,
): Promise<string> {
  const client = await createInstallationClient(userId, installationId)
  const response = await client.request(
    `/repos/${repoFullName}/commits/${encodeURIComponent(branch)}`,
  )

  if (!response.ok) {
    throw new Error('Failed to resolve repository head commit')
  }

  const json = (await response.json()) as { sha?: string }
  if (!json.sha) {
    throw new Error('Repository head commit is missing from GitHub response')
  }

  return json.sha
}

export async function materializeRepository({
  userId,
  installationId,
  repoFullName,
  branch,
}: {
  userId: string
  installationId: string
  repoFullName: string
  branch: string
}): Promise<MaterializedRepository> {
  const token = await createInstallationAccessTokenForUser(userId, installationId)
  const commitSha = await resolveHeadCommitSha(
    userId,
    installationId,
    repoFullName,
    branch,
  )
  const parentDir = await mkdtemp(join(tmpdir(), 'releasepilot-remediation-'))
  const checkoutPath = join(parentDir, repoFullName.replace('/', '__'))
  const repoUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`

  try {
    await execFile('git', ['clone', '--depth', '1', '--branch', branch, repoUrl, checkoutPath])
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], {
      cwd: checkoutPath,
    })

    return {
      checkoutPath,
      branch,
      commitSha: stdout.trim() || commitSha,
      cleanup: async () => {
        await rm(parentDir, { recursive: true, force: true })
      },
    }
  } catch (error) {
    await rm(parentDir, { recursive: true, force: true })
    const message = error instanceof Error ? error.message : 'Repository clone failed'
    throw new Error(message)
  }
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

export async function collectRepositoryContext(
  checkoutPath: string,
): Promise<Array<{ path: string; content: string }>> {
  const candidates = [
    'README.md',
    'README',
    'package.json',
    'app.json',
    'app.config.js',
    'app.config.ts',
    'CHANGELOG.md',
  ]

  const entries = await Promise.all(
    candidates.map(async (relativePath) => {
      const content = await readIfExists(join(checkoutPath, relativePath))
      if (!content) return null

      return {
        path: relativePath,
        content: content.slice(0, 8_000),
      }
    }),
  )

  return entries.filter((entry): entry is { path: string; content: string } => !!entry)
}
