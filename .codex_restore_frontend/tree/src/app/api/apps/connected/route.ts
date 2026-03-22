import { getConnectedApps } from '@/server/apps-service'

export async function GET(request: Request) {
  try {
    const apps = await getConnectedApps(request.headers)
    return Response.json({ apps })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return Response.json({ error: message }, { status: 401 })
  }
}
