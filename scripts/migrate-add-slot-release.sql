-- Slot release: let failed / abandoned / rejected participants free their
-- group slot so a replacement can be recruited without unbalancing the 2×2.
-- Safe to run multiple times (idempotent).

-- 1) Allow a 'released' status (admin frees an abandoned or rejected slot).
ALTER TABLE participant_assignments
  DROP CONSTRAINT IF EXISTS participant_assignments_status_check;
ALTER TABLE participant_assignments
  ADD CONSTRAINT participant_assignments_status_check
  CHECK (status IN ('assigned', 'completed', 'invalid', 'released'));

-- 2) Redefine assignment so a group's fill counts only ACTIVE slots
--    (assigned + completed). 'invalid' and 'released' no longer occupy
--    capacity, so the next participant fills the vacated group — preserving
--    balance across G1–G4.
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

  -- Least-filled group with remaining ACTIVE capacity; random tiebreak.
  -- Only 'assigned' + 'completed' rows occupy a slot.
  SELECT counts.grp INTO v_group
  FROM (
    SELECT grp, COUNT(pa.id) AS cnt
    FROM unnest(ARRAY['G1', 'G2', 'G3', 'G4']) AS grp
    LEFT JOIN participant_assignments pa
      ON pa.batch_id = v_batch.id
     AND pa.group_condition = grp
     AND pa.status IN ('assigned', 'completed')
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
