import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Condition } from '@/lib/experiment-config'
import type { AssignmentStatus } from '@/lib/types'
import { fetchProlificData, isProlificId, type ProlificData } from './prolific'

const PAGE_SIZE = 1000
const SESSION_CHUNK = 50

export interface BatchRow {
  id: string
  name: string
  status: string
  group_size: number
  created_at: string
  closed_at: string | null
}

export interface AssignmentRow {
  id: string
  prolific_pid: string
  prolific_study_id: string | null
  prolific_session_id: string | null
  group_condition: Condition
  exp_session_id: string | null
  status: AssignmentStatus
  invalid_reason: string | null
  assigned_at: string
  completed_at: string | null
}

export interface EventRow {
  event_name: string
  event_id: string
  session_id: string
  sequence_id: number
  flow: string
  state: string
  timestamp: number | string
  client_mono_ms: number | null
  duration_ms: number | null
  parent_event_id: string | null
  payload: Record<string, unknown> | null
  error: string | null
  condition: string
}

export interface BatchExportData {
  batch: BatchRow
  assignments: AssignmentRow[]
  eventsBySession: Map<string, EventRow[]>
  prolific: ProlificData
}

async function loadEvents(sessionIds: string[]): Promise<Map<string, EventRow[]>> {
  const bySession = new Map<string, EventRow[]>()
  for (let i = 0; i < sessionIds.length; i += SESSION_CHUNK) {
    const chunk = sessionIds.slice(i, i + SESSION_CHUNK)
    // Supabase caps responses at 1000 rows, so page through each chunk.
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from('experiment_events')
        .select('event_name,event_id,session_id,sequence_id,flow,state,timestamp,client_mono_ms,duration_ms,parent_event_id,payload,error,condition')
        .in('session_id', chunk)
        .order('session_id')
        .order('sequence_id')
        .order('id')
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`events query failed: ${error.message}`)
      for (const row of (data ?? []) as EventRow[]) {
        const list = bySession.get(row.session_id) ?? []
        list.push(row)
        bySession.set(row.session_id, list)
      }
      if (!data || data.length < PAGE_SIZE) break
    }
  }
  return bySession
}

/** The Prolific study most participants in the batch came from. */
function dominantStudyId(assignments: AssignmentRow[]): string | null {
  const counts = new Map<string, number>()
  for (const a of assignments) {
    if (isProlificId(a.prolific_study_id)) counts.set(a.prolific_study_id, (counts.get(a.prolific_study_id) ?? 0) + 1)
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
}

/** Returns null when the batch does not exist. */
export async function loadBatchExportData(batchId: string): Promise<BatchExportData | null> {
  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('test_batches')
    .select('id,name,status,group_size,created_at,closed_at')
    .eq('id', batchId)
    .maybeSingle()
  if (batchErr) throw new Error(`batch query failed: ${batchErr.message}`)
  if (!batch) return null

  const { data: assignments, error: asgErr } = await supabaseAdmin
    .from('participant_assignments')
    .select('id,prolific_pid,prolific_study_id,prolific_session_id,group_condition,exp_session_id,status,invalid_reason,assigned_at,completed_at')
    .eq('batch_id', batchId)
    .order('assigned_at', { ascending: true })
  if (asgErr) throw new Error(`assignments query failed: ${asgErr.message}`)

  const rows = (assignments ?? []) as AssignmentRow[]
  const sessionIds = rows.map((a) => a.exp_session_id).filter((s): s is string => Boolean(s))
  const [eventsBySession, prolific] = await Promise.all([
    loadEvents(sessionIds),
    fetchProlificData(dominantStudyId(rows)),
  ])

  return { batch: batch as BatchRow, assignments: rows, eventsBySession, prolific }
}
