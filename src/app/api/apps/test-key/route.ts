import { testAscApiKey } from '@/server/apps-service'

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const result = await testAscApiKey(request.headers, body)
    if (!result.success) {
      return Response.json(result, { status: 400 })
    }
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return Response.json({ success: false, error: message }, { status: 401 })
  }
}
