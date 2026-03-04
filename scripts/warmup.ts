/**
 * Warms up Next.js routes to avoid cold-start compile lag in dev.
 * Run after `next dev` is ready: pnpm warmup
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Pages (GET)
const PAGES = [
  '/',
  '/login',
  '/signup',
  '/home',
  '/quotes',
  '/invoices',
  '/jobs',
  '/leads',
  '/customers',
  '/settings',
]

// API routes (POST)
const API_ROUTES = [
  '/api/voice/warmup',
  '/api/voice/webhook',
  '/api/voice/chat/completions',
]

async function warmup() {
  console.log(`[warmup] Warming up routes at ${BASE}...`)

  // Warm up pages in parallel
  const pagePromises = PAGES.map(async (route) => {
    try {
      const res = await fetch(`${BASE}${route}`)
      console.log(`  ${route} → ${res.status}`)
    } catch {
      console.log(`  ${route} → compiled (redirect/error expected)`)
    }
  })
  await Promise.all(pagePromises)

  // Warm up API routes
  for (const route of API_ROUTES) {
    try {
      const res = await fetch(`${BASE}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      console.log(`  ${route} → ${res.status}`)
    } catch {
      console.log(`  ${route} → compiled (error expected)`)
    }
  }

  console.log('[warmup] Done — all routes are hot.')
}

warmup()
