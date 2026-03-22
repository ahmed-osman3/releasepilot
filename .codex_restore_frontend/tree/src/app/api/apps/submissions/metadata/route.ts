import { applyVersionMetadata, getVersionMetadata } from '@/server/apps-service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const connectedAppId = Number(url.searchParams.get('connectedAppId'))
  const versionId = url.searchParams.get('versionId') ?? ''

  try {
    const result = await getVersionMetadata(request.headers, {
      connectedAppId,
      versionId,
    })
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return Response.json({ localizations: [], error: message }, { status: 401 })
  }
}

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const result = await applyVersionMetadata(request.headers, body)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return Response.json({ success: false, error: message }, { status: 401 })
  }
}
