import { createClient } from '@supabase/supabase-js'

type AdminKeySource = 'SUPABASE_SECRET_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'

export interface SupabaseAdminEnv {
  url: string
  key: string
  keySource: AdminKeySource
}

export function getSupabaseAdminEnv(env: NodeJS.ProcessEnv = process.env): SupabaseAdminEnv {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = env.SUPABASE_SECRET_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }

  if (secretKey) {
    return {
      url,
      key: secretKey,
      keySource: 'SUPABASE_SECRET_KEY',
    }
  }

  if (serviceRoleKey) {
    return {
      url,
      key: serviceRoleKey,
      keySource: 'SUPABASE_SERVICE_ROLE_KEY',
    }
  }

  throw new Error('Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY')
}

export function createAdminClient(adminEnv: SupabaseAdminEnv = getSupabaseAdminEnv()) {
  return createClient(adminEnv.url, adminEnv.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
