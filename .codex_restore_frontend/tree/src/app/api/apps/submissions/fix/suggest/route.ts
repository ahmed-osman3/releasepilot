import { suggestRejectionFix } from '@/server/apps-service'

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const result = await suggestRejectionFix(request.headers, body)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to suggest fix'
    return Response.json(
      { explanation: null, suggestedEdits: {}, error: message },
      { status: 500 },
    )
  }
}
