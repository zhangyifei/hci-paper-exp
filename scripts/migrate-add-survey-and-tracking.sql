-- Migration: Add support for survey responses and enhanced behavioral tracking
-- Run after create-table.sql
-- Date: 2026-03-05
-- Context: Paper requires post-task survey (CL1-3, PU1-2, CI1-2, MC1-2),
--          background questionnaire (demographics, familiarity, switching),
--          and per-screen behavioral metrics (dwell, hesitation, scroll).
--
-- All new data flows through the existing experiment_events table via the
-- JSONB `payload` column — no schema changes needed for the events table.
-- This migration adds regular views for convenient survey analysis
-- and indexes to speed up the new event-type queries.
-- Regular views (not materialized) are always up-to-date — no refresh needed.

-- 1. Index for the new event types so dashboard queries stay fast
CREATE INDEX IF NOT EXISTS idx_events_flow
  ON experiment_events (flow);

CREATE INDEX IF NOT EXISTS idx_events_participant_id
  ON experiment_events (participant_id);

-- 2. Convenience view: one row per participant with survey + questionnaire responses
--    pivoted out of the JSONB payload. Always up-to-date (regular view).
CREATE OR REPLACE VIEW participant_responses AS
SELECT
  e.participant_id,
  e.session_id,
  e.condition,
  -- Background questionnaire
  MAX(CASE WHEN e.event_name = 'questionnaire.completed' THEN e.payload->'responses'->>'DEM1' END) AS age_range,
  MAX(CASE WHEN e.event_name = 'questionnaire.completed' THEN e.payload->'responses'->>'DEM2' END) AS gender,
  MAX(CASE WHEN e.event_name = 'questionnaire.completed' THEN e.payload->'responses'->>'FAM1' END) AS app_usage_freq,
  MAX(CASE WHEN e.event_name = 'questionnaire.completed' THEN e.payload->'responses'->>'FAM2' END) AS switching_familiarity,
  MAX(CASE WHEN e.event_name = 'questionnaire.completed' THEN e.payload->'responses'->>'SWI1' END) AS services_per_session,
  MAX(CASE WHEN e.event_name = 'questionnaire.completed' THEN e.payload->'responses'->>'SWI2' END) AS switching_frequency,
  MAX(CASE WHEN e.event_name = 'questionnaire.completed' THEN e.duration_ms END) AS questionnaire_duration_ms,
  -- Post-task survey
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'CL1')::int END) AS cl1,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'CL2')::int END) AS cl2,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'CL3')::int END) AS cl3,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'PU1')::int END) AS pu1,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'PU2')::int END) AS pu2,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'CI1')::int END) AS ci1,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'CI2')::int END) AS ci2,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'MC1')::int END) AS mc1,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'MC2')::int END) AS mc2,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'aggregates'->>'cognitive_load_mean')::numeric END) AS cognitive_load_mean,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'aggregates'->>'usability_mean')::numeric END) AS usability_mean,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'aggregates'->>'continuance_mean')::numeric END) AS continuance_mean,
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN e.duration_ms END) AS survey_duration_ms,
  -- Behavioral: navigation lag
  MAX(CASE WHEN e.event_name = 'service2.entry' THEN e.timestamp END)
    - MAX(CASE WHEN e.event_name = 'trip_complete.viewed' THEN e.timestamp END) AS navigation_lag_ms,
  -- Behavioral: service2 task duration
  MAX(CASE WHEN e.event_name = 'service2.task.complete' THEN e.duration_ms END) AS service2_task_duration_ms,
  -- Banner uptake
  BOOL_OR(e.event_name = 'trip_complete.banner_tapped') AS banner_tapped,
  -- Experiment completion
  BOOL_OR(e.event_name = 'experiment.completed') AS completed
FROM experiment_events e
GROUP BY e.participant_id, e.session_id, e.condition;

-- 3. Convenience view: per-screen behavioral metrics (dwell, hesitation, taps, scroll)
CREATE OR REPLACE VIEW screen_metrics AS
SELECT
  e.participant_id,
  e.session_id,
  e.condition,
  e.state AS screen_name,
  (e.payload->>'dwellMs')::int AS dwell_ms,
  (e.payload->>'hesitationMs')::int AS hesitation_ms,
  (e.payload->>'tapCount')::int AS tap_count,
  (e.payload->>'maxScrollDepth')::numeric AS max_scroll_depth,
  (e.payload->>'scrollCount')::int AS scroll_count,
  e.timestamp
FROM experiment_events e
WHERE e.event_name = 'screen.exited';

-- Regular views — always live, no refresh needed.
