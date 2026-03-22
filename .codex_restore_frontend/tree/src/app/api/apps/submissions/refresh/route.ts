import { refreshReviewSubmissionState } from '@/server/apps-service'

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const result = await refreshReviewSubmissionState(request.headers, body)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return Response.json(
      { submission: null, stateChanged: false, error: message },
      { status: 401 },
    )
  }
}
