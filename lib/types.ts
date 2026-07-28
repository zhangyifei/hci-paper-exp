import type { Condition } from '@/lib/experiment-config'

export type ExperimentState =
  | 'idle'
  | 'consent_active'
  | 'consent_complete'
  | 'questionnaire_active'
  | 'questionnaire_complete'
  | 'scenario_active'
  | 'scenario_complete'
  | 'ride_in_progress'
  | 'ride_submitting'
  | 'trip_complete_confirmed'
  | 'service2_entry'
  | 'service2_task_active'
  | 'service2_task_submitting'
  | 'service2_task_complete'
  | 'survey_active'
  | 'survey_complete'
  | 'terminated'
  | 'finished'
  | 'error_ride'
  | 'error_service2'
  | 'error_submit'

export interface ProlificParams {
  participantId: string
  studyId: string
  sessionId: string
}

export interface ExperimentSession {
  sessionId: string
  condition: Condition
  prolific: ProlificParams
}

// ── Batch test management ────────────────────────────────────────────────
export type BatchStatus = 'active' | 'closed'
export type AssignmentStatus = 'assigned' | 'completed' | 'invalid'
/** Result of an assignment attempt against the active batch. */
export type AssignOutcome = 'assigned' | 'existing' | 'full' | 'no_active_batch'

export interface TestBatch {
  id: string
  name: string
  status: BatchStatus
  groupSize: number
  createdAt: string
  closedAt: string | null
}

export interface ParticipantAssignment {
  id: string
  batchId: string
  prolificPid: string
  prolificStudyId: string | null
  prolificSessionId: string | null
  groupCondition: Condition
  expSessionId: string | null
  status: AssignmentStatus
  assignedAt: string
  completedAt: string | null
}

/** Per-group tallies for one batch, used by the admin dashboard. */
export interface GroupTally {
  group: Condition
  assigned: number
  completed: number
  invalid: number
  capacity: number
}

export interface BatchSummary extends TestBatch {
  groups: GroupTally[]
  totalAssigned: number
  totalCompleted: number
  totalInvalid: number
  capacity: number
}

