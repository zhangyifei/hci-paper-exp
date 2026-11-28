-- External (non-Prolific) recruitment into an existing batch via single-use invites.
-- Each invite is pre-bound to one batch cell (e.g. a slot released after data
-- loss). Only the SHA-256 hash of the invite token is stored. Claiming is
-- atomic: it marks the invite used and creates the participant_assignments row
-- in the same transaction, without exceeding the cell's capacity.
-- Safe to run multiple times (idempotent).

CREATE TABLE IF NOT EXISTS external_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         UUID NOT NULL REFERENCES test_batches(id) ON DELETE CASCADE,
  token_hash       TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  participant_id   TEXT NOT NULL UNIQUE CHECK (participant_id ~ '^ext_[0-9a-f]{10}$'),
  group_condition  TEXT NOT NULL CHECK (group_condition IN ('G1', 'G2', 'G3', 'G4')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at       TIMESTAMPTZ,
  exp_session_id   UUID UNIQUE,
  CHECK ((claimed_at IS NULL) = (exp_session_id IS NULL))
);

-- Server-only table: no anon/authenticated policies; the service role bypasses RLS.
ALTER TABLE external_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION claim_external_invite(
  p_token_hash   TEXT,
  p_exp_session  UUID
)
RETURNS TABLE (
  out_outcome     TEXT,
  out_group       TEXT,
  out_participant TEXT,
  out_batch_id    UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_invite  external_invites%ROWTYPE;
  v_batch   test_batches%ROWTYPE;
  v_active  INTEGER;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' OR p_exp_session IS NULL THEN
    RETURN QUERY SELECT 'invalid_invite'::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_invite FROM external_invites WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid_invite'::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;
  IF v_invite.claimed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'used'::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Lock the batch so concurrent claims and Prolific assignments serialize.
  SELECT * INTO v_batch FROM test_batches WHERE id = v_invite.batch_id FOR UPDATE;
  IF v_batch.status <> 'active' THEN
    RETURN QUERY SELECT 'closed'::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_active
    FROM participant_assignments
    WHERE batch_id = v_invite.batch_id
      AND group_condition = v_invite.group_condition
      AND status IN ('assigned', 'completed');
  IF v_active >= v_batch.group_size THEN
    RETURN QUERY SELECT 'full'::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  UPDATE external_invites
     SET claimed_at = now(), exp_session_id = p_exp_session
   WHERE id = v_invite.id;

  INSERT INTO participant_assignments
    (batch_id, prolific_pid, prolific_study_id, prolific_session_id,
     group_condition, exp_session_id, status)
  VALUES
    (v_invite.batch_id, v_invite.participant_id, NULL, NULL,
     v_invite.group_condition, p_exp_session, 'assigned');

  RETURN QUERY SELECT 'claimed'::TEXT, v_invite.group_condition,
                      v_invite.participant_id, v_invite.batch_id;
END;
$$;

REVOKE ALL ON FUNCTION claim_external_invite(TEXT, UUID) FROM PUBLIC, anon, authenticated;
