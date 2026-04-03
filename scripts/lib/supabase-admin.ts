import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

import {
  createAdminClient,
  getSupabaseAdminEnv,
} from '../../lib/supabase/admin-client'
import type { PaperStatsEventRow } from '../../lib/paper-stats/analysis'

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

export type ExperimentEventRow = PaperStatsEventRow

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
