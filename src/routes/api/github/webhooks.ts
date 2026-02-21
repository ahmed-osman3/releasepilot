import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import {
  handleGithubInstallationWebhook,
  verifyGithubWebhookSignature,
} from '@/lib/github/server'

// Middleware sets a fetch that adds logging
const loggingMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const url = request.url
    const method = request.method
    const deliveryId = request.headers.get('x-github-delivery') ?? 'unknown'
    const event = request.headers.get('x-github-event') ?? 'unknown'

    console.info(
      `[webhook-middleware] ${method} ${url} delivery=${deliveryId} event=${event}`,
    )

    const result = await next()
    // Optional: log response status if you have access to it
    return result
  },
)

export const Route = createFileRoute('/api/github/webhooks')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        POST: {
          middleware: [loggingMiddleware],
          handler: async ({ request }) => {
            const payload = await request.text()
            const signature = request.headers.get('x-hub-signature-256')
            const deliveryId =
              request.headers.get('x-github-delivery') ?? 'unknown'
            const event = request.headers.get('x-github-event') ?? 'unknown'

            console.info(
              `[github-webhook] delivery=${deliveryId} event=${event} received`,
            )

            if (event === 'ping') {
              if (!verifyGithubWebhookSignature(payload, signature)) {
                console.warn(
                  `[github-webhook] delivery=${deliveryId} event=ping invalid-signature`,
                )
                return new Response('Invalid signature', { status: 401 })
              }

              console.info(
                `[github-webhook] delivery=${deliveryId} event=ping pong`,
              )
              return new Response('pong', { status: 200 })
            }

            if (
              event !== 'installation' &&
              event !== 'installation_repositories'
            ) {
              console.info(
                `[github-webhook] delivery=${deliveryId} event=${event} ignored`,
              )
              return new Response(
                JSON.stringify({ ok: true, handled: false, reason: 'ignored' }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }

            if (!verifyGithubWebhookSignature(payload, signature)) {
              console.warn(
                `[github-webhook] delivery=${deliveryId} event=${event} invalid-signature`,
              )
              return new Response('Invalid signature', { status: 401 })
            }

            try {
              const result = await handleGithubInstallationWebhook(
                event,
                payload,
              )

              console.info(
                `[github-webhook] delivery=${deliveryId} event=${event} action=${result.action ?? 'unknown'} installationId=${result.installationId ?? 'none'} handled=${result.handled} matchedUsers=${result.matchedUsers}`,
              )

              return new Response(JSON.stringify({ ok: true, ...result }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : 'Webhook handler failed'
              console.error(
                `[github-webhook] delivery=${deliveryId} event=${event} error=${message}`,
              )
              return new Response('Webhook handler failed', { status: 500 })
            }
          },
        },
      }),
  },
})
