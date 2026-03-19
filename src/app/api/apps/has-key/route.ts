import { hasAscApiKey } from '@/server/apps-service'

export async function GET(request: Request) {
  try {
    const hasKey = await hasAscApiKey(request.headers)
    return Response.json({ hasKey })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return Response.json({ error: message }, { status: 401 })
  }
}
