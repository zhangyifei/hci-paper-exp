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

### ADR-020: Distribution Charts Use True Boxplots
**Decision**: Replace the behavioral distribution charts and the survey construct distribution panels with true boxplots computed from raw participant values.
**Date**: 2026-04-03
**Rationale**: The previous charts used mean bars with standard-deviation whiskers plus raw points, which can be mistaken for boxplots and does not communicate quartiles or median. The stats page now uses actual box-and-whisker summaries for distribution views while keeping the separate grouped means chart for the explicitly mean-based survey overview.

### ADR-021: Survey Means Overview Uses Point-Interval Marks, Not Bars
**Decision**: Replace the remaining grouped bar chart in the survey overview with a point-and-interval chart that shows means as dots and standard deviations as whiskers.
**Date**: 2026-04-03
**Rationale**: Even when correctly labeled, the grouped bars in the survey means overview visually resembled the old misleading bar-and-whisker distribution charts. Switching to point estimates with intervals makes it clear that Figure 3 is a summary-of-means view, while Figure 4 remains the actual distribution view.

### ADR-022: Custom Stats Charts Surface Exact Values Inline
**Decision**: Add hover/click selection states and inline detail cards to the custom SVG charts on `/stats`, instead of leaving the figures as non-interactive images.
**Date**: 2026-04-03
**Rationale**: The boxplots and mean-interval charts are readable as shapes, but exact values are difficult to inspect without zooming or cross-referencing tables. Inline detail cards make quartiles, whiskers, means, and intervals directly inspectable from the chart itself.

### ADR-023: Survey Overview Figure Uses Grouped Boxplots
**Decision**: Replace the survey overview figure with a grouped boxplot chart that shows all four constructs within each condition, rather than a separate mean-and-interval summary.
**Date**: 2026-04-03
**Rationale**: The point-and-interval view still read as a different statistical summary from the boxplot-based charts below it and kept causing confusion about whether the survey overview was a boxplot. Grouped boxplots make Figure 3 and Figure 4 statistically consistent while preserving an all-constructs overview in a single figure.

### ADR-024: Two Presentation Modes (Phone Frame vs Full-Browser Research Pages)
**Decision**: Move the device frame out of the global layout into a `PhoneFrame` component used only by Super App task screens; render all research pages (consent, study intro/scenario, per-task instructions, both questionnaires, completion/termination) full-browser via a `ResearchPage` container.
**Date**: 2026-06-24
**Rationale**: Implements the SuperApp PDF requirement that only the interactive Super App appears inside a mobile-phone frame, while research pages are responsive, centered, comfortable-reading-width pages. Landing `/` and `/stats` now also render full-browser.

### ADR-025: Per-Task Instruction Pages, Persistent Indicator, and Idle Guidance Banner
**Decision**: Split the combined scenario screen into per-task instruction pages (Task 1 before the ride, Task 2 before the second service) each with a "Start Task N" button; add a persistent task indicator and a non-blocking idle guidance banner (configurable `guidanceThresholdMs`, default 10s) sourced from new `task1`/`task2` config blocks.
**Date**: 2026-06-24
**Rationale**: Implements the PDF task-guidance spec. The banner and indicator are rendered as a `PhoneFrame` overlay; the banner is fully non-blocking (pointer-events only on its dismiss control) and positioned above the primary CTA so it never covers important controls. The ride→service2 manipulation (banner presence + auto-populate, validated by the MC survey items) is preserved; Task 2 instructions are shown equally to all conditions.

### ADR-026: Fully Interactive Courier Entry
**Decision**: Replace the simulated sender/recipient address displays with real controlled inputs (labels, focus states, validation, condition-gated `addressSuggestions`), selectable saved/recent recipient addresses with a clear selected state and Change control, and an always-active Confirm that validates on click.
**Date**: 2026-06-24
**Rationale**: Implements the PDF "Courier task interaction" requirements. Suggestions remain gated by condition so the manipulation is unchanged.

### ADR-027: Active-Submit Validation and Paginated Feedback Survey
**Decision**: Make both questionnaires full-browser with always-active submit buttons that validate on click (top warning banner, accessible per-item highlighting that is not colour-only, scroll-to/focus first unanswered, answers preserved). Paginate the post-task survey into two pages with a progress bar, "Page X of 2", sequential participant-facing numbering (internal codes hidden), and the attention check placed mid-survey.
**Date**: 2026-06-24
**Rationale**: Implements the PDF questionnaire and submit-behaviour requirements while keeping AC-failure termination intact.

### ADR-028: Remove Persistent Task Indicator; Self-Re-Arming Idle Guidance Banner
**Decision**: Remove the always-on `TaskIndicator` pill (and its `?` Help affordance / `helpNonce` plumbing). The only in-task guidance is now the idle `GuidanceBanner`, which auto-appears after `guidanceThresholdMs` (10s) of inactivity and, once dismissed, re-arms so it resurfaces only if the participant stalls again.
**Date**: 2026-06-24
**Rationale**: The persistent indicator was visual clutter and a constant prompt. A self-re-arming idle hint is less intrusive and "smarter" — it stays out of the way while the participant is active and only re-offers help when they appear stuck. The `indicator` config field is retained but no longer rendered.

### ADR-029: Participants Must Enter Required Addresses (Ride Destination + Eats Delivery)
**Decision**: Make the ride Home "Where to?" a real, required destination input (gates "Start a Ride") for all conditions, and make the Eats no-autofill (G3) "Deliver to" a real, required input that must be valid before a restaurant can be selected. Auto-populate conditions (G2 sender, G4 delivery) remain pre-filled as the manipulation.
**Date**: 2026-06-24
**Rationale**: Task instructions told participants to "enter your destination/delivery address," but the ride destination was a static label and the G3 delivery address was a non-interactive div, so the info was never actually entered. Requiring entry in the non-autofill conditions makes the Eats flow symmetric with the already-interactive Courier flow and makes the auto-populate manipulation (and Service 2 timing) meaningful. Validation reuses the existing street-address heuristic (length ≥ 5, contains a digit and letters). Test ids `input-destination` and `input-delivery-address` added; `deliver-address-empty` wrapper id preserved.
