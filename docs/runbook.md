# Runbook — HCI Experiment Deployment & Ops

## Prerequisites

- Node.js 22+
- Vercel CLI: `npm i -g vercel`
- Access to Vercel project (hci-paper-exp)
- Prolific study created with completion URL

---

## Initial Setup

### 1. Install dependencies
```bash
npm install
```
### 2. Link to Vercel project
```bash
vercel link
# Select: hci-paper-exp project
```

### 3. Provision Vercel Blob store
1. Go to **Vercel Dashboard → Storage → Create Store → Blob**
2. Name it `hci-events` (or any name)
3. Link to the `hci-paper-exp` project (all environments)
4. Pull env vars locally:
```bash
vercel env pull .env.local
# This writes BLOB_READ_WRITE_TOKEN to .env.local
```

### 4. Set Prolific completion URLs
```bash
# Valid completion (participant finished properly → approve payment)
vercel env add PROLIFIC_COMPLETION_URL production
# Enter: https://app.prolific.com/submissions/complete?cc=VALID_CODE

# Invalid session (attention-check failure or timeout → failed-study return)
vercel env add PROLIFIC_FAILED_URL production
# Enter: https://app.prolific.com/submissions/complete?cc=FAIL_CODE
```
> Create participant-operated codes in Prolific for a successful completion and
> an invalidated-session return. Also create exactly one researcher-operated
> `COMPLETED` code whose only action is `MANUALLY_REVIEW`; the server uses this
> separate code for its backup completion transition.

Set `PROLIFIC_API_TOKEN` in production as well. After the full app event trail
is validated, `/api/complete` looks up the unique researcher-operated manual
review code for the study recorded in the event trail, and uses it for
Prolific's idempotent `COMPLETE` transition before redirecting the browser.
If that code is missing, ambiguous, or has another action, the server skips
the transition. The completion screen continues to show the participant code
and a persistent return button as the fallback.
For a server-validated attention-check failure or timeout, `/api/events`
directly requests a return using the stored submission ID and `/api/complete`
retries that request. This also protects studies that were already published
with a manual-review failure code, because published completion actions cannot
be edited afterward.
> The configured URLs remain server-only; `/api/complete` returns only the code
> selected after validating the recorded event trail.

### 4a. Configure the Prolific terminal-status webhook

1. Use the Prolific API to create or replace the workspace webhook secret.
2. Store that returned HMAC secret in Vercel as `PROLIFIC_WEBHOOK_SECRET`.
3. Create a subscription for `submission.status.change` targeting
   `https://hci-paper-exp.vercel.app/api/prolific/webhook`.
4. Confirm the subscription with the one-time `X-Hook-Secret` returned when the
   subscription is created.

The endpoint verifies `X-Prolific-Request-Signature`, re-fetches the current
submission, verifies participant/study linkage, and releases app capacity only
for current `RETURNED`, `REJECTED`, or `TIMED-OUT` states. Prolific retries
failed webhook delivery, and `/api/assign` remains the fail-closed fallback.
No frequent Vercel cron is configured because Hobby deployments allow only one
cron invocation per day; a daily backup would not materially reduce this gap.

### 5. Set stats/export secret
```bash
vercel env add STATS_SECRET production
# Choose any strong random string, e.g.: openssl rand -hex 32
```
> This protects the `/api/stats` and `/api/export` endpoints from public access.
> The same secret (or `PAPER_STATS_SECRET`) gates the `/admin` batch dashboard.

### 6. Apply the batch-management migration
Run `scripts/migrate-add-batches.sql` once against the Supabase database
(SQL editor or `psql`). It creates `test_batches`, `participant_assignments`,
and the atomic `assign_participant()` function. Idempotent — safe to re-run.

Run `scripts/migrate-add-event-id-idempotency.sql` once as well. It removes
duplicate copies of the same `event_id` (keeping the earliest row) and adds the
unique index required by the retry-safe `/api/events` upsert.

Run `scripts/migrate-validate-prolific-assignment-identity.sql` once as well.
It rejects missing, malformed, or literal URL-template Prolific identifiers
inside the atomic assignment function before they can reserve a group slot.

### 7. Start a batch before recruiting
Open `/admin`, enter the secret, and **Start batch** (4 groups × 25 by
default). Assignment requires an **active** batch — without one, real
participants (those without a `?condition=` override) see the "Study Not Open"
screen. When every group hits capacity they see "Study Full".

Before showing `Study Full`, the assignment endpoint performs one fail-closed
reconciliation pass against Prolific. App reservations whose submissions are
`RETURNED`, `REJECTED`, or `TIMED-OUT` are released, and the atomic assignment
is retried once. Active submissions remain reserved. A stale app row is marked
completed only when the server contains the complete same-session experiment
event trail. This requires `PROLIFIC_API_TOKEN` in the production environment;
if Prolific is unavailable, no slot is released automatically.

**Prolific reconciliation**: the `/admin` roster links each `PROLIFIC_PID` to
its group and completion status. Use *Copy completed PIDs* / *Download CSV* to
approve payments for participants whose status is `completed`.

The signed `submission.status.change` webhook is the normal reconciliation
path. Every `AWAITING REVIEW` transition checks the current Prolific submission,
the matching app assignment, and the exact-session event trail. A valid full
trail repairs a stale app completion automatically. An incomplete NOCODE is
given the two-minute event-upload grace period; while that grace is active the
endpoint responds retryably so Prolific redelivers the same signed event. If the
trail is still incomplete after the grace period, the retry requests a return
and stores the missing-event evidence. Confirmed `RETURNED`, `REJECTED`, and
`TIMED-OUT` transitions release app capacity automatically.

The browser starts flushing its event outbox at 32 KiB and sends sequential
chunks capped at 48 KiB. This stays below Fetch's 64 KiB keepalive limit. Each
successful chunk removes only its acknowledged event IDs, leaving later or
failed chunks available for retry. `/api/events` evaluates Prolific disposition
from the complete persisted session trail, so completion evidence can span
several chunks.

**Reconcile Prolific** is a backup for a missed or exhausted webhook delivery,
not a routine during-study action. Use it only when Prolific and the app still
disagree, a NOCODE remains unresolved, or a replacement reports Study Full.
The action never rejects a participant. A full app event trail is retained as
a valid completion. An `AWAITING REVIEW` NOCODE submission that is at least two
minutes old and still lacks the required trail receives a Prolific return
request; its app slot stays reserved until Prolific confirms a terminal status.
The roster's `invalid_reason` records the submission ID, missing completion
milestones, and checked timestamp, and that
evidence is preserved in both CSV and Excel exports. Prolific recruits the
replacement after the participant accepts the return. If they do not return,
contact Prolific Support before the auto-approval deadline.

---

## Deployment

### Staging deploy
```bash
npm run build        # Must pass before deploy
vercel deploy        # Preview URL
```

### Production deploy
```bash
npm run build
vercel deploy --prod
```

### Smoke test after deploy
```bash
# Check assign endpoint
curl "https://your-app.vercel.app/api/assign?pid=TEST_USER_001"
# Expected: { "condition": "G1"|"G2"|"G3"|"G4", "pid": "TEST_USER_001" }

# Check events endpoint
curl -X POST "https://your-app.vercel.app/api/events" \
  -H "Content-Type: application/json" \
  -d '{"events": []}'
# Expected: { "ok": true, "inserted": 0 }

# Full G1 flow (manual)
# Visit: https://your-app.vercel.app/?PROLIFIC_PID=SMOKE_TEST&STUDY_ID=test&SESSION_ID=test&condition=G1
```

---

## Blob Storage Layout

Events are stored in Vercel Blob. Two types of files, both under the same Blob store:

| Path pattern | Access | Purpose |
|---|---|---|
| `events/{sessionId}/{batchId}.jsonl` | Private | Raw event data. One file per flush batch. Each line is one JSON event. |
| `stats/{sessionId}.json` | Public | Session status: condition, started, completed. No PII. Read by `/api/stats`. |

**Why separate files per batch?**
`put()` to Vercel Blob is a *Simple Request* (not counted against Advanced Request quota). The old pattern of `list() + get() + put()` per flush cost 2 Advanced Requests each. The new pattern costs **zero Advanced Requests per flush**. The Advanced Request budget is now only spent on list/download operations at export time.

---

## Monitoring

### Data-quality disposition

- `experiment.timed_out` and `experiment.invalidated` are failed/incomplete outcomes.
- `data_quality.flagged` is an analysis exclusion, not an automatic Prolific rejection.
- A session is flagged when all 30 non-attention scale answers use one value, or at least 80% of first-answer intervals are under one second.
- Flagged participants retain `experiment.completed` and the normal completion-code path. Review and pay them under Prolific policy while excluding them from scored exports and paper-facing aggregates.
- When reviewing a batch, preserve the original raw events, responses, timestamps, identifiers, Prolific status, and recorded quality reasons. Manually review every app-generated flag against the complete event trail before recommending approval, a return request, or rejection. Do not delete or rewrite excluded records; mark confirmed invalid records as excluded only in analysis outputs.
- Prolific's study-level `EXCEPTIONALLY_FAST` category is separate: when enabled, Prolific automatically rejects submissions that meet its platform criterion. Do not treat the app's rapid-response or straightlining flags as equivalent to that Prolific category.

### Live completion rate (during study)
```bash
# Costs 1 Advanced Request (list of stats/ files) + free public CDN reads
curl -H "Authorization: Bearer 7e4287eec34244e88465b160a5a972b27a605f0711cd85a2e1aa5a483c03b21a" \
  "https://hci-paper-exp.vercel.app/api/stats"
```

Example response:
```json
{
  "generatedAt": "2026-03-01T12:00:00.000Z",
  "overall": { "total": 42, "completed": 35, "completionRate": 83.33 },
  "byCondition": {
    "G1": { "total": 10, "completed": 8, "completionRate": 80.0 },
    "G2": { "total": 11, "completed": 9, "completionRate": 81.82 },
    "G3": { "total": 10, "completed": 9, "completionRate": 90.0 },
    "G4": { "total": 11, "completed": 9, "completionRate": 81.82 }
  }
}
```

### Find sessions that started but never completed (bash, on exported JSONL)
```bash
# Sessions with service2.entry but no service2.task.complete
comm -23 \
  <(jq -r 'select(.eventName == "service2.entry") | .sessionId' all_events.jsonl | sort -u) \
  <(jq -r 'select(.eventName == "service2.task.complete") | .sessionId' all_events.jsonl | sort -u)
```

### Check event counts per condition (on exported JSONL)
```bash
jq -r '.condition' all_events.jsonl | sort | uniq -c
```

### Completion rate from exported JSONL
```bash
# Overall
total=$(jq -r '.sessionId' all_events.jsonl | sort -u | wc -l | tr -d ' ')
completed=$(jq -r 'select(.eventName == "experiment.completed") | .sessionId' all_events.jsonl | sort -u | wc -l | tr -d ' ')
echo "Overall: $completed / $total sessions completed"

# Per condition
for cond in G1 G2 G3 G4; do
  t=$(jq -r --arg c "$cond" 'select(.condition == $c) | .sessionId' all_events.jsonl | sort -u | wc -l | tr -d ' ')
  c=$(jq -r --arg c "$cond" 'select(.condition == $c and .eventName == "experiment.completed") | .sessionId' all_events.jsonl | sort -u | wc -l | tr -d ' ')
  echo "$cond: $c / $t completed"
done
```

---

## Data Export

> **Note:** Export costs Advanced Requests (1 list + 1 per batch file). With 200 participants × 4 flushes = ~800 batch files, one export call costs ~801 Advanced Requests. Run this once at the end of data collection, not repeatedly during the study.

### Download all events as JSONL
```bash
# Streams all event batch files concatenated as JSONL to all_events.jsonl
curl -H "Authorization: Bearer 7e4287eec34244e88465b160a5a972b27a605f0711cd85a2e1aa5a483c03b21a" \
  "https://hci-paper-exp.vercel.app/api/export" -o all_events.jsonl
```

### Convert to CSV (for R/SPSS)
```bash
echo "eventName,participantId,condition,sessionId,timestamp,durationMs,state,flow,error" > events.csv
jq -r '[.eventName, .participantId, .condition, .sessionId, .timestamp, (.durationMs // ""), .state, .flow, (.error // "")] | @csv' all_events.jsonl >> events.csv
```

### Key metrics (R)
```r
library(tidyverse)

events <- read_csv("events.csv")

# Task completion time by condition
events %>%
  filter(eventName == "service2.task.complete") %>%
  group_by(condition) %>%
  summarise(
    n = n(),
    mean_duration_ms = mean(durationMs, na.rm = TRUE),
    sd_duration_ms = sd(durationMs, na.rm = TRUE),
    median_duration_ms = median(durationMs, na.rm = TRUE)
  )

# Completion rate by condition
events %>%
  group_by(condition, sessionId) %>%
  summarise(completed = any(eventName == "experiment.completed"), .groups = "drop") %>%
  group_by(condition) %>%
  summarise(
    n_total = n(),
    n_complete = sum(completed),
    completion_rate_pct = round(mean(completed) * 100, 1)
  )
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob token (auto-injected when store is linked) |
| `PROLIFIC_API_TOKEN` | Yes | Server-only token used for validated completion, return requests, exports, and capacity reconciliation |
| `PROLIFIC_WEBHOOK_SECRET` | Yes | Server-only HMAC secret used to verify Prolific status-change webhooks |
| `PROLIFIC_COMPLETION_URL` | Yes | Prolific redirect URL for a valid completion (approve). Server-only; chosen by /api/complete |
| `PROLIFIC_FAILED_URL` | Yes | Prolific redirect URL for an invalidated session (attention-check failure or timeout). Server-only |
| `STUDY_PASSCODE` | No | Shared access code shown on Prolific; typed on the landing page. Unset = open access |
| `STATS_SECRET` | Yes | Bearer token protecting `/api/stats` and `/api/export` |

> `BLOB_READ_WRITE_TOKEN` is automatically available in Vercel deployments once the Blob store is linked. You only need it locally via `vercel env pull`.

---

## Rollback

If a bad deploy is pushed:
```bash
vercel rollback
```

Or promote a previous deployment from **Vercel Dashboard → Deployments → Promote**.
