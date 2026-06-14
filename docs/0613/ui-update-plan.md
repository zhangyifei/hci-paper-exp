# UI Update Implementation Plan

## Source Reference

- Source documents:
  - `docs/0613/Appendix_D_SuperApp_Questionnaire_HEC_06102026.docx` (consent, scenario, post-task survey, background questions)
  - `docs/0613/attention-check.md` (two attention check items + placement guidance)
- Implemented app flow: `consent -> scenario instruction -> home -> ride -> trip complete -> service2 -> post-task survey -> background questionnaire -> finished`
- Attention checks added to this flow: `AC1` inside the post-task survey, `AC2` inside the background questionnaire (before age/gender). Failing either ends the test immediately and marks the session invalid.
- Data is event-sourced in a single Supabase table `experiment_events` (JSONB `payload`, TEXT `event_name`). Session-level status (completed / bot / invalid) is derived from events in `lib/paper-stats/analysis.ts`, not stored as columns.

## Acceptance Criteria

- [ ] Participants see a consent screen before any questionnaire or task screen.
- [ ] Consent content summarizes the first page of the HEC document: study purpose, anonymity/confidentiality, voluntary participation, withdrawal limits after anonymous submission, contact information, and REB contact.
- [ ] Participants cannot continue until they explicitly confirm consent.
- [ ] Participants see a scenario instruction screen before entering the ride task.
- [ ] Scenario instructions explain that Voya X is fictional, no real ride/order/payment occurs, and the assigned task sequence is condition-specific.
- [ ] Scenario instructions show the ride task and the correct second-service task for G1-G4 based only on `ConditionConfig` / contract-derived data.
- [ ] Post-task survey uses all 14 questions from the document's page 7-8 post-task questionnaire section.
- [ ] Survey item codes, constructs, anchors, logging payloads, and aggregate means remain analyzable by construct.
- [ ] Two attention check questions are presented: `AC1` in the post-task survey and `AC2` in the background questionnaire (placed before the age/gender items).
- [ ] `AC1` requires selecting "Somewhat agree" (value 5 on the 1-7 scale); `AC2` requires selecting "Rarely".
- [ ] Attention check items are scored separately and never aggregated into cognitive load, usability, continuance, or manipulation-check constructs.
- [ ] If a participant answers any attention check incorrectly, the test ends immediately on a terminated screen and the participant cannot continue.
- [ ] A failed attention check marks the session invalid, and invalid sessions are excluded from all paper-facing aggregates (same treatment as bot sessions).
- [ ] The DB schema stays stable: attention-check responses and the invalid marker are stored through the existing event-sourced `experiment_events` table (JSONB payload + new `event_name` values), with no breaking column changes.
- [ ] Existing G1-G4 Playwright flows pass after accounting for the new consent and scenario screens.
- [ ] `npm run type-check`, `npm run build`, and the relevant Playwright tests pass.

## Phase 1 - Content And Flow Design

### Task 1.1 - Define Consent Screen Content

Files:
- `components/Survey/ConsentScreen.tsx` or `components/Onboarding/ConsentScreen.tsx`
- `components/ExperimentFlow.tsx`

Plan:
- Create a mobile-first consent screen matching the current white/black app style.
- Include concise participant-facing sections:
  - Research project: User Experiences with Super Apps.
  - Summary: two short fictional prototype tasks plus questionnaire.
  - Estimated time: about 5 minutes.
  - Anonymous/confidential data use for academic/professional dissemination.
  - Voluntary participation and ability to stop at any time.
  - Consent statement: continuing means consent to participate and possible future research use of anonymous questionnaire data.
  - Contact: Ran Zheng, HEC Montreal, `ran.zheng@hec.ca`.
  - Ethics contact: HEC Montreal REB, `(514) 340-6051`, `cer@hec.ca`.
- Add an explicit checkbox or required acknowledgement button before enabling continue.

### Task 1.2 - Add Scenario Instruction Content

Files:
- `components/Survey/ScenarioInstructionScreen.tsx` or `components/Onboarding/ScenarioInstructionScreen.tsx`
- `components/ExperimentFlow.tsx`
- `docs/contracts/experiment-config.json`
- `lib/experiment-config.ts`

Plan:
- Add a scenario instruction screen after the consent screen and before the app home screen.
- Show shared ride instruction: "Book a ride to 1000 Saint-Catherine Street West."
- Show the second-service instruction based on condition:
  - G1: send a package to `1000 Saint-Catherine Street West` using Courier.
  - G2: use the suggested "Send Now" option to send a package to the same destination.
  - G3: order food using Eats.
  - G4: use the suggested "Eat" option to order food near the same destination.
- Add a short fictional-prototype note: Voya X is simulated; no real ride, delivery, food order, payment, or commercial transaction occurs.
- Prefer adding participant-facing task instruction fields to `docs/contracts/experiment-config.json` and parsing them through `lib/experiment-config.ts`, so condition differences remain contract-driven.

### Task 1.3 - Update Experiment State Machine

Files:
- `components/ExperimentFlow.tsx`
- `docs/contracts/event-schema.json`
- `lib/types.ts` if state types require expansion

Plan:
- Extend `Screen` with `consent`, `scenario_instruction`, and `terminated`.
- Set initial screen to `consent`.
- Add transitions:
  - `consent -> scenario_instruction`
  - `scenario_instruction -> home`
  - `... -> survey -> questionnaire -> finished` (background questionnaire runs after the post-task survey)
  - `survey -> terminated` or `questionnaire -> terminated` on any attention-check failure
- Decide whether to log new events. Recommended events:
  - `consent.viewed`
  - `consent.accepted`
  - `scenario.viewed`
  - `scenario.started`
- If new events are logged, update `docs/contracts/event-schema.json` with event names, flows, and states.

## Phase 2 - Post-Task Survey Replacement

### Task 2.1 - Replace Survey Items With Page 7-8 Questions

Files:
- `components/Survey/PostTaskSurvey.tsx`

Plan:
- Update `SURVEY_ITEMS` to the 14 document items:
  - Cognitive load: CL1-CL3.
  - Perceived usability: PU1-PU4.
  - Continuance intention: CI1-CI3.
  - Manipulation checks: MC1-MC4.
- Update wording to match the document:
  - CL1: "How much mental activity was required to complete these tasks?"
  - CL2: "How hard did you have to work mentally to reach your performance?"
  - CL3: "How stressed or annoyed did you feel during the tasks?"
  - PU1: "I found this super app easy to use for these consecutive tasks."
  - PU2: "I felt I could efficiently complete my goal using this super app."
  - PU3: "The transition between the two services in the super app felt smooth."
  - PU4: "The super app made it easy to continue from the first service to the second service."
  - CI1: "I would use this super app again for similar service tasks."
  - CI2: "I intend to use this super app again if I need to complete similar tasks."
  - CI3: "I would choose this super app again for similar tasks."
  - MC1: "The super app prompted me with the next service at the right moment."
  - MC2: "The super app automatically carried my data into the next service."
  - MC3: "The second service felt different from the ride service."
  - MC4: "The two service tasks required different kinds of actions."
- Use a 1-7 response scale for all items, matching the document. `components/Survey/LikertScale.tsx` already defaults to `points = 7`, and `PostTaskSurvey` uses that default, so no scale-point change is required.
- Cognitive load anchors: low = `Very Low` (document: "Very low / Not at all"), high = `Very High` (document: "Very high / Very much").
- All statement anchors (PU, CI, MC): low = `Strongly Disagree`, high = `Strongly Agree`.
- Item count grows from 10 (CL1-3, PU1-2, CI1-3, MC1-2) to 14 (CL1-3, PU1-4, CI1-3, MC1-4); the added items are PU3, PU4, MC3, MC4.
- Verify aggregate calculation still groups by construct with the new item counts.

### Task 2.2 - Check Stats And Analysis Compatibility

Files:
- `lib/paper-stats/analysis.ts`
- `components/stats/SurveyChart.tsx`
- `components/stats/BoxPlotChart.tsx`
- `scripts/paper-stats*.ts`

Plan:
- Confirm stats code reads survey responses dynamically by item code or construct aggregate rather than hardcoding old item counts.
- If analysis expects only PU1-PU2 or MC1-MC2, update it to include PU3-PU4 and MC3-MC4 through construct means.
- Preserve old response-code compatibility if existing collected pilot data must remain analyzable.

## Phase 2.5 - Attention Checks And Invalidation

Source: `docs/0613/attention-check.md`. Two attention checks, placed so they never mix into the real constructs.

### Task 2.5.1 - Add AC1 To The Post-Task Survey

Files:
- `components/Survey/PostTaskSurvey.tsx`

Plan:
- Append one attention-check item after MC4 on the same 1-7 scale:
  - Code `AC1`, construct `attention_check` (so it is excluded from CL/PU/CI/MC aggregates).
  - Question: "To show that you are reading carefully, please select \"Somewhat agree\" for this statement."
  - Anchors: low = `Strongly Disagree`, high = `Strongly Agree`.
  - Correct answer: value `5` (Somewhat agree).
- Keep `AC1` out of construct aggregates: only CL/PU/CI/MC feed `aggregates`; store the raw `AC1` value in the responses payload.
- On survey submit, evaluate `AC1`. If incorrect, do not advance to the background questionnaire; trigger invalidation (Task 2.5.3).

### Task 2.5.2 - Add AC2 To The Background Questionnaire

Files:
- `components/Survey/BackgroundQuestionnaire.tsx`

Plan:
- Insert one select item before the age/gender items (`DEM1`/`DEM2`):
  - Code `AC2`, scored separately (not a moderator variable).
  - Question: "To help us confirm response quality, please select \"Rarely\" for this question."
  - Options: `Never`, `Rarely`, `Monthly`, `Weekly`, `Daily` (mirrors the document's frequency scale).
  - Correct answer: `rarely`.
- On questionnaire submit, evaluate `AC2`. If incorrect, trigger invalidation (Task 2.5.3) instead of completing the experiment.

### Task 2.5.3 - Invalidation And Termination

Files:
- `components/ExperimentFlow.tsx`
- `components/Survey/TerminatedScreen.tsx` (new)
- `lib/types.ts`
- `docs/contracts/event-schema.json`

Plan:
- Add a shared handler (e.g. `handleAttentionCheckFailure(check, expected, actual)`) passed into the survey and questionnaire so both can report a failure.
- On any failure:
  - Log `attention_check.failed` with payload `{ code, expected, actual }`.
  - Log `experiment.invalidated` with payload `{ reason: 'attention_check', failedCheck: code }`.
  - `await logger.flushAndWait()` so the invalid markers persist before the screen unmounts.
  - Route to a new `terminated` screen explaining the session has ended; no continue button.
- On success, log `attention_check.passed` (payload `{ code }`) and continue normally.
- Extend `Screen` (in `ExperimentFlow.tsx`) and `ExperimentState` (in `lib/types.ts`) with `terminated` / `invalidated`.
- Add a minimal `TerminatedScreen` matching the existing white/black style with a neutral message (do not reveal which check failed).

### Task 2.5.4 - Event Schema Updates

Files:
- `docs/contracts/event-schema.json`

Plan:
- Add event names: `attention_check.passed`, `attention_check.failed`, `experiment.invalidated`.
- Add state(s): `terminated` (and `invalidated` if used).
- `attention_check.*` events use flow `survey` or `questionnaire`; `experiment.invalidated` uses flow `experiment`.

### Task 2.5.5 - Derive Session Validity In Analysis

Files:
- `lib/paper-stats/analysis.ts`
- `app/api/paper-stats/route.ts` (only if new fields surface)
- `scripts/paper-stats*.ts`

Plan:
- Add `isInvalidSession(events)` returning true when any event is `experiment.invalidated` or `attention_check.failed`.
- Mirror the existing bot-exclusion logic: exclude invalid sessions from survey constructs, comparison groups, demographics, completion, and timing aggregates.
- Add `isInvalid` to `SessionDetail` and an `invalidSessions` count to the overview block, parallel to `botSessions`.
- A failed (terminated) session is not `completed`; ensure completion logic is unaffected since `experiment.completed` is never emitted on the failure path.

### Task 2.5.6 - DB Data Structure (Keep Stable)

Files:
- `scripts/create-table.sql` (reference only; no breaking change)

Plan:
- No migration to `experiment_events` is required: `payload` is JSONB and `event_name`/`state` are TEXT, so new events and the invalid marker fit the existing schema.
- Document the invalid-session derivation as the source of truth (event-sourced), consistent with how bot and completed status are computed today.
- Optional (only if a column-level flag is later required for fast SQL filtering): add a nullable `is_valid BOOLEAN` via an additive migration and backfill from events; not needed for correctness and intentionally deferred to keep the schema stable.

## Phase 3 - QA Updates

### Task 3.1 - Update E2E Helpers For New Onboarding

Files:
- `tests/e2e/shared/helpers.ts`
- `tests/e2e/g1-courier-no-autofill.spec.ts`
- `tests/e2e/g2-courier-autofill.spec.ts`
- `tests/e2e/g3-eats-no-autofill.spec.ts`
- `tests/e2e/g4-eats-autofill.spec.ts`

Plan:
- Extend `goToCondition()` setup to complete consent first.
- Keep `completeBackgroundQuestionnaire()` intact, then continue through scenario instruction before asserting `btn-start-ride`.
- Add helper functions such as `acceptConsent()` and `continueScenarioInstruction()`.
- Add assertions that the scenario instruction includes the correct second-service text for each condition.

### Task 3.2 - Add Focused Survey Test Coverage

Files:
- Existing condition specs or a new `tests/e2e/post-task-survey.spec.ts`

Plan:
- Add one focused test that reaches the post-task survey and verifies:
  - 14 total items.
  - Progress text starts at `0 of 14 answered`.
  - Submit button is disabled until all 14 are answered.
  - Representative new questions are visible, especially PU3, PU4, MC3, and MC4.

### Task 3.3 - Add Attention Check Test Coverage

Files:
- `tests/e2e/post-task-survey.spec.ts` or a new `tests/e2e/attention-check.spec.ts`
- `tests/e2e/shared/helpers.ts`

Plan:
- AC1 fail: answer the survey with the wrong `AC1` value, submit, and assert the terminated screen appears and the background questionnaire is never reached.
- AC1 pass: answer `AC1 = Somewhat agree (5)`, submit, and assert the background questionnaire is shown.
- AC2 fail: pass AC1, then answer `AC2` incorrectly in the background questionnaire, submit, and assert the terminated screen appears (no finished screen).
- AC2 pass: answer `AC2 = Rarely` and the rest, submit, and assert the finished screen appears.
- Add a `computePaperStats` assertion that a session with an `experiment.invalidated` / `attention_check.failed` event is excluded from survey/demographic aggregates, like a bot session.
- Update shared helpers so the default happy-path flow answers both attention checks correctly.

## Phase 4 - Documentation And Verification

### Task 4.1 - Update Project Memory Docs

Files:
- `docs/memory/decisions.md`
- `docs/memory/progress.md`

Plan:
- Add an ADR noting the consent/scenario onboarding sequence and the reason for keeping background questionnaire before scenario/task entry.
- Add progress notes once implementation and verification are complete.

### Task 4.2 - Run Verification

Commands:
- `npm run type-check`
- `npm run build`
- `npm run test -- --project=chromium`
- If the full suite is slow, first run targeted specs for G1-G4 plus the new survey/onboarding test, then run the full suite before shipping.

## Risks And Open Questions

- The Word document page references depend on rendered page numbers; extracted text confirms the page 7-8 post-task section contains 14 items.
- New consent/scenario events require `event-schema.json` updates if instrumentation is added. If the study does not need these events, keep consent/scenario unlogged to avoid schema churn.
- Existing pilot data may have 10-item surveys. Analysis code should tolerate both old and new survey payloads if historical pilot data matters.
- The current app has no dedicated onboarding folder. `components/Survey` is acceptable for minimal change, but `components/Onboarding` may be clearer if consent and scenario screens grow.
- Attention check correctness lives only on the client. Because the test terminates on failure and the session is marked invalid via events, a manipulated client could bypass termination; the analysis-side invalid-session exclusion (and Prolific review) remains the backstop. Acceptable for this study.
- Invalid (terminated) sessions still have partial event data in `experiment_events`. This is intentional for audit, but every paper-facing aggregate must exclude them the same way bot sessions are excluded to avoid skewing results.
- Flow ordering: the document orders content as consent -> prototype tasks -> post-task questionnaire (section B) -> background questions (section C, with the attention check). The implemented flow matches this: background questions and `AC2` now run after the post-task survey.
