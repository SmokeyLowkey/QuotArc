import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_POOLER_URL!,
    max: 2,              // limit connections per serverless instance
    idleTimeoutMillis: 30_000,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

// Cache in ALL environments — prevents connection leak on serverless cold starts
globalForPrisma.prisma = prisma
