import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Load .env.local (Next.js convention)
config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.SUPABASE_POOLER_URL!,
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
})
