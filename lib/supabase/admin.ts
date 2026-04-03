import 'server-only'

import { createAdminClient } from './admin-client'

export const supabaseAdmin = createAdminClient()
