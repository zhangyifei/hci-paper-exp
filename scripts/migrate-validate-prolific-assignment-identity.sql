-- Reject malformed Prolific launches inside the atomic assignment boundary.
-- This is defense-in-depth for the API validation: missing identifiers and
-- literal URL-template placeholders must never consume a balanced-study slot.
-- Existing historical rows are preserved. Safe to run multiple times.

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
  IF p_pid IS NULL
     OR p_pid !~* '^[a-z0-9]{24}$'
     OR p_study IS NULL
     OR p_study !~* '^[a-z0-9]{24}$'
     OR p_session IS NULL
     OR p_session !~* '^[a-z0-9]{24}$'
     OR p_exp_session IS NULL THEN
    RAISE EXCEPTION 'Invalid Prolific assignment identity'
      USING ERRCODE = '22023';
  END IF;

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

  SELECT * INTO v_existing
    FROM participant_assignments
    WHERE batch_id = v_batch.id AND prolific_pid = p_pid;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.batch_id, v_existing.group_condition,
                        v_existing.status, 'existing'::TEXT;
    RETURN;
  END IF;

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
    (v_batch.id, p_pid, p_study, p_session, v_group, p_exp_session);

  RETURN QUERY SELECT v_batch.id, v_group, 'assigned'::TEXT, 'assigned'::TEXT;
END;
$$;
