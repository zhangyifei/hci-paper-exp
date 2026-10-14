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
