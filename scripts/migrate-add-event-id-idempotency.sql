-- Make event upload retries safe. An event_id represents one client event, so
-- keep the earliest stored copy before enforcing uniqueness.

WITH duplicate_events AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY id ASC) AS duplicate_number
  FROM experiment_events
)
DELETE FROM experiment_events
WHERE id IN (
  SELECT id
  FROM duplicate_events
  WHERE duplicate_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_event_id_unique
  ON experiment_events (event_id);
