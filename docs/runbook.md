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

### 4. Set Prolific completion URL
```bash
vercel env add NEXT_PUBLIC_PROLIFIC_COMPLETION_URL production
# Enter: https://app.prolific.co/submissions/complete?cc=YOUR_CODE
```
> Get `YOUR_CODE` from Prolific Study → "Record completions manually" → completion code.

### 5. Set stats/export secret
```bash
vercel env add STATS_SECRET production
# Choose any strong random string, e.g.: openssl rand -hex 32
```
> This protects the `/api/stats` and `/api/export` endpoints from public access.

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
| `NEXT_PUBLIC_PROLIFIC_COMPLETION_URL` | Yes | Prolific completion redirect URL with your study code |
| `STATS_SECRET` | Yes | Bearer token protecting `/api/stats` and `/api/export` |

> `BLOB_READ_WRITE_TOKEN` is automatically available in Vercel deployments once the Blob store is linked. You only need it locally via `vercel env pull`.

---

## Rollback

If a bad deploy is pushed:
```bash
vercel rollback
```

Or promote a previous deployment from **Vercel Dashboard → Deployments → Promote**.
