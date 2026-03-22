import { saveAscApiKey } from '@/server/apps-service'

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const result = await saveAscApiKey(request.headers, body)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return Response.json({ success: false, error: message }, { status: 401 })
  }
}
