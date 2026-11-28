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

### SuperApp PDF UI Overhaul (2026-06-24)
- Added `components/shared/PhoneFrame.tsx` and `components/shared/ResearchPage.tsx`; moved the device frame out of `app/layout.tsx` and rescoped `app/globals.css` into `.phone-stage` / `.research-stage`. `ExperimentFlow` now wraps Super App screens in the phone frame and renders research pages full-browser.
- Added per-task instruction pages (`components/Survey/TaskInstructionScreen.tsx`), a persistent `TaskIndicator`, and a non-blocking idle `GuidanceBanner`; extended `experiment-config.json`/`experiment-config.ts` with `task1`/`task2`, `guidanceThresholdMs`, and `addressSuggestions`, and the event schema with task/guidance/back/validation events.
- Added a shared `BackButton` to the Courier/Eats entry screens and made the Courier sender/recipient fully interactive (real inputs, validation, condition-gated suggestions, selectable saved recipients).
- Reworked `PostTaskSurvey` into a paginated, code-hidden, sequentially-numbered survey with active-submit validation (warning banner, accessible highlighting, scroll/focus), and gave `BackgroundQuestionnaire` the same full-browser active-submit treatment; `LikertScale` gained numbering/invalid props.
- Updated Playwright helpers and specs for the new flow; `npx tsc --noEmit`, `npm run build`, and all 47 e2e tests pass.

---

## Phase 10 — 0809 Revision (Package Details + destination consistency)
**Date**: 2026-08-09
**Status**: ✅ Complete (Phases 1–2, 4–6 of `docs/0809/ui-update-plan.md`; Phase 3 deferred)

### Changes
- **New screen** `components/Service2Phase/PackageDetailsScreen.tsx` inserted in the courier
  flow (`service2_entry → service2_package_details → service2_delivery`), common to G1 & G2.
  The interactive "What are you sending?" selector was moved off `CourierEntryScreen`; added an
  optional "Note for courier" field.
- **Timing DV** relocated: `markService2Complete()` + `service2.task.complete` now fire on the
  Package Details "Continue" (was Courier Entry "Confirm Pickup"), threading the entry event id.
- **Destination unified** to `1000 Saint-Catherine Street West` on Trip Complete (all conditions),
  Ride "almost here" drop-off, Courier delivery drop-off, and Courier Delivery Complete; ride
  fare `$28.92 → $21.40` (delivery fee `$14.75` unchanged).
- **Contracts**: `event-schema.json` gains `service2.package_details.viewed`, `service2.item_selected`.
- **Deferred (Phase 3)**: manipulation-sensitive auto-fill address (`config.addressLabel` in G2/G4)
  left unchanged pending sender-vs-recipient sign-off.

### Verification
- `npm run type-check` → ✅ clean
- `npm run build` → ✅ clean
- `npx playwright test` (G1–G4 courier + eats) → ✅ 28 passed (16 courier + 12 eats)
- Note: local port 3000 was contended by another project on IPv6 `localhost`; ran against
  `127.0.0.1` for the suite (Playwright config reverted to `localhost`).

## Phase 11 — 0809 Revision §4 (dynamic prices) + §5 (delivery-details redesign)
**Date**: 2026-08-09
**Status**: ✅ Complete

### Changes
- **§4 dynamic prices**:
  - `MapScreen` ride options are now selectable — Voya X `$12.59` (default), Comfort `$14.33`,
    Premier `$18.11` (`data-testid="ride-option-{id}"`); the selected price threads via
    `ExperimentFlow` `ridePrice` state into `TripCompleteScreen` (was hardcoded `$21.40`).
  - Courier pickup fee threads via `courierFee` (selected `config.pickupOptions[].price`) into
    `CourierCompleteScreen` (was hardcoded `$14.75`).
  - Eats total (`$22.00`) already consistent — no change.
- **§5 delivery-details redesign**: `PackageDetailsScreen` → "Add delivery details" with a
  **TASK 2 OF 2** pill header (tab bar dropped) and fields: item type (Package/Keys/Document),
  package size (`package-size-{id}`, default Medium), estimated weight (`input-package-weight`),
  fragile toggle (`toggle-fragile`), delivery notes (`input-delivery-notes`, 0/250).
- **Flow reorder**: Courier Entry button relabeled "Continue" (`btn-courier-continue`);
  "Confirm Pickup" (`btn-confirm-pickup`) moved to the delivery-details step where the timing DV
  (`markService2Complete` + `service2.task.complete`) fires.
- **Tests**: helpers + G1/G2 specs updated for the renamed buttons; G1 now asserts the dynamic
  Trip Complete fares (`$12.59`, and `$14.33` via `ride-option-comfort`) and the courier fee
  (`$8.00`) on Delivery Complete.

### Verification
- `npm run type-check` → ✅ clean
- `npx playwright test` (G1–G4 courier + eats + post-task survey) → ✅ 37 passed
- Ran against `127.0.0.1` due to the IPv6 `localhost:3000` contention; Playwright config reverted
  to `localhost`.

---

## Phase 12 — Study address emphasis
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Added `components/shared/AddressText.tsx` to apply consistent bold and underline styling to
  `1000 Saint-Catherine Street West` and `3008 Rue McGill` without altering contract-owned copy.
- Applied the shared formatter to scenario/task instructions and non-editable address labels in
  the ride, trip-complete, Courier, and Cinema flows for G1–G4.

### Verification
- `npm run type-check` → ✅ clean
- Headless Chrome render check across G1, G2, G3, and G4 → ✅ every rendered task-address mark
  reports `font-weight: 700` and `text-decoration-line: underline`.

---

## Phase 13 — Ride destination typeahead
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Updated the shared Ride `Where to?` field so focus alone does not reveal destinations.
- Added a three-character suggestion threshold; entering `100` shows three matching addresses
  with `1000 Saint-Catherine Street West` first.
- Added combobox/listbox accessibility attributes and preserved click-to-fill behavior.
- Added a four-condition Playwright regression spec covering G1–G4.

### Verification
- `npm run type-check` → ✅ clean
- `ride-destination-typeahead.spec.ts` in installed Chrome → ✅ 4 passed (G1–G4).

---

## Phase 14 — Destination-aware Ride reminder
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Updated `task1.guidanceText` in the experiment contract for G1–G4 to include
  `1000 Saint-Catherine Street West`.
- Updated the black idle `GuidanceBanner` to render recognized task addresses in bold and
  underline through the shared `AddressText` component.
- Added a four-condition Playwright regression spec for banner copy and computed address styles.

### Verification
- Contract reminder validation → ✅ all four conditions match.
- `npm run type-check` → ✅ clean.
- `ride-guidance-banner.spec.ts` in installed Chrome → ✅ 4 passed (G1–G4).

---

## Phase 15 — Guidance banner outside-click dismissal
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Added document-level outside-pointer detection while the guidance banner is visible.
- Kept clicks inside the black banner inert and retained the explicit close button.
- Outside clicks dismiss the banner without preventing the underlying task interaction.
- Added dismissal method metadata (`outside_click` / `close_button`) to the existing
  `guidance.banner_dismissed` event.

### Verification
- `npm run type-check` → ✅ clean.
- Updated `ride-guidance-banner.spec.ts` in installed Chrome → ✅ 4 passed (G1–G4), including
  inside-click persistence and outside-click dismissal.

---

## Phase 16 — Guidance banner position adjustment
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Raised the shared task-reminder banner by 8 px (approximately 0.2 cm) for G1–G4.

### Verification
- `npm run type-check` → ✅ clean.
- `git diff --check` → ✅ clean.

---

## Phase 22 — Remove underline from 3008 Rue McGill
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Updated the shared address formatter so `3008 Rue McGill` is bold without an underline.
- Preserved bold-and-underlined styling for `1000 Saint-Catherine Street West`.
- Added a G1–G4 browser assertion for the Recent Trips address styling.

### Verification
- `npm run type-check` → ✅ clean.
- `ride-destination-typeahead.spec.ts` in installed Chrome → ✅ 4 passed (G1–G4).

---

## Phase 23 — G2/G4 Trip Complete button label
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Changed the G2 and G4 Trip Complete action label from `Done` to `Back to Home`.
- The action label is now consistent across G1–G4; navigation behavior is unchanged.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G2/G4 Trip Complete Playwright checks → ✅ 2 passed.

---

## Phase 24 — Remove Task 2 instruction page
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Removed `task2_instruction` from the experiment screen state and render flow.
- Trip Complete now advances directly to Courier or Cinema for G1–G4.
- Preserved the Task 2 `task.started` event at the direct transition.
- Updated Service 2 Back navigation to return to Trip Complete.
- Updated shared Playwright navigation helpers to assert that Task 2 instructions do not appear.

### Verification
- `npm run type-check` → ✅ clean.
- Focused direct-entry Playwright checks for G1–G4 → ✅ 4 passed.

---

## Phase 21 — Set reminder 0.8 cm above bottom
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Positioned the shared task reminder exactly `0.8cm` above the bottom edge for G1–G4.

### Verification
- `npm run type-check` → ✅ clean.
- `git diff --check` → ✅ clean.

---

## Phase 20 — Revised bottom-relative reminder placement
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Positioned the shared task reminder exactly `0.2cm` above the bottom edge for G1–G4.

### Verification
- `npm run type-check` → ✅ clean.
- `git diff --check` → ✅ clean.

---

## Phase 18 — Remove G1 Trip Complete helper
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Added nullable `tripCompleteHint` to the experiment configuration contract.
- Removed `Tap 'Back to Home' to return home and explore other services.` from G1.
- Preserved the existing helper for G3 and kept it absent for banner conditions G2/G4.
- Updated Trip Complete to render the helper from config instead of banner-based UI logic.

### Verification
- Contract validation → ✅ G1 is null and G3 retains the helper.
- `npm run type-check` → ✅ clean.
- Focused G1/G3 Trip Complete Playwright checks → ✅ 2 passed.

---

## Phase 19 — Bottom-relative reminder placement
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Positioned the shared task reminder exactly `0.5cm` above the bottom edge for G1–G4.
- Replaced the previous `139px` offset with the requested physical CSS unit.

### Verification
- `npm run type-check` → ✅ clean.
- `git diff --check` → ✅ clean.

---

## Phase 17 — Lower guidance banner position
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Lowered the shared task-reminder banner by 19 px (approximately 0.5 cm) for G1–G4.
- Updated the bottom offset from `158px` to `139px`.

### Verification
- `npm run type-check` → ✅ clean.
- `git diff --check` → ✅ clean.

---

## Phase 25 — G1/G2 scenario McGill underline
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Added a contract-controlled scenario underline setting for the secondary study address.
- Underlined `3008 Rue McGill` in both the scenario narrative and Courier task card for G1/G2.
- Preserved the non-underlined `3008 Rue McGill` styling in Recent Trips for all four groups.

### Verification
- `npm run type-check` → ✅ clean.
- Scenario Playwright checks in installed Chrome → ✅ 3 passed (including G1/G2 underline assertions).
- Ride destination regression checks in installed Chrome → ✅ 4 passed (G1–G4).
- `git diff --check` → ✅ clean.

---

## Phase 26 — G2/G3 Trip Complete reminder and G3 map removal
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Changed the Trip Complete task reminder in G2/G3 to `Tap 'Back to Home' to return home and explore other services.`
- Removed the large Trip Complete map image from G3 only.
- Preserved the map image in G1, G2, and G4.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G2/G3 Trip Complete Playwright checks in installed Chrome → ✅ 2 passed.
- `git diff --check` → ✅ clean.

---

## Phase 27 — Remove G3 Back-to-Home sentence
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Removed `Tap 'Back to Home' to return home and explore other services.` from both G3 Trip Complete text locations.
- Preserved the G2 reminder and the hidden G3 map.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G3 Trip Complete Playwright check in installed Chrome → ✅ 1 passed.
- `git diff --check` → ✅ clean.

---

## Phase 28 — Restore G3 Trip Complete map
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Restored the large map image on G3’s Trip Complete screen.
- Kept the previously removed Back-to-Home sentence absent from G3.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G3 Trip Complete Playwright check in installed Chrome → ✅ 1 passed.
- `git diff --check` → ✅ clean.

---

## Phase 29 — Group-specific Service 1 completion reminders
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Set the Trip Complete reminder to the Back-to-Home instruction for G1/G3.
- Set the Trip Complete reminder to `Task reminder: Send a package to 3008 Rue McGill.` for G2/G4.
- Left all other Trip Complete content unchanged.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G1–G4 Trip Complete Playwright checks in installed Chrome → ✅ 5 passed.
- `git diff --check` → ✅ clean.

---

## Phase 30 — G1/G3 Back to Home routing
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Added a contract-controlled Trip Complete destination for each group.
- G1/G3 Back to Home now returns to the initial Home/Rides screen instead of opening Service 2.
- The Courier tab in G1 and Cinema tab in G3 now enter Service 2 after returning home.
- G2/G4 retain their direct Service 2 transition.
- Prevented the returned Home screen from logging a second `ride.started` event.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G1/G3 Home-routing and service-tab Playwright checks → ✅ 4 passed.
- Focused G2/G4 direct-routing Playwright checks → ✅ 2 passed.
- Final G1 Home-to-Courier regression check → ✅ 1 passed after retrying an unrelated landing redirect timeout.
- `git diff --check` → ✅ clean.

---

## Phase 31 — Simplify G4 cinema reminder
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Changed G4’s final Service 1 reminder to `Task reminder: Book a ticket at a cinema near 1000 Saint-Catherine Street West.`
- Preserved G2’s package reminder and all other group copy.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G4 Trip Complete Playwright check in installed Chrome → ✅ 1 passed.
- `git diff --check` → ✅ clean.

---

## Phase 32 — Task 2 reminders on returned Home
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Switched the returned Home screen to Task 2 guidance after G1/G3 complete the ride.
- G1 now shows `Task reminder: Use Courier to send your package.`
- G3 now shows `Task reminder: Use Cinema to book your movie tickets.`
- Preserved the ride reminder on the initial Home screen.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G1/G3 returned-Home reminder Playwright checks in installed Chrome → ✅ 2 passed.
- `git diff --check` → ✅ clean.

---

## Phase 33 — G2/G3 Service 2 typed address dropdowns
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- G2 recipient input now reveals exactly two Saved & Recent options after typing, with `3008 Rue McGill` first.
- G3 cinema-location input now reveals exactly two Saved & Recent options after typing, with `1000 Saint-Catherine Street West` first.
- Added page-specific reminders describing the recipient/delivery task in G2 and the location/cinema/showtime task in G3.
- Kept G1/G4 entry behavior unchanged.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G2/G3 dropdown and reminder Playwright checks → ✅ 2 passed.
- Complete G2/G3 Task 2 flow checks → ✅ 2 passed.
- G1/G4 full-flow regression checks → ✅ 2 passed.
- `git diff --check` → ✅ clean.

---

## Phase 34 — Gate G3 nearby cinemas by task address
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Removed the initially visible Popular cinemas section from G3.
- G3 now shows no cinema heading or cards until `1000 Saint-Catherine Street West` is entered or selected.
- After the task address is selected, G3 displays `Cinemas near you` with distance-based results.
- Preserved G4’s immediately visible nearby cinema list.

### Verification
- `npm run type-check` → ✅ clean.
- Focused G3 address-gating, nearby-results, typeahead, and full-flow Playwright checks → ✅ 4 passed.
- G4 nearby-list and full-flow regression checks → ✅ 2 passed.
- `git diff --check` → ✅ clean.

---

## Phase 35 — Screen-aligned task reminder audit
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Audited reminder copy across all Super App screens in G1–G4.
- Updated initial Home guidance to tell users to enter the task address and start the ride.
- Added ride-selection and short ride-waiting reminders.
- Preserved each group’s configured Trip Complete reminder.
- Updated returned Home guidance to explicitly tell G1 users to tap Courier and G3 users to tap Cinema.
- Added page-specific Service 2 entry reminders for G1–G4.
- Added package-details and seat-selection reminders.
- Added a completion reminder directing users to tap Done.
- Remounted the guidance banner on every screen transition so stale copy cannot persist.

### Verification
- `npm run type-check` → ✅ clean.
- Screen-alignment Playwright audit across ride, Courier, and Cinema screens → ✅ 4 paths passed.
- Initial Home and returned-Home reminder regressions across G1–G4 → ✅ 6 passed.
- `git diff --check` → ✅ clean.

---

## Phase 36 — Remove Explore More from G2/G4
**Date**: 2026-10-08
**Status**: ✅ Complete

### Changes
- Removed the Explore More heading and service grid from the G2 Courier completion screen.
- Removed the Explore More heading and service grid from the G4 Cinema completion screen.
- Preserved completion details, task reminders, and the Done action.

### Verification
- `npm run type-check` → ✅ clean.
- G2/G4 full-flow Playwright checks → ✅ 2 passed.
- `git diff --check` → ✅ clean.

## 2026-10-09 — Corrected G2/G4 Back to Home transition

- Updated the condition contract so G2 and G4 return to the Rides home screen from Trip Complete.
- Preserved direct Service 2 navigation through the G2/G4 cross-service banner CTA.
- Updated E2E expectations for the home screen, relevant Service 2 tab, and Task 2 reminder.

## 2026-10-13 — Improved all local guidance messages

- Standardized the Trip Complete reminder prefix across G1–G4.
- Made G2/G4 Trip Complete reminders identify the exact banner CTA.
- Corrected G4 from one ticket to two tickets.
- Standardized G2/G4 home reminders to “Tap Courier/Cinema.”
- Updated all affected E2E message assertions.

## 2026-10-14 — Moved all task reminders to the top

- Changed the shared guidance banner from `bottom: 0.8cm` to `top: 0.8cm` for G1–G4.
- Preserved the existing idle timer, outside-click dismissal, close button, and reminder text.

## 2026-10-14 — Removed the Task 1 instruction page

- Removed `task1_instruction` from the shared experiment state flow for G1–G4.
- Scenario Continue now opens the Rides home screen directly and records Task 1 start.
- Updated shared and focused E2E setup paths to remove the extra Start Task 1 action.

## 2026-10-14 — Redesigned the scenario page

- Replaced repeated-address introductory paragraphs with natural Courier- and Cinema-specific narratives across G1–G4.
- Kept task addresses in the numbered instruction cards.
- Increased task-label text from 12px gray to 16px black.
- Updated onboarding E2E assertions for the new narrative structure.

## 2026-10-14 — Removed scenario address underlines

- Added a shared `AddressText` option that preserves bold emphasis while disabling underlines.
- Applied the no-underline treatment to the scenario narrative and both numbered task cards.
- Removed `underlineSecondaryAddressInScenario` from the G1–G4 contract and config type.
- Updated onboarding E2E styling assertions.

## 2026-10-14 — Added G1 Courier address typeaheads

- Enabled sender and recipient typeahead behavior for G1 through the condition contract.
- Hidden G1’s initial Sender and Recipient saved/recent lists.
- Added three related results for each field with the task address first and marked RECENT.
- Kept G2 at two recipient suggestions and left G3/G4 behavior unchanged.
- Added focused G1 E2E coverage for the three-option dropdowns.

## 2026-10-14 — Expanded the G3 Cinema location typeahead

- Added Cinema-specific typeahead settings to the condition contract and TypeScript config.
- G3 now waits for three typed characters and shows three related location results.
- Kept 1000 Saint-Catherine Street West first with a RECENT badge, followed by 1001 Rue Sainte-Catherine Est and 100 Rue McGill.
- Removed the extra dropdown heading for G3 while leaving G4’s auto-populated Cinema flow unchanged.
- Updated focused G3 E2E coverage for the trigger threshold, result count, order, and copy.

## 2026-10-14 — Refined scenario task-card emphasis

- Changed the instruction sentences in both scenario cards to regular weight across G1–G4.
- Preserved bold Ride, Courier, and Cinema task labels.
- Preserved bold study addresses without restoring underlines.
- Added E2E assertions for label, sentence, and address font weights.

## 2026-10-14 — Clarified the G1 Courier entry reminder

- Named 1000 Saint-Catherine Street West as the sender address.
- Named 3008 Rue McGill as the recipient address.
- Preserved the final prompt to choose a delivery option.
- Updated the guidance alignment regression expectation.

## 2026-10-14 — Restored the 3008 Rue McGill underline

- Made 3008 Rue McGill bold and underlined by default across G1–G4.
- Updated the four-condition Recent Trips regression assertion.
- Preserved the scenario page's explicit no-underline styling.

## 2026-10-14 — Standardized Courier recipient dropdowns

- Increased G2's recipient typeahead from two suggestions to three.
- Both G1 and G2 now show three options when the participant types `300`.
- Kept 3008 Rue McGill first and marked RECENT.
- Updated the G2 E2E regression and shared flow documentation.

## 2026-10-21 — Added the super-app definition and underlined task titles

- Added a short shared definition of a super app after the Voya X introduction on every scenario page.
- Included ride booking, food delivery, shopping, and payments as concrete examples.
- Underlined the bold Ride, Courier, and Cinema task titles across G1–G4.
- Preserved the regular-weight task instructions and existing address styling.
- Added onboarding E2E assertions for the definition and title underlines.

## 2026-11-04 — Bolded “super app” on the scenario screen

- Bolded “super app” in the shared introductory sentence for G1–G4.
- Added a focused E2E assertion for the rendered font weight.

## 2026-11-04 — Required complete survey pages before continuing

- Added page-level validation to the shared G1–G4 post-task survey.
- Continue now keeps participants on page 1 when any page-1 question is unanswered.
- Added an accessible warning plus focus and scroll behavior for the first missing response.
- Updated E2E coverage for the blocked and successful navigation paths.

## 2026-11-04 — Standardized survey navigation

- Removed the Back button from the shared G1–G4 survey.
- Renamed the page-2 “Submit Feedback” and page-3 “Finish” actions to “Continue.”
- Aligned validation warnings with the forward-action wording.
- Added E2E assertions for the labels and absence of backward navigation.

## 2026-11-04 — Bolded every scenario-screen “super app” mention

- Bolded “super app” in the introduction, definition, and simulated-task notice for G1–G4.
- Expanded E2E styling coverage to all three occurrences.

## 2026-11-04 — Limited “super app” emphasis to the definition

- Kept “super app” bold only in the “A super app combines…” definition for G1–G4.
- Restored regular weight in the first introductory sentence and simulated-task notice.
- Updated E2E coverage to enforce the single intended emphasis.

## 2026-11-04 — Replaced survey questions 1–5 verbatim

- Applied the supplied wording to questions 1–5 in the shared G1–G4 survey.
- Updated active batch-export wording maps to match the participant-facing text exactly.
- Preserved the existing question order, response scales, pagination, and internal IDs.
- Added exact-text E2E assertions for all five questions.

## 2026-11-04 — Locked the survey to seven response points

- Made the seven-point scale explicit in the shared G1–G4 post-task survey.
- Added E2E assertions confirming seven choices for questions 1–5.

## 2026-11-04 — Replaced survey questions 6–10 and moved the page break

- Applied the supplied wording verbatim to questions 6–10 for G1–G4.
- Expanded survey page 1 from nine to ten questions and moved the page break after question 10.
- Preserved the seven-point scale and required-response validation before Continue.
- Updated active export wording, construct scoring, shared helpers, and E2E assertions.

## 2026-11-04 — Rebuilt survey page 2 as questions 11–15

- Applied the supplied wording verbatim to continuance questions 11–14 and retained the approved attention check as question 15.
- Removed former participant-facing questions 16–20 from the live G1–G4 survey.
- Standardized active item codes to CL1–CL5, PU1–PU5, CI1–CI4, and AC1.
- Preserved seven-point scales, required-answer validation, Continue-only navigation, and the attention-check answer of 5.
- Updated active exports, simulations, paper statistics compatibility, shared helpers, and E2E coverage for the 15-item instrument.

## 2026-11-04 — Added revised survey questions 16–20

- Applied the supplied wording verbatim to Q16–Q20 for G1–G4.
- Kept Q11–Q20 together on survey page 2 with seven response points per question.
- Extended required-answer validation so all ten page-two questions must be complete before Continue.
- Added the revised MC1–MC5 wording to active exports, simulations, scoring, and E2E coverage.

## 2026-11-04 — Extended survey page 2 through question 24

- Kept Q20 unchanged and applied the supplied wording verbatim to Q21–Q24 for G1–G4.
- Moved the end-of-page-2 break after Q24.
- Extended required-answer validation so all fourteen page-two questions must be complete before Continue.
- Updated active exports, simulation scoring, shared helpers, and E2E coverage for MC5–MC9.

## 2026-11-04 — Rebuilt the final survey page as questions 25–34

- Applied the ten supplied final-page questions across G1–G4 and numbered them Q25–Q34.
- Used the revised Q27 wording exactly: “How familiar are you with super apps such as Uber, Grab, WeChat, or similar?”
- Kept the existing age and gender options and added response options appropriate to the approved familiarity, knowledge, usage, and switching questions.
- Required all ten responses before the final Continue action and retained forward-only navigation.
- Updated active exports, simulation data, shared E2E helpers, and exact-text regression coverage.
- Passed the production build and a full local browser flow verifying Q25–Q34, missing-answer warnings at Q25 and Q34, and successful completion after all ten responses.

## 2026-11-05 — Filtered Courier recipient suggestions by address prefix

- Updated the shared G1/G2 recipient typeahead to show only addresses beginning with the participant's typed prefix.
- Typing `30` now shows `3008 Rue McGill` and `300 Rue McGill` and excludes `1502 Rue Saint-Louis`.
- Preserved the configured per-condition minimum character thresholds and suggestion-count caps.
- Updated G1 and G2 E2E regression expectations for the filtered result set.
- Passed the production build and a local G2 browser flow confirming the exact two results for the `30` prefix.

## 2026-11-05 — Corrected Q27 punctuation spacing

- Added the missing space after `Uber,` in Q27 across the shared G1–G4 survey.
- Updated active export wording and exact-text E2E coverage without changing the response options or survey behavior.

## 2026-11-05 — Removed duplicate Q32 from the final survey page

- Removed only “How often do you use multi-service super apps?” from the shared G1–G4 survey.
- Renumbered the former Q33 and Q34 as Q32 and Q33 without changing their wording or response options.
- Reduced the final page from ten required questions to nine and the complete instrument from 34 questions to 33.
- Removed the retired item from active exports, simulations, shared test helpers, and exact-text E2E coverage.
- Passed the production build and a full local browser flow verifying Q25–Q33, missing-answer warnings at Q25 and Q33, and successful completion after all nine responses.

## 2026-11-05 — Added a third prefix-matching Courier recipient

- Added `3000 Rue Saint-Antoine Ouest` as the third matching address when participants type `30` or `300`.
- Kept `3008 Rue McGill` first and `300 Rue McGill` second.
- Continued excluding `1502 Rue Saint-Louis` because it does not match the typed prefix.
- Updated G1 and G2 E2E expectations for the three-address result set.
- Passed the production build and a local G2 browser flow confirming all three matching addresses in the requested order.

## 2026-11-05 — Standardized “super app” terminology

- Replaced `superapp`/`superapps` with `super app`/`super apps` in Q28, Q30, and Q31 across G1–G4.
- Preserved every other word, all response options, question numbering, and required-answer behavior.
- Updated active export wording and exact-text E2E coverage to match the participant-facing survey.
- Passed the production build and a full local browser flow confirming the standardized wording on Q28, Q30, and Q31.

## 2026-11-05 — Converted Q27–Q31 to labeled seven-point scales

- Replaced the vertical option lists for Q27–Q31 with the same horizontal seven-point control used for the main survey constructs.
- Added the approved full point labels for familiarity, clarity, relative knowledge, agreement, and usage frequency.
- Kept Q25–Q26 and Q32–Q33 unchanged and retained required-answer validation across the final page.
- Updated active codebooks, simulation values, shared E2E helpers, and exact scale-label coverage.
- Passed the production build and a full local browser flow verifying seven response points and all approved labels for Q27–Q31.

## 2026-11-05 — Placed Q27–Q31 labels under each response option

- Aligned every full response label directly beneath its numbered option in a seven-column layout.
- Allowed long labels to wrap without abbreviation or truncation.
- Removed the separate endpoint anchors and numeric legend from Q27–Q31 while leaving every other survey scale unchanged.
- Updated E2E coverage to verify each inline label by question and response number.
- Passed the production build, full browser flow, and visual inspection of the seven-column Q27 layout.

## 2026-11-05 — Applied inline response labels to Q15

- Placed all seven agreement labels directly beneath their numbered options for the Q15 attention check.
- Preserved the exact question wording and correct response of `5 — Somewhat agree`.
- Left every other construct question and its endpoint-anchor presentation unchanged.
- Updated E2E coverage to verify all seven inline Q15 labels.
- Passed the production build, full browser flow, and visual inspection of the Q15 seven-column layout.

## 2026-11-05 — Increased inline label size and contrast

- Increased the inline response labels on Q15 and Q27–Q31 from 10px to 12px.
- Changed the label color from light gray to a darker gray.
- Preserved every label, response value, layout column, and required-answer rule.
- Passed the production build, complete browser flow, and visual inspection of the larger, darker Q15 and Q27 labels.

## 2026-11-05 — Renamed the final survey action

- Changed the shared Page 3 button from `Continue` to `Submit` across G1–G4.
- Kept the Page 1 and Page 2 buttons labeled `Continue`.
- Preserved required-answer validation and submission behavior.
- Passed the production build and standalone TypeScript check; confirmed the production bundle renders `Submit` for `btn-submit-questionnaire`.

## 2026-11-09 — Enforced designated task addresses and recorded recoverable errors

- Added contract-controlled required addresses for the shared Ride task, Courier sender/recipient fields, and Cinema location.
- Blocked progression after an incorrect address, displayed the required address inline, and kept the participant on the current step until correction.
- Added the contract-valid `task.error` event with the wrong field, expected/provided addresses, task number, and interaction source; incorrect attempts do not emit task-complete events.
- Preserved successful progression after correction for G1/G2 Courier and G3/G4 Cinema flows.
- Added browser regression coverage for wrong Ride destinations in G1–G4, wrong G1 Courier sender/recipient selections, and a wrong G3 Cinema location.
- Passed the production build, standalone TypeScript check, focused wrong-address recovery tests, and one complete successful browser flow for each of G1–G4.

## 2026-11-10 — Removed the Q15 reading-carefully preamble

- Removed only “To show that you are reading carefully,” from the shared Q15 wording across G1–G4.
- Kept the remaining wording, seven inline response labels, correct answer (`5 — Somewhat agree`), numbering, required-answer validation, and attention-check behavior unchanged.
- Updated the active export/codebook wording and exact-text survey regression coverage.

## 2026-11-10 — Removed the incorrect G2 1502 recipient suggestion

- Added a condition-contract exclusion list and removed `1502 Rue Saint-Louis` from G2’s recipient Saved & recent results.
- Kept `3008 Rue McGill` as the only address that can advance G2 to package details.
- Confirmed that manually entering `1502 Rue Saint-Louis` shows the required-address error, records `task.error`, and remains on the Courier entry screen.
- Passed the production build, standalone TypeScript check, focused wrong-address browser test, and successful G2 full flow.

## 2026-11-10 — Applied the same recipient rule to G1

- Removed `1502 Rue Saint-Louis` from G1 recipient suggestions through the shared condition contract.
- Kept `3008 Rue McGill` as the only G1 recipient that can advance to package details; all other addresses remain blocked and instrumented as task errors.
- Added regression coverage confirming that typing `150` in G1 does not expose the removed address.

## 2026-11-10 — Kept the Trip Complete CTA visible without scrolling

- Reduced the shared Trip Complete map height from 160px to 96px and its following gap from 32px to 20px.
- Preserved the image width, all participant-facing text, banner contents, and navigation behavior.
- Added phone-frame regression assertions verifying the G2 Send Package and G4 Book Tickets CTAs are completely inside the viewport at scroll position zero.
- Passed the production build, standalone TypeScript check, and focused G2/G4 Trip Complete browser tests.

## 2026-11-10 — Aligned all four surveys with the exact-wording PDF

- Compared all 33 current questions with `Survey_Questions_Exact_Wording.pdf`; Q1–Q14 and Q16–Q33 already matched, while Q15 was restored to the PDF’s full instructed-response wording.
- Added complete gray inline labels beneath every numbered option for Q1–Q24, preserving seven response points and the PDF’s distinct Q1–Q3 mental-load labels.
- Kept the existing inline seven-point presentation for Q27–Q31 and converted Q32–Q33 from vertical lists to the PDF’s labeled five-point number scales.
- Preserved the current UI, three-page pagination, required-answer validation, forward-only navigation, attention-check scoring, and final Submit action across G1–G4.
- Updated active export/codebook wording, response-value definitions, simulation values, shared test helpers, and exact-label regression coverage.
- Passed the production build, standalone TypeScript check, exact Q1–Q24 survey test, and Q25–Q33 questionnaire test.

## 2026-11-10 — Revised the Q15 instructed-response check

- Changed Q15 across G1–G4 to `Please select strongly disagree for this statement.`
- Removed the reading-carefully preamble and quotation marks.
- Changed the correct answer from `5 — Somewhat agree` to `1 — Strongly disagree` while preserving the existing failed-check termination and invalidation behavior.
- Updated active exports, simulations, shared browser helpers, and regression coverage without changing any other survey question.
- Passed the standalone TypeScript check, production build, and three focused browser tests covering exact wording, the correct-answer path, and the failed-answer termination path.

## 2026-11-10 — Evenly spaced the five-point questionnaire scales

- Distributed Q32 and Q33 across five equal-width columns spanning the available survey width.
- Kept each number centered above its corresponding wording and preserved all question text, options, and seven-point scale layouts.
- Applied the shared questionnaire layout change to G1–G4.
- Passed the standalone TypeScript check, production build, and focused page-3 browser layout test.

## 2026-11-10 — Kept every task CTA visible without scrolling

- Reserved persistent footer space for the primary CTA on Courier Entry, Package Details, Cinema Entry, and Seat Selection.
- Limited scrolling to the form and option-list content above each CTA; bottom navigation remains fully visible where present.
- Preserved all task wording, controls, validation, instrumentation, and condition behavior.
- Verified the complete CTA sequence at the 390×844 phone viewport across G1–G4, including Start Ride, ride selection, Trip Complete actions, Courier/Cinema actions, and final Done buttons.
- Passed the standalone TypeScript check, production build, and four-group no-scroll browser regression.

## 2026-11-10 — Put every survey number and question on the same row

- Top-aligned each numbered badge with the first line of its question for Q1–Q33.
- Applied the shared layout to both Likert-scale and categorical questions across G1–G4.
- Preserved all wording, scale labels, response options, pagination, and validation behavior.
- Passed the standalone TypeScript check, production build, and browser alignment assertions across all three survey pages.

## 2026-11-13 — Changed Q3 to agreement response stems

- Kept the Q3 statement exactly as `Using this app required a lot of thinking.`
- Changed only its seven response labels to `Strongly disagree` through `Strongly agree` across G1–G4.
- Kept Q1–Q2 on the mental-load intensity scale and updated active export codebooks and regression coverage.
- Passed the standalone TypeScript check, production build, and focused browser regression for all seven Q3 labels.

## 2026-11-13 — Moved the attention check to Q20

- Moved `Please select strongly disagree for this statement.` to immediately after `The two services served different purposes.` on survey page 2 across G1–G4.
- Renumbered the displayed questions automatically: the service-purpose item is Q19, AC1 is Q20, and the remaining service-difference items are Q21–Q24.
- Preserved the attention-check wording, correct response (`1 — Strongly disagree`), seven-point scale, and failed-check invalidation behavior.
- Passed the standalone TypeScript check, production build, and focused browser regressions for the new position plus correct and incorrect AC1 responses.

## 2026-11-13 — Clarified the failed-attention-check message

- Added `You have failed the attention check.` to the beginning of the terminated-session message across G1–G4.
- Preserved the existing explanation that the session ended and the participant's data will not be used.
- Added browser regression coverage for the complete participant-facing message.
- Passed the standalone TypeScript check, production build, and focused failed-attention-check browser regression.

## 2026-11-13 — Added a 30-minute session timeout

- Added one shared 30-minute study timer across G1–G4, with a session-scoped start time that survives refreshes.
- Added `experiment.timed_out` instrumentation and the standard `experiment.invalidated` event with reason `timeout`.
- Added a distinct `Session Timed Out` outcome explaining that the incomplete responses will not be included in the study analysis.
- Classified timeout events as failed outcomes for Prolific routing and invalid sessions for paper-facing statistics.
- Kept the attention-check failure message and scoring behavior unchanged.
- Passed the standalone TypeScript check, production build, timeout UI/event regression, outcome-classification test, statistics-exclusion test, and existing failed-attention-check regression.

## 2026-11-13 — Added automatic low-quality analysis exclusions

- Added first-response timing for all 33 questions and final-value tracking for the 30 non-attention numeric scale questions.
- Flagged complete straightlining (one value across all tracked scales) and pervasive rapid responding (at least 80% of first-answer intervals under one second).
- Added the contract-valid `data_quality.flagged` event with auditable reasons, thresholds, counts, and ratios.
- Excluded flagged sessions from paper statistics and scored Excel exports while preserving normal completion and payment routing.
- Kept all participant-facing wording, question order, scales, pagination, and required-answer behavior unchanged across G1–G4.
- Passed the standalone TypeScript check, production build, five focused quality/payment/statistics tests, and a complete browser flow verifying rapid-response exclusion with normal completion.

## 2026-11-14 — Reconciled replacement-participant capacity

- Added full-batch reconciliation to the shared assignment endpoint for all four groups.
- When a batch first reports full, capacity-occupying app rows are checked against the recorded Prolific study: returned, rejected, and timed-out submissions are released before one atomic assignment retry.
- Preserved active submissions and incomplete awaiting-review submissions; complete same-session server event trails repair stale app completion status without freeing a legitimate participant slot.
- Refreshed the experiment-session link for a participant who re-enters an assigned session so later completion events update the correct assignment.
- Kept assignment fail-closed when Prolific or Supabase cannot be reached, preventing capacity from being granted outside the existing atomic database function.
- Added eight focused reconciliation regressions and passed them with the standalone TypeScript check and production build.

## 2026-11-14 — Hardened Prolific completion and incomplete NOCODE recovery

- Added server-side Prolific `COMPLETE` transition after the full app event trail is validated, preventing redirect interruption from turning a valid completion into NOCODE.
- Added final-event upload retries, a visible validated completion code, a persistent `Return to Prolific` button, and a participant-controlled retry state instead of telling an unresolved real participant to close the page.
- Preserved unsent logger events when the same experiment session is re-mounted and continued sequence numbering from the stored events.
- Added a protected `Reconcile Prolific` admin action and kept the same recovery in the full-batch assignment path.
- For older incomplete NOCODE submissions, request a return through Prolific, keep the app slot reserved until a terminal status is confirmed, and store exportable evidence containing the submission ID, missing milestones, and review timestamp.
- Added a two-minute evidence-upload grace period, prevented duplicate return requests, and corrected CSV escaping so audit evidence remains intact in roster downloads.
- Passed the standalone TypeScript check, ten focused outcome/reconciliation tests, and the production build.

## 2026-11-14 — Closed the Prolific/app capacity synchronization gap

- Added an HMAC-verified `submission.status.change` webhook endpoint for Prolific.
- Re-fetch the current Prolific submission before acting, so delayed or out-of-order webhook events cannot roll an assignment backward.
- Validate submission, participant, and study identifiers against the app assignment before releasing capacity.
- Release slots only after Prolific confirms `RETURNED`, `REJECTED`, or `TIMED-OUT`; a return request alone now records evidence but continues occupying capacity.
- Kept terminal updates naturally idempotent for Prolific's at-least-once delivery model and recorded the webhook event ID in the assignment evidence.
- Added a retryable full-batch response and a participant-facing availability check when the Prolific source is temporarily unavailable.
- Retained assignment-time reconciliation as a fail-closed fallback and omitted frequent Vercel cron configuration because Hobby deployments reject schedules that run more than once daily.
- Passed 12 focused reconciliation, webhook-signature, and outcome tests plus the standalone TypeScript check and production build.

## 2026-11-14 — Provisioned the Prolific webhook signing secret

- Confirmed that study `6af7616e7de01ab7c5a54ed3` belongs to the `HCI Study (USD)` workspace.
- Verified that the workspace had no existing webhook secret before provisioning one through the Prolific API.
- Stored the generated value in the git-ignored local environment and as a protected Production secret in the `hci-paper-exp` Vercel project without recording the value in project documentation.
- Vercel requires a new deployment before the running application can read the secret; webhook subscription creation and confirmation remain pending until the endpoint is live.

## 2026-11-14 — Closed local webhook and retry-safety review gaps

- Restricted completion reconciliation to the exact experiment session stored on each assignment, preventing older sessions for the same participant from validating a current incomplete submission.
- Changed event ingestion to a duplicate-safe `event_id` upsert and added an idempotent SQL migration that deduplicates existing rows before creating the required unique index.
- Preserved the browser event outbox during `beforeunload`, allowing a same-tab retry regardless of whether `sendBeacon` was queued successfully.
- Refactored webhook processing behind deterministic dependencies and added coverage for terminal release, non-terminal status, participant/study mismatch, duplicate delivery, and transient Prolific/Supabase failures.
- Configured the paused B4 study's existing success and failed completion URLs in the git-ignored local environment without recording either code in repository files.
- Passed the standalone TypeScript check, 18 focused reconciliation/webhook/outcome tests, and the Next.js production build using a temporary checksum-verified Node.js 22 runtime.

## 2026-11-14 — Applied event idempotency and finalized the published-study fallback

- Applied `scripts/migrate-add-event-id-idempotency.sql` to production Supabase: deduplicated 390 repeated event rows (17,407 to 17,017), verified zero remaining duplicate `event_id` values, and verified `idx_events_event_id_unique` exists.
- Confirmed Prolific does not allow B4's completion-code actions to be edited after publication.
- Added server-side return requests for validated attention-check failures and timeouts, with an idempotent check for an already-recorded Prolific return request.
- Verified the final local state with the standalone TypeScript check, 18 focused tests, and the Next.js production build.
- Stopped the direct Vercel CLI deployment before it created a deployment; release will proceed through the `main` branch integration instead.

## 2026-11-14 — Enabled the production Prolific webhook subscription

- Deployed commit `b2e7b53` through the `main` branch Vercel integration; no direct CLI deployment was created.
- Verified the live webhook endpoint rejects unsigned requests with HTTP 401.
- Created and confirmed Prolific subscription `6af9151b3cdbe13af8756073` for `submission.status.change` at the production webhook URL; Prolific reports it enabled.
- The first signed delivery test detected that Vercel's stored secret did not match the current local Prolific workspace secret byte-for-byte.
- Updated only the protected Production `PROLIFIC_WEBHOOK_SECRET` and deployed it through a second `main` pipeline run.
- Verified the public production alias resolves to that deployment and a correctly signed, non-mutating integration payload returns HTTP 200 with `{ "ok": true, "ignored": true }`.

## 2026-11-13 — Prepared the 12-person Prolific B4 draft

- Verified the live Vercel bundle contains the 30-minute app timeout.
- Audited completed source study `6aee828c35f9a8818895bf5e` and cloned it with previous participants blocked.
- Created unpublished study `6af7616e7de01ab7c5a54ed3` (`hci-2x2-us-ca-12-b4`) with 12 places, a five-minute estimate, a 30-minute maximum, a $1.00 reward, manual review completion actions, and the existing US/Canada plus age filters.
- Confirmed the draft is ready to publish and retains the production URL with Prolific participant, study, and session parameters.
- The projected cost is $16.00 USD and the workspace now has exactly $16.00 USD available; Prolific reports the draft is ready to publish.
- Opened live app batch `dd7d4ad3-57df-4f98-9d80-da61c4074ec1` as `Prolific US-CA 18-50 (12) B4`, with three places per group and 12 total; the prior full batch was closed automatically without deleting its records.

## 2026-11-15 — Enabled B5 exceptionally-fast protection and recorded review policy

- Updated unpublished Prolific study `6afa22a4d1d094651d61d973` (`hci-2x2-us-ca-24-b5`) so `submissions_config.auto_rejection_categories` contains only `EXCEPTIONALLY_FAST`.
- Re-read the study through the Prolific API and confirmed it remains `UNPUBLISHED`, ready to publish, limited to one submission per participant, and configured with the exceptionally-fast protection.
- Recorded the standing data-review rule: preserve original raw records and audit evidence, manually review app-generated flags before recommending a return or rejection, and exclude confirmed invalid records from analysis without deleting or altering their source data.
- Kept the policy distinction explicit: Prolific's exceptionally-fast category is automatic, while app flags such as straightlining or pervasive sub-second responses remain manual-review indicators.

## 2026-11-15 — Automated Prolific reconciliation with webhook retries

- Extended the signed `submission.status.change` handler so every awaiting-review submission reconciles its matching app batch automatically.
- Kept complete NOCODE data valid, repaired stale completed assignments, and preserved exact participant/study/session linkage checks.
- Added an explicit waiting-for-grace reconciliation state. Incomplete NOCODE submissions receive the existing two-minute evidence-upload grace, and the endpoint returns retryably so Prolific's webhook backoff redelivers the event instead of requiring an admin click.
- After the grace period, a still-incomplete NOCODE automatically receives the existing evidence-backed return request; confirmed terminal statuses continue releasing capacity automatically.
- Retained **Reconcile Prolific** as a backup for missed/exhausted webhook delivery and clarified that behavior in the admin confirmation, tooltip, and runbook.
- Passed 21 focused reconciliation, webhook, and outcome tests; passed the standalone TypeScript check and the Next.js production build.

## 2026-11-18 — Diagnosed B5 Prolific review pause

- Confirmed Prolific study `6afa22a4d1d094651d61d973` (`hci-2x2-us-ca-24-b5`) was published on 2026-11-16 and is currently `PAUSED` by Prolific review.
- Verified the pause happened before recruitment: Prolific reports zero places taken and zero submissions in every status, and the B5 app batch has zero assignments.
- Verified the researcher API account status is `OK`, the full $32 USD remains correctly reserved, and the study configuration remains ready to publish/restart once Prolific completes its review.
- Verified the live app returns HTTP 200, the B5 app batch remains active with six places per group, and the enabled `submission.status.change` webhook points to the production endpoint; prior webhook deliveries report success and unsigned requests are rejected.
- No app, database, Prolific, or deployment settings were changed during diagnosis. The exact review trigger is not exposed by the Prolific API and requires Prolific's review email or Support response.

## 2026-11-20 — Reviewed B5 response quality without changing participant status

- Matched the live B5 Prolific submissions to the app assignments and item-level event trails.
- Confirmed all 20 submissions awaiting review have the required task, survey, questionnaire, and experiment-completion events; all passed the attention check, and none triggered the configured straightlining or rapid-response flag.
- Confirmed no awaiting-review submission finished in under two minutes and Prolific marked none of them as exceptionally fast.
- Identified two non-exclusion manual-review signals: one participant answered 11 of 33 items in under one second but remained below the 80% rapid-response threshold, and one participant gave the neutral response on 20 of 23 scale items but did not exactly straightline and spent more than three minutes on the survey.
- Current usable-condition counts are G1=4, G2=6, G3=4, and G4=6; reaching the planned balanced 24 requires two additional valid G1 records and two additional valid G3 records.
- Preserved all raw records and made no Prolific, database, assignment, payment, approval, rejection, return, or deployment changes.

## 2026-11-20 — Recovered completions from a re-opened study link

- Diagnosed three B5 participants whose valid completions were invisible to the export: re-opening the study link started a new experiment session that replaced the assignment's `exp_session_id`, and they then finished in the earlier tab.
- Event ingestion now relinks an unmatched completion or invalidation to the participant's still-`assigned` row for the same Prolific submission; full-batch reconciliation accepts a complete session from that same submission when the linked session has none.
- Repaired the three B5 assignments in production (two G1, one G3) by relinking each to its complete session and marking it completed; B5 now has 22 usable responses.
- Passed the standalone TypeScript check, 20 focused reconciliation/webhook/session-evaluation tests, and the production build.

## 2026-11-23 — Diagnosed B5 23/24 Study Full incident

- Confirmed B5 is paused with 23 places taken and 23 submissions awaiting review.
- Verified the reported participant has no app assignment or event data; their 38-second NOCODE submission was automatically rejected by Prolific's exceptionally-fast rule after the app displayed Study Full.
- Identified the capacity mismatch: a stale G3 assignment created with literal Prolific URL-template placeholders remains `assigned`, so the app counts 24 active slots while Prolific counts 23.
- Determined the fair remediation is to keep the study paused, release only the stale placeholder assignment, reverse the participant's rejection to awaiting review, ask the participant to return voluntarily, and resume recruitment only after the return is confirmed.
- Made no Prolific, Supabase, participant, payment, study-status, or deployment changes during diagnosis.

## 2026-11-23 — Released the stale B5 template assignment

- Re-read the exact G3 placeholder assignment and verified its participant, study, and session fields still contained the literal Prolific URL-template values before changing it.
- Preserved the row and released only assignment `a5d095c7-edcc-4892-add7-5c9c5dedc5ee`, recording `manual_release:stale_prolific_template_placeholder;diagnosed_2026-11-23` as audit evidence.
- Verified B5 app capacity is now 23 active assignments: G1=6, G2=6, G3=5, and G4=6. The next valid participant can therefore receive the remaining G3 slot instead of seeing Study Full.
- Prolific still reported the study as `PAUSED` with 23/24 places immediately after the repair, despite the researcher having attempted to activate it; no Prolific study-status or participant-status change was made.

## 2026-11-23 — Restarted B5 recruitment through the Prolific API

- Transitioned only Prolific study `6afa22a4d1d094651d61d973` (`hci-2x2-us-ca-24-b5`) with the `START` action after the researcher explicitly requested API activation.
- Verified Prolific reports the study as `ACTIVE` with 23/24 places taken.
- Re-verified the app has 23 active assignments with G1=6, G2=6, G3=5, and G4=6, so the remaining valid participant can enter G3.

## 2026-11-23 — Re-audited all current B5 data

- Matched all 23 awaiting-review Prolific submissions to complete app event trails and item-level response timing.
- Confirmed every awaiting-review record completed both tasks and all survey/questionnaire items, passed the attention check, avoided the app's straightlining and rapid-response thresholds, and was not marked exceptionally fast by Prolific.
- Current Prolific completion time is 3:07–13:08 (median 6:13; mean 6:54); no awaiting-review participant completed in under two minutes.
- Retained two non-exclusion sensitivity-review signals from the earlier audit: one participant answered 11/33 items in under one second but stayed below the 80% rule, and one selected the neutral point on 20/23 scale items but spent more than three minutes on the survey.
- Found one fully completed G4 submission had subsequently been rejected despite a valid completion code, complete events, a passed attention check, coherent construct responses, no app quality flag, and no Prolific exceptionally-fast flag. Its 2:36 duration is above the study's two-minute review threshold; the evidence supports reversing that rejection if the record will be used.
- The 23 awaiting-review records currently balance as G1=6, G2=6, G3=6, and G4=5. Restoring the valid rejected G4 record would yield the intended 24-person balance of six per group without further recruitment.
- Made no participant, submission, payment, study-status, database, or deployment changes during this audit.

## 2026-11-23 — Reviewed the four approximately three-minute B5 records

- Audited the complete task paths, survey and questionnaire durations, item-level response times, answer revisions, reverse-worded usability item, attention check, and corrected task errors for the four participant IDs requested by the researcher.
- All four completed the full experiment in 3:07–3:26, passed the attention check, had complete events, used 3–6 distinct scale values, and had only 3–5 of 33 first responses under one second (9%–15%, far below the 80% flag rule).
- Their median item-response times were 1.87–2.62 seconds; survey durations were 58–70 seconds, questionnaire durations were 18–23 seconds, and second-task durations were 15–31 seconds.
- Response patterns were construct-coherent rather than random. One participant endorsed both ease and frustration, which is a plausible mixed evaluation and not an exclusion criterion; two Courier participants made incorrect-address errors but corrected them and completed successfully, so those errors are valid behavioral outcomes rather than bad data.
- Recommended retaining all four records. No participant or study state was changed.

## 2026-11-23 — Tested hypothesis alignment and under-four-minute influence

- Scored the current instrument exactly as deployed: CL1–CL5, PU1–PU4 plus reverse-scored PU5, CI1–CI4, MC1–MC4 for interrelatedness, and MC5–MC9 for heterogeneity.
- For the 23 awaiting-review records, both manipulation checks separated in the intended direction: heterogeneity d=1.29, p=.005; interrelatedness d=1.01, p=.023.
- H1 was in the expected but negligible direction (Cinema/high heterogeneity CL=2.85 vs Courier/low=2.75, d=.11, p=.794); H2 was in the expected direction (bridge CL=2.69 vs no bridge=2.90, d=-.22, p=.603). H3 (CL–PU r=-.57, p=.005) and H4 (PU–CI r=.53, p=.009) were supported.
- Identified five awaiting-review participants under four minutes and ran leave-one-out analysis for each. Removing any one preserved the supported directions of H3 and H4; no fast record creates those results artificially.
- Participant ending `0f6e` was the strongest descriptive mismatch: removing that record strengthened H1 d from .11 to .27, H2 d from -.22 to -.38, H3 r from -.57 to -.73, and H4 r from .53 to .70. The record nevertheless passed every quality check and must not be excluded for disagreeing with the hypotheses.
- Participant ending `c41f` aligned most strongly with the predicted pattern; participants ending `ac3d` and `47d7` weakened H1/H2 to different degrees, while participant ending `75e1` mainly weakened H4. These are legitimate individual differences, not quality failures.
- No participant, submission, payment, study, database, or deployment state was changed.

## 2026-11-23 — Verified restarted B5 capacity was claimed by real participants

- Confirmed Prolific reports B5 as `ACTIVE` with 24/24 places taken.
- Confirmed the app has 24 active-capacity records balanced at six per condition.
- Verified the two remaining `assigned` app records belong to real Prolific submissions currently marked `ACTIVE`: one G3 and one G4, both started seconds before their app assignments.
- The submission roster currently contains 22 awaiting review and two active participants; no safe stale slot remains to release.
- Left both active participant slots intact and made no Prolific, database, participant, payment, or deployment changes.

## 2026-11-23 — Reviewed the final G3 and G4 participants

- Verified both replacement participants completed with `VALID12`, complete task/survey/questionnaire trails, correct attention checks, and no app data-quality flag.
- The G4 participant completed in 3:17 with zero sub-second first responses and construct scores CL=1.00, PU=7.00, CI=7.00, MC-interrelatedness=7.00, and MC-heterogeneity=7.00. This aligns with H2–H4 and both manipulation checks, but its low cognitive load does not align with H1's high-heterogeneity prediction.
- The G3 participant completed in 2:14 (app events span 1:58), was marked below Prolific's auto-approval time threshold, but changed four answers, had only 5/33 sub-second first responses, and had median item time 1.74 seconds. Scores were CL=1.60, PU=6.40, CI=5.75, MC-interrelatedness=6.75, and MC-heterogeneity=6.20.
- The G3 participant aligns with H3/H4 and the heterogeneity manipulation, but the low cognitive load weakens H1/H2 and the high interrelatedness rating does not align with the no-bridge manipulation. The record remains internally coherent and does not meet the app's rapid-response or straightlining exclusion rules.
- Recommended retaining both records and treating the G3 speed only as a documented sensitivity-review signal. No participant or study state was changed.

## 2026-11-23 — Reviewed participant ending `56124`

- Verified the G2 participant completed with `VALID12` in 4:17, passed the attention check, generated a complete event trail, had no task errors or app quality flag, and recorded zero sub-second first responses (median item time 3.19 seconds).
- Construct scores were CL=2.00, PU=6.00, CI=5.50, MC-interrelatedness=6.50, and MC-heterogeneity=5.00.
- The low cognitive load in a low-heterogeneity bridge condition, paired with high usability and above-midpoint continuance, is descriptively aligned with H1–H4. The high interrelatedness manipulation score also matches G2 as intended.
- Recommended retaining the record. No participant or study state was changed.

## 2026-11-24 — Counted valid research records collected since October

- Audited all batches, assignments, and 13,913 experiment events from October 1 through November 24 using the strict inclusion rule: real Prolific ID, app status `completed`, complete Service-2/survey/questionnaire/experiment trail, and no attention failure, invalidation, timeout, or data-quality flag.
- Found 59 unique strict-valid participants across the four real Prolific batches: October batch=12, B3=12, B4=11, and B5=24. Condition totals are G1=15, G2=15, G3=14, and G4=15.
- The October batch used the older instrument (20 post-task items and six background questions). B3–B5 use the current item structure (24 post-task items including attention check and nine background questions), yielding 47 directly comparable current-instrument records: G1=12, G2=12, G3=11, and G4=12.
- Identified five additional complete, quality-valid event trails whose app assignments are not completed because Prolific later returned or rejected them (two in B3 and three in B5). These are not included in the 59 strict-valid count and should not be analyzed unless payment/status and consent are resolved.
- Excluded internal test batches and placeholder assignments. Verified all 59 strict-valid participant IDs are unique across batches.
- Made no participant, submission, payment, database, study-status, or deployment changes.

## 2026-11-24 — Hardened assignment against placeholder-driven NOCODE incidents

- Added shared validation requiring real-format Prolific participant, study, and submission identifiers plus a valid experiment-session UUID before balanced assignment.
- Made `/api/assign` reject missing, malformed, and literal Prolific URL-template parameters before the database RPC can reserve a group slot.
- Added a participant-facing invalid-link recovery screen that confirms the experiment did not start and no place was reserved.
- Added an idempotent database migration enforcing the same identity checks inside `assign_participant`, while preserving historical audit rows.
- Kept the existing server-side Prolific completion transition, automatic redirect, visible fallback code, retry path, and signed-webhook reconciliation unchanged.
- Passed the standalone TypeScript check, 32 focused assignment/reconciliation/webhook tests, and the Next.js production build.

## 2026-11-24 — Prepared Prolific B6 for 64 balanced places

- Re-read the completed B5 Prolific study and duplicated it with previous participants blocked. The new draft is `6b05fc967abaa54d5fd0da66` (`hci-2x2-us-ca-64-b6`), ready to publish with 64 places.
- Verified B6 retains the US/Canada and 18–50 audience, the prior-study exclusions (October, B3, B4, and B5), $1.00 reward, five-minute estimate, 30-minute maximum, manual-review completion codes `VALID12`/`FAILAC12`, and the production link carrying Prolific participant/study/session parameters.
- The researcher explicitly chose to retain B5's `EXCEPTIONALLY_FAST` automatic-rejection setting in B6.
- Prolific's projected study cost is $85.33 USD; the workspace had $32.00 available, leaving a $53.33 funding gap. B6 remains `UNPUBLISHED` until funded.
- Applied the production SQL assignment-identity guard and verified the literal Prolific URL placeholders are rejected with SQLSTATE `22023`.
- Opened app batch `6a1aeff8-494e-476a-8d84-5545885e2def` (`Prolific US-CA 18-50 (64) B6`) with 16 places each in G1–G4. Verified all four groups have zero assigned participants; the completed B5 app batch was closed.
- Deployed the validated app to a Vercel preview, verified placeholder parameters return `invalid_prolific_params`, then deployed production `dpl_5s9rNJaBaMzMrf3S479SW2HkivEv` at `https://hci-paper-exp.vercel.app`. The public endpoint now returns HTTP 400 for placeholder parameters and leaves B6 at zero assignments.

## 2026-11-24 — Corrected B6 server completion code

- Confirmed B6 has a 30-minute maximum in Prolific and the app, a five-minute estimated duration, and no fixed two-minute minimum. Its selected `EXCEPTIONALLY_FAST` rule follows Prolific's own criteria; the two-minute NOCODE upload grace is a separate setting.
- Added a researcher-operated `COMPLETED` code with only `MANUALLY_REVIEW` to the unpublished B6 draft while preserving its participant completion and failure codes.
- Updated both server completion paths to look up the unique researcher-operated manual-review code from the recorded Prolific study. Inconsistent study or submission IDs, ambiguous code configurations, and automatic-action paths cannot trigger the server transition; the participant-facing redirect retains its original code.
- Passed the TypeScript check, 26 focused completion/reconciliation/webhook tests, and the Next.js production build. A real B6 participant completion remains to be tested after a safe test participant is available.
- Deployed and smoke-tested preview `dpl_FBryqN6UpzwSbPbD6bL6yRGqi8nv`, then production `dpl_9b78eQWfS9PWuUkmAsfBhWQ6bWoo`. Re-read B6 as unpublished with exactly one eligible researcher code, its original participant codes, 30-minute maximum, and 64 places; verified its active app batch still has zero assignments and 16 slots per condition.

## 2026-11-24 — B6 release checks on main

- Before the requested production deployment, the TypeScript check, 26 focused tests for Prolific completion, webhook handling, reconciliation and session outcomes, and the Next.js production build all passed.
- Merged the earlier-tab completion fix from GitHub with the B6 changes and restored the shared Prolific ID validator import used for relinking. All 28 focused tests and the production build passed on the combined code.

## 2026-11-24 — Checked B6 before recruitment

- Verified all three identity placeholders in the Prolific launch link, the participant-facing access code against the production gate, the participant completion and failure codes against local redirect settings, and the study's researcher-operated manual-review code.
- Verified the enabled submission-status subscription points to production. A signed synthetic event was acknowledged and ignored, while an unsigned event was rejected. B6 was the only active app batch, with 16 places per group and zero assignments.
- Completed four isolated browser runs on the deployed app, one per condition. Each preserved the launch identities through the final event trail and displayed and followed the simulated completion link. Assignment, event writes, completion responses and the outgoing Prolific navigation were intercepted. All 28 focused integration-logic tests passed.
- Actual acceptance of a completion by Prolific remains unverified. The study was unpublished at the time of these checks.

## 2026-11-27 — Fixed completion uploads at the browser keepalive limit

- Diagnosed a B6 participant who reached the final thank-you screen but repeatedly received the completion-verification error. Prolific recorded a six-minute submission while the server received zero experiment events.
- Confirmed the root cause with the Fetch 64 KiB keepalive limit. A 60 KB production probe succeeded and a 70 KB probe failed in the browser before reaching the endpoint. Recorded successful B6 sessions reached 65,293 bytes.
- Added early outbox flushing at 32 KiB, sequential 48 KiB upload chunks, per-chunk acknowledgement, retry preservation, and one safe exit beacon. The server now evaluates completion or failure from the full persisted session trail across chunks.
- Passed the TypeScript check, 30 focused upload/completion/reconciliation tests, the chunked full-flow browser test, and the production build. The broader browser suite passed 111 of 113 tests; the two failures are pre-existing scenario-label assertions that expect uppercase DOM text while the UI applies uppercase through CSS.
