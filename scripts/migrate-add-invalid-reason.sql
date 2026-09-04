-- Record WHY a session was invalidated (e.g. which attention check failed) so
-- the admin roster can show a rejection reason for Prolific payment decisions.
-- Safe to run multiple times (idempotent).

ALTER TABLE participant_assignments
  ADD COLUMN IF NOT EXISTS invalid_reason TEXT;
