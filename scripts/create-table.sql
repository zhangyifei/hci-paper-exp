CREATE TABLE IF NOT EXISTS experiment_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  session_id UUID NOT NULL,
  participant_id TEXT NOT NULL,
  sequence_id INTEGER NOT NULL,
  flow TEXT NOT NULL,
  state TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  client_mono_ms DOUBLE PRECISION NOT NULL,
  duration_ms DOUBLE PRECISION,
  parent_event_id UUID,
  payload JSONB,
  error TEXT,
  condition TEXT NOT NULL,
  prolific_study_id TEXT,
  prolific_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_session_id ON experiment_events (session_id);
CREATE INDEX IF NOT EXISTS idx_events_condition ON experiment_events (condition);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON experiment_events (event_name);
