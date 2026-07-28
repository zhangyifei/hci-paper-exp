-- Batch-based test management: an admin starts a "batch" (one test run) that
-- holds 4 groups (G1–G4) of `group_size` participants each (default 25).
-- Participants are assigned randomly but balanced to the least-filled group,
-- and each assignment is linked to the participant's Prolific PID so they can
-- be matched and paid.
--
-- Safe to run multiple times (idempotent).

-- ── Tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_batches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  group_size  INTEGER NOT NULL DEFAULT 25 CHECK (group_size > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS participant_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id             UUID NOT NULL REFERENCES test_batches(id) ON DELETE CASCADE,
  prolific_pid         TEXT NOT NULL,
  prolific_study_id    TEXT,
  prolific_session_id  TEXT,
  group_condition      TEXT NOT NULL CHECK (group_condition IN ('G1', 'G2', 'G3', 'G4')),
  exp_session_id       UUID,
  status               TEXT NOT NULL DEFAULT 'assigned'
                         CHECK (status IN ('assigned', 'completed', 'invalid')),
  assigned_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ,
  -- One assignment per participant per batch (idempotent re-entry).
  UNIQUE (batch_id, prolific_pid)
);

CREATE INDEX IF NOT EXISTS idx_assign_batch     ON participant_assignments (batch_id);
CREATE INDEX IF NOT EXISTS idx_assign_pid       ON participant_assignments (prolific_pid);
CREATE INDEX IF NOT EXISTS idx_assign_session   ON participant_assignments (exp_session_id);
CREATE INDEX IF NOT EXISTS idx_assign_group     ON participant_assignments (batch_id, group_condition);

-- ── Atomic balanced assignment ────────────────────────────────────────────
-- Locks the active batch row (FOR UPDATE) so concurrent landings can't
-- over-fill a group. Returns the outcome so the app can route the participant.
--   outcome: 'assigned' | 'existing' | 'full' | 'no_active_batch'
CREATE OR REPLACE FUNCTION assign_participant(
  p_pid          TEXT,
  p_study        TEXT,
  p_session      TEXT,
  p_exp_session  UUID
)
RETURNS TABLE (
  out_batch_id  UUID,
  out_group     TEXT,
  out_status    TEXT,
  out_outcome   TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch     test_batches%ROWTYPE;
  v_existing  participant_assignments%ROWTYPE;
  v_group     TEXT;
BEGIN
  -- Serialize assignment against the most recent active batch.
  SELECT * INTO v_batch
    FROM test_batches
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, 'no_active_batch'::TEXT;
    RETURN;
  END IF;

  -- Idempotent: an already-assigned participant keeps their group on re-entry.
  SELECT * INTO v_existing
    FROM participant_assignments
    WHERE batch_id = v_batch.id AND prolific_pid = p_pid;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.batch_id, v_existing.group_condition,
                        v_existing.status, 'existing'::TEXT;
    RETURN;
  END IF;

  -- Least-filled group with remaining capacity; random tiebreak.
  SELECT counts.grp INTO v_group
  FROM (
    SELECT grp, COUNT(pa.id) AS cnt
    FROM unnest(ARRAY['G1', 'G2', 'G3', 'G4']) AS grp
    LEFT JOIN participant_assignments pa
      ON pa.batch_id = v_batch.id AND pa.group_condition = grp
    GROUP BY grp
  ) counts
  WHERE counts.cnt < v_batch.group_size
  ORDER BY counts.cnt ASC, random()
  LIMIT 1;

  IF v_group IS NULL THEN
    RETURN QUERY SELECT v_batch.id, NULL::TEXT, NULL::TEXT, 'full'::TEXT;
    RETURN;
  END IF;

  INSERT INTO participant_assignments
    (batch_id, prolific_pid, prolific_study_id, prolific_session_id,
     group_condition, exp_session_id)
  VALUES
    (v_batch.id, p_pid, NULLIF(p_study, ''), NULLIF(p_session, ''),
     v_group, p_exp_session);

  RETURN QUERY SELECT v_batch.id, v_group, 'assigned'::TEXT, 'assigned'::TEXT;
END;
$$;
