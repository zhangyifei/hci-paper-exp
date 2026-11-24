import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getProlificSubmission } from '@/lib/batch-export/prolific'
import { reconcileFullBatch } from '@/lib/assignment-reconciliation-server'
import {
  processProlificWebhook,
  type WebhookAssignment,
} from '@/lib/prolific-webhook'

async function findAssignment(
  submissionId: string,
): Promise<WebhookAssignment | null> {
  const { data, error } = await supabaseAdmin
    .from('participant_assignments')
    .select('id,batch_id,prolific_pid,prolific_study_id,status,invalid_reason')
    .eq('prolific_session_id', submissionId)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? (data as WebhookAssignment) : null
}

async function releaseAssignment(input: {
  assignmentId: string
  evidence: string
  receivedAt: string
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('participant_assignments')
    .update({
      status: 'released',
      invalid_reason: input.evidence,
      completed_at: input.receivedAt,
    })
    .eq('id', input.assignmentId)
    .in('status', ['assigned', 'completed'])
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) > 0
}

/**
 * Release app capacity as soon as Prolific confirms a terminal submission
 * state. The current submission is re-fetched from Prolific so delayed or
 * out-of-order webhook payloads cannot roll a newer state backward.
 */
export async function POST(req: NextRequest) {
  const result = await processProlificWebhook(
    {
      rawBody: await req.text(),
      timestamp: req.headers.get('x-prolific-request-timestamp'),
      signature: req.headers.get('x-prolific-request-signature'),
      secret: process.env.PROLIFIC_WEBHOOK_SECRET,
      eventId: req.headers.get('x-event-id'),
    },
    {
      getSubmission: getProlificSubmission,
      findAssignment,
      releaseAssignment,
      reconcileBatch: (batchId, submission) =>
        reconcileFullBatch(batchId, submission),
      onError: (stage, error) => {
        console.error(`[prolific-webhook] ${stage} failed:`, error)
      },
    },
  )

  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.body.retry ? { 'Retry-After': '60' } : undefined,
  })
}
