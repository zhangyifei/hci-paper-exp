# AGENTS.md — HCI Experiment Harness

## Project Overview

A **Next.js + TypeScript** web experiment for a 2×2 between-subjects HCI study.
Participants complete a super-app flow (Ride → Trip Complete → Service 2) across 4 conditions (G1–G4).
Hosted on **Vercel** with **Vercel Postgres** for event storage.

---

## Architecture

```
src/
  app/
    page.tsx                   ← Landing (Prolific param capture)
    experiment/[condition]/
      page.tsx                 ← Condition router
    api/
      events/route.ts          ← POST events to Vercel Postgres
      assign/route.ts          ← GET condition assignment
  lib/
    experiment-config.ts       ← G1–G4 typed config
    assignment.ts              ← Between-subjects assignment
    logger.ts                  ← Event logger
    timing.ts                  ← performance.mark wrapper
  components/
    RidePhase/
    TripCompletePhase/
    Service2Entry/
    Service2Task/
docs/
  contracts/
    experiment-config.json     ← G1–G4 control points (source of truth)
    event-schema.json          ← Instrumentation event schema
  memory/
    progress.md                ← Build progress log
    decisions.md               ← Architecture decisions log
  runbook.md                   ← Deployment + ops runbook
.opencode/
  opencode.json                ← Agent definitions + permissions
  agent/
    ui.md                      ← UI Prototype agent skill
    instrumentation.md         ← Instrumentation/Data agent skill
    qa.md                      ← QA/Playwright agent skill
    devops.md                  ← DevOps/Deploy agent skill
    contract.md                ← Contract agent skill
  commands/
    feature.md                 ← Feature orchestration recipe
```

---

## Agent Roles

| Role | Agent Type | Responsibilities |
|------|-----------|-----------------|
| Orchestrator | Sisyphus (main) | Plans, delegates, verifies, ships |
| Contract | subagent (contract skill) | Owns docs/contracts/*, validates all config changes |
| UI Prototype | subagent (visual-engineering + frontend-ui-ux) | Renders all 4 condition screens |
| Instrumentation | subagent (instrumentation skill) | Logger, timing, API routes, DB schema |
| QA | subagent (qa skill + playwright) | E2E tests for G1–G4 flows |
| DevOps | subagent (devops skill) | Vercel deployment, env vars, DB migrations |

---

## Contracts (NEVER BYPASS)

All G1–G4 behavioral differences MUST come exclusively from:
- `docs/contracts/experiment-config.json` — parsed at runtime by `src/lib/experiment-config.ts`

**Never** hardcode condition logic in UI components. Always read from the config.

All instrumentation events MUST conform to:
- `docs/contracts/event-schema.json`

---

## Key Decisions

1. **Between-subjects**: Each participant sees exactly ONE condition (G1|G2|G3|G4)
2. **Assignment**: `hashString(PROLIFIC_PID) % 4` → stable, reproducible
3. **Timing**: `performance.mark/measure` from `service2.entry` → `service2.task.complete`
4. **Storage**: Vercel Postgres (`@vercel/postgres`), SQL-exportable for R/SPSS
5. **Prolific**: Capture `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` from URL; redirect on completion
6. **No GitHub Actions**: Deploy directly via Vercel CLI or Vercel dashboard

---

## State Machine

```
idle → ride_in_progress → ride_submitting → trip_complete_confirmed
     → service2_entry → service2_task_active → service2_task_submitting
     → service2_task_complete → finished
     (+ error_* states at each transition)
```

---

## Condition Summary

| Condition | Service2 | Banner | Auto-Populate | List UI |
|-----------|----------|--------|--------------|---------|
| G1 | Courier | ✗ | ✗ | Generic options |
| G2 | Courier | ✓ | ✓ | Categorized by destination |
| G3 | Eats | ✗ | ✗ | Citywide popular |
| G4 | Eats | ✓ | ✓ | Distance-filtered |

---

## Instrumentation Fields (per event)

```typescript
{
  eventName: string,        // e.g. 'service2.task.complete'
  eventId: string,          // uuid
  sessionId: string,        // uuid per participant session
  participantId: string,    // PROLIFIC_PID
  sequenceId: number,       // monotonic counter
  flow: string,             // 'ride' | 'trip_complete' | 'service2'
  state: string,            // current state machine state
  timestamp: number,        // Date.now() — wall clock ms
  clientMonoMs: number,     // performance.now() — monotonic ms
  durationMs?: number,      // only on task.complete events
  parentEventId?: string,
  payload?: Record<string, unknown>,
  error?: string,
  condition: 'G1'|'G2'|'G3'|'G4',
  prolificStudyId?: string,
  prolificSessionId?: string,
}
```

---

## Rules for All Agents

1. **Read AGENTS.md first** on every session start
2. **Read relevant contract files** before touching config or events
3. **Never suppress TypeScript errors** (`as any`, `@ts-ignore`, `@ts-expect-error`)
4. **Never commit** unless orchestrator explicitly requests
5. **Never push** to remote
6. **Log all decisions** to `docs/memory/decisions.md`
7. **Update progress** in `docs/memory/progress.md` after each phase
8. **Contract gate**: All condition behavior changes go through `experiment-config.json` first
