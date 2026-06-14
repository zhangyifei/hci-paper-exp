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
