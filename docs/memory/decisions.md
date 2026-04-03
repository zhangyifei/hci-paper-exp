# Architecture Decisions Log

## 2026-03-01

### ADR-001: Between-Subjects Design
**Decision**: Each participant sees exactly ONE condition (G1–G4).  
**Rationale**: Eliminates carry-over effects between conditions. Reduces session length per participant.  
**Assignment**: `hashString(PROLIFIC_PID) % 4` → stable, reproducible without server state.  

### ADR-002: Condition Config as Single Source of Truth
**Decision**: All G1–G4 behavioral differences come exclusively from `docs/contracts/experiment-config.json`, parsed at runtime by `src/lib/experiment-config.ts`.  
**Rationale**: Prevents UI drift between agents. Contract agent validates all changes.  
**Constraint**: Never hardcode condition logic in UI components.

### ADR-003: Timing Strategy
**Decision**: Use `performance.mark/measure` (User Timing API) from `service2.entry` to `service2.task.complete`.  
**Rationale**: Named marks are traceable in DevTools, integrate with PerformanceObserver. `performance.now()` captured as `clientMonoMs` on every event for inter-event deltas.  
**Storage**: `durationMs = Math.round(measure.duration)` stored only on `service2.task.complete` events.

### ADR-004: Storage — Vercel Blob (JSONL)
**Decision**: Use `@vercel/blob` for event storage. Each participant session is stored as a `.jsonl` file at `events/{sessionId}.jsonl`. Each line is one JSON event object.
**Rationale**: Vercel Postgres is not available on the current Vercel plan. Blob is available. JSONL is trivially loadable in R (`readLines` + `jsonlite::stream_in`) and Python (`pandas.read_json(lines=True)`).
**Write pattern**: POST to `/api/events` → append batch of events as newline-delimited JSON → `put('events/{sessionId}.jsonl', content, { addRandomSuffix: false })`.
**Export pattern**: List all blobs at prefix `events/` → download each → `cat *.jsonl` → R/SPSS.
**No SQL needed**: Filter/aggregate entirely in R/Python after export.
**Limitation**: No live SQL queries. Accepted for a research prototype.
### ADR-005: No GitHub Actions
**Decision**: Deploy via Vercel CLI (`vercel deploy --prod`) only.  
**Rationale**: User constraint. Simpler ops for a research prototype.

### ADR-006: Prolific Integration Pattern
**Decision**: Capture `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` from URL params on landing page load. Store in sessionStorage. Redirect to completion URL only AFTER event batch is confirmed saved (200 from `/api/events`).  
**Rationale**: Prevents incomplete data if redirect fires before save completes.

### ADR-007: Event Logger Design
**Decision**: Queue-based logger. Flush on: queue ≥ 10 events, 5s interval, page unload (sendBeacon).  
**Rationale**: Batching reduces API calls. sendBeacon on unload handles tab-close edge case without blocking navigation.

### ADR-008: UI Design Reference
**Decision**: Implement pixel-accurate recreation of provided Figma mockups using Tailwind CSS.  
**Key observations from mockups**:
- Mobile-first, max-width ~390px, centered on desktop
- Uber-style design system: black primary buttons, white cards, gray backgrounds
- Green accents for "from trip" badges and progress bars
- Bottom navigation: Home, Services, Activity, Account
- Status bar: 9:41, signal/wifi/battery icons
- All 4 groups share identical Ride phase screens
- G1/G3 trip complete: no banner; G2: courier banner; G4: eats banner
- G2/G4 auto-populate address with green "from trip" badge + Edit link

### ADR-009: Stack
**Decision**: Next.js 14 (App Router) + TypeScript + Tailwind CSS.  
**Rationale**: User-specified. App Router enables server components for DB access in API routes.

### ADR-010: Storage Revision — Vercel Blob (JSONL)
**Decision**: Replaced ADR-004 Vercel Postgres with Vercel Blob after confirming Postgres is not on the available plan.
**Date**: 2026-03-01
**Impact**: `/api/events` writes JSONL blobs instead of SQL rows. No DB migration needed. Export is file-based.

### ADR-011: Experiment Completion — In-App "Test Done" Screen
**Decision**: On experiment completion, show an in-app "Test Done" screen instead of redirecting to the Prolific survey URL.
**Date**: 2026-03-01
**Rationale**: Provides a controlled end state within the application. Prevents premature survey redirect if the participant needs to review anything. Completion event (`experiment.completed`) is still logged and flushed before screen transition.

### ADR-012: Parallel Playwright Test Workers
**Decision**: `playwright.config.ts` uses `fullyParallel: true` with worker count determined by CPU cores (default).
**Date**: 2026-03-01
**Rationale**: Each test uses a unique `sessionId` (`TEST_SESSION_{timestamp}_{random}`) to prevent blob data collisions between concurrent tests. 7 workers reduced suite runtime from ~45s to ~18s.

### ADR-014: Storage Optimization — Per-Batch Blob Files + Completion Rate Stats
**Decision**: Restructure Vercel Blob writes so each event flush creates a NEW file (`events/{sessionId}/{batchId}.jsonl`) instead of appending to a single session file. Additionally, write a lightweight per-session PUBLIC status file (`stats/{sessionId}.json`) containing only `{condition, startedAt, completed, completedAt}` (no PII).  
**Date**: 2026-03-01  
**Rationale**: The previous pattern (`list() + get() + put()`) cost 2 Advanced Requests per flush, exhausting the free-tier 2,000 Advanced Request quota. `put()` is a *Simple Request* and does NOT count against the Advanced quota. The new pattern costs **0 Advanced Requests per flush**. Public status files are readable via free HTTP CDN fetches (not Vercel Blob ops), enabling the `/api/stats` completion-rate endpoint to cost only 1 Advanced Request (one `list()` call) regardless of participant count.  
**New endpoints**:
- `GET /api/stats` — live per-condition completion rate; protected by `STATS_SECRET` Bearer token
- `GET /api/export` — full JSONL dump for R/SPSS; expensive (~1+N Advanced Requests); run once at end of study  
**Tradeoff**: Export is now costlier in Advanced Requests (1 per batch file downloaded), but this is a one-time operation. The study write budget is effectively unlimited under the free tier.

### ADR-013: Animated Progress Bars for Wait Screens
**Decision**: Replace static wait timers on `RideAlmostThereScreen` and `CourierDeliveryScreen` with `requestAnimationFrame`-driven progress bars showing a countdown.
**Date**: 2026-03-01
**Rationale**: Improves perceived responsiveness and communicates expected wait duration clearly to participants, reducing confusion during timed transitions.

### ADR-015: Server-Only Supabase Admin Client With Secret-Key Fallback
**Decision**: Remove the unused `utils/supabase/*` SSR helpers and standardize backend DB access on a server-only admin client under `lib/supabase/admin.ts`. Refactor paper-analysis scripts to read Supabase credentials from environment variables via a shared helper instead of embedding credentials in source. Prefer `SUPABASE_SECRET_KEY`, with `SUPABASE_SERVICE_ROLE_KEY` accepted only as a legacy fallback.
**Date**: 2026-04-02
**Rationale**: This application does not use Supabase Auth or cookie-based sessions, so `@supabase/ssr` would add framework-specific auth helpers without solving a real problem here. A server-only admin client matches the actual architecture: all DB reads and writes happen in Next route handlers and offline scripts. Secret-key preference improves alignment with current Supabase guidance while preserving compatibility with older projects.

### ADR-016: Paper Stats Access Uses Server-Side Env Secret, Not Client-Side Constant
**Decision**: Protect `/api/paper-stats` with `PAPER_STATS_SECRET` falling back to `STATS_SECRET`, and remove all hardcoded password checks from the client-side `/stats` page.
**Date**: 2026-04-02
**Rationale**: A password embedded in both the API route and the client bundle provides no effective access control. The client should submit user-entered credentials to the server, and only the server should compare them against an environment-backed secret.

### ADR-017: Shared Paper-Stats Analysis Module for API and Offline Scripts
**Decision**: Centralize paper-stats aggregation in `lib/paper-stats/analysis.ts` and have `/api/paper-stats` plus the offline paper-analysis scripts import that shared module instead of maintaining separate copies of the same logic.
**Date**: 2026-04-02
**Rationale**: The API route and the `scripts/paper-stats*.ts` files had drift-prone duplicate implementations for session grouping, completion detection, banner uptake, survey aggregates, and demographic rollups. A shared analysis module keeps the stats definitions consistent across the dashboard and paper export tooling, reduces maintenance overhead, and removes the remaining loose `any` usage from the stats scripts.

### ADR-018: Paper Survey Aggregates Exclude Bots and Preserve Missingness
**Decision**: Treat bot sessions as excluded across all paper-facing aggregates, not only behavioral metrics, and represent empty comparison groups with `null` means/SDs instead of synthetic zeros.
**Date**: 2026-04-02
**Rationale**: The paper-stats dashboard and scripts are used for study analysis, so survey constructs, demographic summaries, and factor comparisons must follow the same bot-exclusion rule as completion and timing metrics. Empty cells should remain visibly missing in the output rather than being coerced into `0.00`, which would imply an observed measurement that does not exist.

### ADR-019: Stats Charts Use Hidden Numeric X-Axes for Observation Dots
**Decision**: Render raw observation dots on the stats dashboard against a separate hidden numeric x-axis with slight horizontal jitter, while keeping the visible x-axis categorical for bar labels.
**Date**: 2026-04-03
**Rationale**: Recharts was treating scatter observations as additional categories on the visible x-axis, which made labels repeat and compressed the charts until the data became unreadable. Separating bar categories from dot coordinates preserves readability while still showing individual observations.
