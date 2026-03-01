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

## Data Export

Events are stored in Vercel Blob as JSONL files, one per participant session:
- Path pattern: `events/{sessionId}.jsonl`
- Each line: one JSON event object (see `docs/contracts/event-schema.json`)

### List all session files
```bash
# Via Vercel Dashboard → Storage → Blob → browse files
# Or via Vercel Blob API:
curl -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  "https://blob.vercel-storage.com/?prefix=events/"
```

### Download and convert to CSV (for R/SPSS)

```bash
# 1. List all blobs and extract URLs
curl -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  "https://blob.vercel-storage.com/?prefix=events/" \
  | jq -r '.blobs[].url' > blob_urls.txt

# 2. Download all JSONL files and concatenate
while read url; do curl -s "$url"; done < blob_urls.txt > all_events.jsonl

# 3. Convert to CSV using jq
echo "eventName,participantId,condition,sessionId,timestamp,durationMs,state,flow,error" > events.csv
jq -r '[.eventName, .participantId, .condition, .sessionId, .timestamp, (.durationMs // ""), .state, .flow, (.error // "")] | @csv' all_events.jsonl >> events.csv
```

### Key metrics (R)
```r
library(tidyverse)

events <- read_csv("events.csv")

events %>%
  filter(eventName == "service2.task.complete") %>%
  group_by(condition) %>%
  summarise(
    n = n(),
    mean_duration_ms = mean(durationMs, na.rm = TRUE),
    sd_duration_ms = sd(durationMs, na.rm = TRUE),
    median_duration_ms = median(durationMs, na.rm = TRUE)
  )
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob token (auto-injected when store is linked) |
| `NEXT_PUBLIC_PROLIFIC_COMPLETION_URL` | Yes | Prolific completion redirect URL with your study code |

> `BLOB_READ_WRITE_TOKEN` is automatically available in Vercel deployments once the Blob store is linked. You only need it locally via `vercel env pull`.

---

## Monitoring

### Check event counts per condition (via jq on exported JSONL)
```bash
jq -r '.condition' all_events.jsonl | sort | uniq -c
```

### Find sessions that started but never completed
```bash
# Sessions with service2.entry but no service2.task.complete
comm -23 \
  <(jq -r 'select(.eventName == "service2.entry") | .sessionId' all_events.jsonl | sort -u) \
  <(jq -r 'select(.eventName == "service2.task.complete") | .sessionId' all_events.jsonl | sort -u)
```

---

## Rollback

If a bad deploy is pushed:
```bash
vercel rollback
```

Or promote a previous deployment from **Vercel Dashboard → Deployments → Promote**.
