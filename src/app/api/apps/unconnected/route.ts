import { listUnconnectedApps } from '@/server/apps-service'

export async function GET(request: Request) {
  try {
    const result = await listUnconnectedApps(request.headers)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return Response.json({ apps: [], error: message }, { status: 401 })
  }
}
