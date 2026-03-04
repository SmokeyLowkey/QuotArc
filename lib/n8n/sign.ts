import { SignJWT } from 'jose'

const secret = new TextEncoder().encode(process.env.N8N_WEBHOOK_SECRET!)

/** Sign an HS512 JWT for outbound n8n webhook calls. Expires in 60 seconds. */
export async function signN8nToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS512' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secret)
}
