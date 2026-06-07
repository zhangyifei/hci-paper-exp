-- Migration: Add CI3 to the participant_responses materialized view
-- Run after migrate-add-survey-and-tracking.sql
-- Date: 2026-06-07
-- Context: Pilot 1 used CI1 ("use again") and CI2 ("recommend to a friend").
--          CI2 measured recommendation, not continuance, which produced a
--          negative Cronbach's alpha (-.621). The survey now collects three
--          future-use items (CI1/CI2/CI3) matching Manuscript Table 3.
--
--          Event payloads carry whichever CI keys the client sent, so older
--          sessions simply have no CI3 row and surface as NULL — exactly the
--          behaviour we want for backward compatibility.
--
-- Idempotent: safe to re-run.

DROP MATERIALIZED VIEW IF EXISTS participant_responses CASCADE;

CREATE MATERIALIZED VIEW participant_responses AS
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
  MAX(CASE WHEN e.event_name = 'survey.completed' THEN (e.payload->'responses'->>'CI3')::int END) AS ci3,
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

CREATE INDEX IF NOT EXISTS idx_pr_session
  ON participant_responses (session_id);

-- Refresh once so downstream queries see existing sessions (with CI3 = NULL
-- for any pre-migration data).
REFRESH MATERIALIZED VIEW participant_responses;
