import { activateConnectedAppAutomation } from '@/server/apps-service'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  const body = (await request.json()) as { connectedAppId?: number }
  const connectedAppId = Number(body.connectedAppId)

  if (Number.isNaN(connectedAppId)) {
    return Response.json({ error: 'Invalid connected app id.' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const push = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }

      try {
        push({ type: 'log', message: 'Resolving automation context...' })
        await delay(250)
        push({ type: 'log', message: 'Validating repository and localization scope...' })
        await delay(250)
        push({ type: 'log', message: 'Priming release workers and release monitors...' })
        await delay(300)

        const result = await activateConnectedAppAutomation(request.headers, { connectedAppId })
        if (!result.success) {
          push({ type: 'error', message: result.error ?? 'Failed to begin automation.' })
          controller.close()
          return
        }

        push({
          type: 'success',
          message: 'Automation launch complete. Live monitoring is now active.',
          automationActivatedAt: result.automationActivatedAt?.toISOString?.() ?? null,
        })
      } catch (error) {
        push({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to begin automation.',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}
