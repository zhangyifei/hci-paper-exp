# Build Progress Log

## Phase 0 — Harness Setup
**Date**: 2026-03-01  
**Status**: ✅ Complete

### Files Created
- `AGENTS.md` — Agent roles, architecture, state machine, condition summary
- `.opencode/opencode.json` — Agent definitions with tool permissions
- `.opencode/agent/contract.md` — Contract agent skill
- `.opencode/agent/ui.md` — UI prototype agent skill
- `.opencode/agent/instrumentation.md` — Instrumentation agent skill
- `.opencode/agent/qa.md` — QA/Playwright agent skill
- `.opencode/agent/devops.md` — DevOps/deploy agent skill
- `.opencode/commands/feature.md` — Feature orchestration recipe
- `docs/contracts/experiment-config.json` — G1–G4 control points (source of truth)
- `docs/contracts/event-schema.json` — Instrumentation event schema
- `docs/memory/progress.md` — This file
- `docs/memory/decisions.md` — Architecture decisions log
- `docs/runbook.md` — Deployment + ops runbook

---

## Phase 1 — Next.js Scaffold
**Date**: 2026-03-01  
**Status**: ✅ Complete

### Files Created
- `package.json` — Next.js 14, React 18, @vercel/blob, Tailwind, Playwright, TypeScript
- `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `next.config.js`
- `next-env.d.ts`, `.gitignore`, `.env.local.example`
- `app/layout.tsx`, `app/globals.css`
- `npm install` completed successfully

---

## Phase 2 — Experiment Config + Assignment
**Date**: 2026-03-01  
**Status**: ✅ Complete

### Files Created
- `lib/experiment-config.ts` — typed `ConditionConfig`, `getConditionConfig()`, `CONDITIONS`
- `lib/assignment.ts` — `assignCondition(pid, override?)` using djb2 hash % 4
- `lib/types.ts` — `ExperimentState`, `ProlificParams`, `ExperimentSession` types

---

## Phase 3 — Instrumentation Layer
**Date**: 2026-03-01  
**Status**: ✅ Complete

### Files Created
- `lib/timing.ts` — `markService2Entry()`, `markService2Complete()` → returns `durationMs`
- `lib/logger.ts` — queue-based `EventLogger` singleton; flush on 10 events / 5s interval / `sendBeacon` on unload; `flushAndWait()` for pre-redirect flush
- `app/api/events/route.ts` — POST endpoint; appends to `events/{sessionId}.jsonl` in Vercel Blob (edge runtime)
- `app/api/assign/route.ts` — GET endpoint; returns condition for a PID (edge runtime)

---

## Phase 4 — UI: 4-Phase Experiment Flow
**Date**: 2026-03-01  
**Status**: ✅ Complete

Design mockups analyzed. Key findings per condition:
- **G1**: No banner, no auto-fill. Courier pickup options: Small $8, Medium $12, Large $24.
- **G2**: Banner "Need to sent package? Send Now". Auto-fill "Rue Saint-Laurent - spot 01". Options: Express (15min) $12, Standard (1hr) $8. "Popular nearby" on completion.
- **G3**: No banner, no auto-fill. Eats: empty address, citywide "Top Rate in Uber" list.
- **G4**: Banner "Arrived at your destination, 3+ restaurants nearby / Eat". Auto-fill. Distance-sorted "Nearby Popular" list. "Explore More Serves" on completion.

### Files Created
- `components/ExperimentFlow.tsx` — state machine orchestrator
- `components/shared/StatusBar.tsx`, `components/shared/BottomNav.tsx`
- `components/RidePhase/HomeScreen.tsx`, `MapScreen.tsx`, `RideAlmostThereScreen.tsx`
- `components/TripCompletePhase/TripCompleteScreen.tsx`
- `components/Service2Phase/CourierEntryScreen.tsx`, `CourierDeliveryScreen.tsx`, `CourierCompleteScreen.tsx`
- `components/Service2Phase/EatsEntryScreen.tsx`, `EatsRestaurantScreen.tsx`, `EatsCompleteScreen.tsx`

### Verification
- `npx tsc --noEmit` → ✅ clean
- `npm run build` → ✅ clean

---

## Phase 5 — Prolific Integration
**Date**: 2026-03-01  
**Status**: ✅ Complete

### Files Created/Updated
- `app/page.tsx` — landing page captures `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` from URL; assigns condition; redirects to `/experiment/[condition]`
- `app/experiment/[condition]/page.tsx` — reads sessionStorage, calls `logger.init()`, renders `<ExperimentFlow>`
- Completion redirect: `logger.flushAndWait()` then Prolific redirect URL

---

## Phase 6 — QA (Playwright)
**Date**: 2026-03-01  
**Status**: ✅ Complete — 33/33 tests passing with 7 parallel workers

### Files Created
- `playwright.config.ts` — Chromium, 390×844 viewport, webServer starts `npm run dev`
- `tests/e2e/shared/helpers.ts` — `goToCondition()`, `completeRidePhase()`, `assertBannerVisible()`, etc.
- `tests/e2e/shared/assignment.spec.ts` — assignment unit tests + API smoke tests
- `tests/e2e/g1-courier-no-autofill.spec.ts` — 6 tests
- `tests/e2e/g2-courier-autofill.spec.ts` — 6 tests
- `tests/e2e/g3-eats-no-autofill.spec.ts` — 5 tests
- `tests/e2e/g4-eats-autofill.spec.ts` — 5 tests

### Fix Applied
- `tests/e2e/shared/assignment.spec.ts`: corrected import path `../../lib/assignment` → `../../../lib/assignment`

---

## Phase 7 — Vercel Deployment
**Date**: 2026-03-01  
**Status**: ✅ Complete

### Files Created/Updated
- `vercel.json` — framework, build/install commands, function timeouts, no-cache headers for API routes
- `.env.local.example` — updated with all required env vars and instructions
- `docs/runbook.md` — updated to reflect Vercel Blob (removed Postgres references), added JSONL data export section and R analysis snippet

### Deployment Details
- **Production URL**: https://hci-paper-exp.vercel.app
- **Build**: `npm run build` → ✅ clean (Next.js 14.2.35)
- **Smoke tests**:
  - `GET /api/assign?pid=TEST_PARTICIPANT_001` → `{"condition":"G4","pid":"TEST_PARTICIPANT_001"}` ✅
  - `POST /api/events` with empty array → `{"ok":true,"inserted":0}` ✅

---

## Phase 8 — Full Feature Workflow (UI + Instrumentation + QA + Deploy)
**Date**: 2026-03-01  
**Status**: ✅ Complete

### Summary of Changes
**Contract**:
- Fixed typo in `experiment-config.json` G2 `bannerText` ("sent" → "send", "divers" → "drivers")
- Added `service2.complete.viewed` to `event-schema.json`

**UI**:
- Responsive layout: `min-h-screen` → `min-h-full` across all phase components; safe area padding on StatusBar/BottomNav
- Animated progress bars with `requestAnimationFrame` on `RideAlmostThereScreen` and `CourierDeliveryScreen`
- Touch-action fix (`pan-x pan-y`) + `flex-shrink-0` for horizontal card carousel scrolling
- "Test Done" screen on experiment completion (no redirect to survey)
- `TripCompleteScreen`: banner text sourced from `config.bannerText` (no hardcoding)
- `EatsEntryScreen`: address from `config.addressLabel/addressSublabel`, `data-testid` on toggles
- `CourierEntryScreen`: "Choose by Destination" heading for G2; Edit button wired

**Instrumentation**:
- Added `ride.option_selected` (MapScreen mount), `service2.task.started` (CourierDelivery/EatsRestaurant mount)
- Added `service2.task.submitting`, `service2.address_edited`, `service2.complete.viewed`
- Added `experiment.error` on flush failure; `experiment.completed` before showing "Test Done"
- `durationMs` defaults to `0` if `markService2Complete()` returns `undefined`

**Storage**:
- `@vercel/blob` upgraded `0.27.3` → `2.3.0`
- `/api/events`: `access: 'private'`, `allowOverwrite: true`, `get()` for stream-based read
- All AGENTS.md / `.cursor/rules` / `.opencode/agent` references updated from Vercel Postgres → Vercel Blob

**Dependencies**:
- `next` updated `^14.2.29` → `^14.2.35`

**QA**:
- `playwright.config.ts`: `fullyParallel: true`, removed dummy `BLOB_READ_WRITE_TOKEN` override
- `helpers.ts`: unique `sessionId` per test run; `force: true` clicks; increased timeouts
- All 4 condition spec files: fixed text assertions (emoji removal, exact phrases, distance spacing)
- **Result**: 33/33 tests passing in 18s with 7 workers

---

## Phase 9 — Repo Review + Unused Code Cleanup
**Date**: 2026-04-02
**Status**: ✅ Complete

### Review Findings Addressed
- Removed newly added `utils/supabase/*` helpers because they were not referenced anywhere in the application and duplicated the existing `lib/supabase.ts` server access path.
- Removed the unused `@supabase/ssr` dependency after deleting those helpers.
- Refactored `scripts/paper-stats.ts`, `scripts/paper-stats-v2.ts`, and `scripts/paper-stats-survey.ts` to use a shared env-based Supabase helper instead of embedding credentials in source files.
- Corrected `scripts/paper-stats.ts` banner usage detection to the actual tracked event name: `trip_complete.banner_tapped`.

### Verification
- `npm run type-check` → passing after cleanup

### Follow-up Refactor
- Replaced `lib/supabase.ts` with a server-only admin client at `lib/supabase/admin.ts`.
- Added `lib/supabase/admin-client.ts` as a shared factory so route handlers and scripts use the same secret-key-first configuration.
- Updated API routes to import `supabaseAdmin` from the new path.
- Updated `.env.local.example` to document `SUPABASE_SECRET_KEY` as the preferred backend credential and `SUPABASE_SERVICE_ROLE_KEY` as legacy fallback.

### Review Fixes
- Removed the hardcoded paper-stats password from both `app/api/paper-stats/route.ts` and `app/stats/page.tsx`; server auth now uses `PAPER_STATS_SECRET` or `STATS_SECRET`.
- Updated the shared Playwright helper to complete the background questionnaire before asserting the ride flow, matching the current questionnaire-first experiment flow.
- Added basic e2e coverage for the new stats feature: password gate rendering on `/stats` and unauthorized access rejection on `/api/paper-stats`.

### Stats Consolidation
- Added `lib/paper-stats/analysis.ts` as the shared source of truth for paper-facing aggregation: session summaries, condition stats, survey constructs, comparison groups, demographics, and event-name counts.
- Refactored `app/api/paper-stats/route.ts` to fetch rows and delegate aggregation entirely to `computePaperStats(...)`.
- Refactored `scripts/paper-stats.ts`, `scripts/paper-stats-v2.ts`, and `scripts/paper-stats-survey.ts` to reuse the shared analysis/types instead of carrying parallel math and payload-parsing logic.
- Updated `scripts/lib/supabase-admin.ts` to reuse the shared event-row type.

### Verification
- `npm run type-check` → passing
- `npm run build` → passing
- `npx playwright test tests/e2e/stats-dashboard.spec.ts` → 2 passed

### Stats Review Fixes
- Excluded bot sessions from survey aggregates, comparison groups, and demographic summaries in `lib/paper-stats/analysis.ts`, aligning all paper-facing outputs with the existing non-bot behavioral filtering.
- Changed empty group-comparison cells to surface `null` stats so the dashboard renders missing data as `—` instead of fabricated `0.00 (0.00)` values.
- Expanded `tests/e2e/stats-dashboard.spec.ts` with deterministic assertions for `computePaperStats(...)` and a mocked successful dashboard load, covering the new shared analysis path as well as the UI render path.

### Chart Readability Fix
- Refactored `components/stats/BehavioralChart.tsx` and `components/stats/SurveyChart.tsx` so scatter dots use a hidden numeric x-axis with deterministic jitter instead of sharing the categorical bar axis.
- Kept the visible x-axis categorical and non-duplicated, which removes the repeated labels and restores readable spacing between the four conditions.
- Updated tooltip handling so both bar and dot hover states still resolve to the correct condition label after the axis split.

### Boxplot Upgrade
- Added `components/stats/BoxPlotChart.tsx` as a reusable SVG boxplot renderer based on quartiles, median, Tukey whiskers, and outlier dots.
- Replaced the behavioral charts on the stats page with true boxplots built from raw `values`.
- Replaced the survey distribution panels with true boxplots while leaving the separate grouped-means survey overview chart in place.

### Survey Overview Chart Fix
- Replaced the remaining grouped bar chart in `components/stats/SurveyChart.tsx` with a custom point-and-interval overview chart so Figure 3 no longer reads like a second distribution chart.
- Kept the dashed 4.0 midpoint reference and construct legend, but changed the visual marks to dots for means and whiskers for `±1 SD`.

### Chart Detail Interaction
- Added hover/click detail cards to the custom survey mean chart so Figure 3 exposes exact mean, SD, low, and high values for the selected point.
- Added hover/click detail cards to `components/stats/BoxPlotChart.tsx` so each selected box reveals `n`, quartiles, whiskers, min/max, and outliers inline.

### Survey Overview Boxplot Conversion
- Replaced Figure 3 in `components/stats/SurveyChart.tsx` with a grouped boxplot overview that shows all four constructs within each condition.
- Reused the shared boxplot summary math so the overview and the per-construct panels report the same quartile/whisker definitions.
- Kept inline detail cards on the grouped overview so selected boxes expose exact quartiles, whiskers, max, and outlier values.
