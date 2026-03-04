import { signN8nToken } from './sign'

// n8n is used exclusively for AI features
const webhookUrls: Record<string, string | undefined> = {
  'ai-quote-enhance': process.env.N8N_WEBHOOK_AI_QUOTE_ENHANCE,
}

export async function callN8n(
  workflow: string,
  payload: Record<string, unknown>
): Promise<Response> {
  const url = webhookUrls[workflow]
  if (!url) {
    throw new Error(`No webhook URL configured for n8n workflow: ${workflow}`)
  }

  const token = await signN8nToken()

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
}
