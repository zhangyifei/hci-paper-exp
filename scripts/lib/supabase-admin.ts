import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

import {
  createAdminClient,
  getSupabaseAdminEnv,
} from '../../lib/supabase/admin-client'

type Condition = 'G1' | 'G2' | 'G3' | 'G4'

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = resolve(process.cwd(), fileName)
    if (existsSync(filePath)) {
      loadEnvFile(filePath)
    }
  }
}

loadLocalEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

export interface ExperimentEventRow {
  id: number
  event_name: string
  session_id: string
  participant_id: string
  sequence_id: number
  flow: string
  state: string
  timestamp: number
  client_mono_ms: number
  duration_ms: number | null
  payload: Record<string, unknown> | null
  condition: Condition
  prolific_study_id: string | null
  prolific_session_id: string | null
  created_at: string
}

export const supabase = createAdminClient(getSupabaseAdminEnv(process.env))

export async function fetchAllEventRows(pageSize = 1000): Promise<ExperimentEventRow[]> {
  const rows: ExperimentEventRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('experiment_events')
      .select('*')
      .range(offset, offset + pageSize - 1)
      .order('created_at')

    if (error) {
      throw new Error(`DB error: ${error.message}`)
    }

    if (!data || data.length === 0) {
      break
    }

    rows.push(...data)

    if (data.length < pageSize) {
      break
    }

    offset += pageSize
  }

  return rows
}
