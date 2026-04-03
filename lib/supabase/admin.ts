import 'server-only'

import { type SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from './admin-client'

let _client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createAdminClient()
  }
  return _client
}

// Lazy proxy so existing `supabaseAdmin.from(...)` call sites keep working
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseAdmin()[prop as keyof SupabaseClient]
  },
})
