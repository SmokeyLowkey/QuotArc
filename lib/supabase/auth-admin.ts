import { createClient } from '@supabase/supabase-js'

/** Admin client scoped to auth operations only (not DB queries — those use Prisma). */
export function getAuthAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ).auth.admin
}
