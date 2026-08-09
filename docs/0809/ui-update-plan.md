# 0809 UI Update — Implementation Plan

## Source Reference

- Requirement source: `docs/0809/Prototype Revision Instructions.pdf` + annotated mockups
  `docs/0809/Section 1.png` … `Section 4.png` (red-pen revisions).
- Mockup → condition mapping:
  - **Section 1** = G1 (Ride + Courier, L×L — no banner, no auto-fill)
  - **Section 2** = G2 (Ride + Courier, H×H — banner + auto-fill)
  - **Section 3** = G3 (Ride + Eats, H×L)
  - **Section 4** = G4 (Ride + Eats, H×H)
- Current implemented flow (`components/ExperimentFlow.tsx`):
  `consent → scenario → task1 instruction → home → map → ride_almost_there → trip_complete → task2 instruction → service2_entry → [service2_delivery | service2_restaurant] → service2_complete → survey → questionnaire → finished`

## Red-Pen Annotations (verbatim intent)

| # | Section | Screen | Annotation | Type |
|---|---------|--------|------------|------|
| A | 1 (G1) | Trip Complete | "change to 1000 Saint-Catherine Street **+ price**" | Required |
| B | 1 (G1) | Delivery Complete | "change to 1000 Saint-Catherine Street" | Required |
| C | 1 (G1) | Courier flow (after Confirm Pickup) | "**Add Package Details Page**" | Required |
| D | 2 (G2) | Courier flow (after Confirm Pickup) | "**Add Package Details Page**" | Required |
| — | 3, 4 | — | no annotations | — |

## Confirmed Decisions (from requester + reviewer)

1. **Package Details Page** = a **new, dedicated step** inserted after "Confirm Pickup".
   The *"What are you sending?"* selector (currently static decoration inside
   `CourierEntryScreen`) is **moved out** of the entry screen into this new page and
   made interactive, plus a small amount of expansion (see Phase 1).
2. The Package Details Page is a **common courier screen for both G1 and G2** — it is
   **not** part of the experimental manipulation (identical in both conditions).
3. **New ride fare**: replace `$28.92` with **`$21.40`** (plausible downtown Montreal fare).
4. **Full consistency**: besides the two annotated "Complete" screens, also align every
   other screen that still shows a stale destination so the whole prototype reads
   "1000 Saint-Catherine Street West". Manipulation-touching addresses are isolated in
   **Phase 3** for explicit sign-off.

**Canonical destination string:** `1000 Saint-Catherine Street West`

---

## Acceptance Criteria

- [ ] Courier flow (G1 **and** G2) inserts a **Package Details** screen between
      `service2_entry` (Confirm Pickup) and `service2_delivery`.
- [ ] The Package Details screen has an **interactive** "What are you sending?" selector
      (Package / Keys / Documents, single-select, default = Package) and a **Continue** button.
- [ ] The old static "What are you sending?" chips are **removed** from `CourierEntryScreen`.
- [ ] The Package Details screen is **visually identical across G1 and G2** (no `config`-driven
      behavioral difference; it is not a manipulation).
- [ ] Trip Complete shows **`1000 Saint-Catherine Street West`** and **`$21.40`** (all conditions).
- [ ] Courier Delivery Complete shows **`1000 Saint-Catherine Street West`** ("Delivered to").
- [ ] No screen still displays the stale `Rue Saint-Laurent` / `Pierre-Elliott-Trudeau Airport`
      destination for the ride/courier drop-off (subject to Phase 3 sign-off for the
      manipulation-sensitive fields).
- [ ] New screen fires `screen.entered` / `screen.exited` via `enterScreen('service2_package_details', 'service2')`.
- [ ] Instrumentation for item-type selection conforms to `docs/contracts/event-schema.json`
      (enum updated if new event names are added).
- [ ] `docs/contracts/experiment-config.json` remains the single source of truth for all
      condition differences; the new page adds **no** condition branches.
- [ ] `npm run type-check`, `npm run build`, and the G1/G2 Playwright specs pass after updates.

---

## Phase 1 — New Package Details Page (annotations C, D)

### Task 1.1 — Create `PackageDetailsScreen` component

Files:
- **new** `components/Service2Phase/PackageDetailsScreen.tsx`

Plan:
- Mirror `CourierEntryScreen` chrome for visual continuity: `StatusBar`, `BackButton`,
  the Rides/Eats/**Courier** tab pills, `BottomNav`, and the same sticky bottom CTA style.
- Content:
  - Title: **"Package details"**.
  - **What are you sending?** — interactive single-select chips
    (`📦 Package` / `🔑 Keys` / `📄 Documents`), default `Package`. Reuse the existing
    chip styling from `CourierEntryScreen` (selected = black fill, unselected = white/border).
  - **Optional expansion (kept intentionally light so it does not collide with the
    entry-screen pricing manipulation):**
    - A short optional **"Note for courier"** text input (free text, not required).
  - Do **not** add a size/weight selector — pickup size/price already lives on the entry
    screen (`pickupOptions`: G1 Small/Medium/Large, G2 Express/Standard) and duplicating it
    would confuse the pricing manipulation.
- Props: `{ onNext: () => void; onBack: () => void }`. No `config` prop (common screen).
- CTA: **"Continue"** → `onNext()`; `BackButton` → `onBack()` (returns to entry).
- `data-testid`s: `screen-package-details`, `item-type-package|keys|documents`,
  `input-package-note`, `btn-package-continue`.

### Task 1.2 — Remove the static selector from `CourierEntryScreen`

Files:
- `components/Service2Phase/CourierEntryScreen.tsx`

Plan:
- Delete the `{/* Item Types */}` block (the static Package/Keys/Documents chips).
- Leave sender/recipient/pickup-option logic untouched.
- **Instrumentation decision (flag for review):** the entry screen currently fires
  `service2.task.submitting` + `markService2Complete()` + `service2.task.complete` inside
  `handleConfirm`. Because task 2 now has an extra step, **move** the
  `markService2Complete()` + `service2.task.complete` firing to the Package Details
  "Continue" handler so the primary timing DV (entry → complete) spans the full arranging
  flow. Keep `service2.task.submitting` on Confirm Pickup (it represents form submission).
  → See Phase 4 for the exact event wiring.

### Task 1.3 — Wire the new screen into the state machine

Files:
- `components/ExperimentFlow.tsx`

Plan:
- Extend `Screen` union with `'service2_package_details'`.
- Add it to `TASK2_SCREENS`.
- Courier branch only. New transition graph for courier:
  `service2_entry → service2_package_details → service2_delivery → service2_complete`.
  - `handleService2EntryNext`: for `courier`, go to `service2_package_details` (was
    `service2_delivery`); for `eats`, unchanged (`service2_restaurant`).
  - Add `goToService2Delivery = () => setScreen('service2_delivery')` used by the new
    screen's `onNext`.
  - Render case `service2_package_details` →
    `<PackageDetailsScreen onNext={goToService2Delivery} onBack={() => goBack('service2_package_details', 'service2_entry')} />`.
- Eats flow (G3/G4) is **unchanged**.

---

## Phase 2 — Destination + Price Consistency (annotations A, B + display sweep)

> These are pure display-string edits on status/complete screens. No behavior change.

### Task 2.1 — Trip Complete (annotation A) — all conditions

Files:
- `components/TripCompletePhase/TripCompleteScreen.tsx`

Plan:
- `Rue Saint-Laurent` → `1000 Saint-Catherine Street West` (Destination card).
- `$28.92` → `$21.40`.
- Note: this component is shared by G1–G4, so the fix lands for every condition (correct —
  all scenarios book the ride to the same address).

### Task 2.2 — Courier Delivery Complete (annotation B) — G1/G2

Files:
- `components/Service2Phase/CourierCompleteScreen.tsx`

Plan:
- `Rue Saint-Laurent` → `1000 Saint-Catherine Street West` ("Delivered to").
- **Keep `$14.75`** (delivery fee, not annotated for a price change).

### Task 2.3 — Ride "almost here" drop-off (consistency)

Files:
- `components/RidePhase/RideAlmostThereScreen.tsx`

Plan:
- Drop off `Pierre-Elliott-Trudeau Airport` → `1000 Saint-Catherine Street West`.
- Keep Pick up `100 Rue McGill` (ride origin / current location).

### Task 2.4 — Courier delivery animation drop-off (consistency)

Files:
- `components/Service2Phase/CourierDeliveryScreen.tsx`

Plan:
- Drop off `Spot-01, Rue McGill` / Address `100 Rue McGill` → align the drop-off to
  `1000 Saint-Catherine Street West` (recipient = the package destination in the task copy).

---

## Phase 3 — Manipulation-Sensitive Address Alignment ⚠️ (requires researcher sign-off)

> The red pen did **not** mark these, and they sit on the **experimental manipulation
> surface** (auto-fill + saved addresses). Listed separately so the researcher can approve
> or skip without blocking Phases 1–2. Reviewer already selected "fix everything", so the
> recommended action below is **apply**, but each item is called out because it changes
> what participants read inside the core manipulation.

### Task 3.1 — Auto-fill label/sublabel (G2 & G4)

Files:
- `docs/contracts/experiment-config.json`
- (consumers: `CourierEntryScreen.tsx`, `EatsEntryScreen.tsx` read `config.addressLabel` / `addressSublabel`)

Current → proposed:
- `addressLabel`: `"Rue Saint-Laurent - spot 01"` → `"1000 Saint-Catherine Street West"`
- `addressSublabel`: `"Near 100 Rue saint-LAURENT"` → `"Near 1000 Saint-Catherine Street West"`

⚠️ Semantic note: the auto-populated field is the **sender** in Courier. Confirm with the
researcher whether the carried-over destination should represent the sender's location or
the recipient before applying, since the H-condition manipulation copy depends on it.

### Task 3.2 — Courier entry saved/suggested addresses

Files:
- `components/Service2Phase/CourierEntryScreen.tsx`

Current arrays reference `Rue Saint-Laurent` / `Rue McGill` / `Saint-Louis`. If Phase 3 is
approved, add/prefer `1000 Saint-Catherine Street West` as a selectable recipient so the
"send to the same destination" task can be completed by tapping instead of typing, and align
`SENDER_SUGGESTIONS` / `SAVED_SENDER_PLACES` accordingly.

### Task 3.3 — QA reference tables

Files:
- `.opencode/agent/qa.md`
- `.cursor/rules/opencode-qa.mdc`

Plan:
- Update the "Service2 address auto-filled" row from `"Rue Saint-Laurent - spot 01"` to the
  new value if Task 3.1 is applied.

---

## Phase 4 — Instrumentation & Contracts

### Task 4.1 — Screen tracking for the new page

Files:
- `components/Service2Phase/PackageDetailsScreen.tsx`

Plan:
- On mount: `const cleanup = enterScreen('service2_package_details', 'service2'); return cleanup`.
- `service2_package_details` flows automatically into the navigation-path array — no enum
  needed for screen ids (free-form strings in `screen-tracker.ts`).

### Task 4.2 — Event names for item selection

Files:
- `docs/contracts/event-schema.json`
- `lib/logger.ts` (only if the event-name type is a closed union — verify)

Plan:
- Add to the `eventName` enum:
  - `service2.package_details.viewed`
  - `service2.item_selected`
- Fire `service2.item_selected` on chip change with payload `{ itemType }`.
- Reuse existing `service2.task.submitting` (entry) and move `service2.task.complete` +
  `markService2Complete()` to the Package Details "Continue" (per Task 1.2).

### Task 4.3 — Confirm timing semantics

Files:
- `lib/timing.ts` (read-only check), `components/Service2Phase/*`

Plan:
- Verify `markService2Entry()` still fires once on `CourierEntryScreen` mount and
  `markService2Complete()` now fires on Package Details Continue, so `durationMs` on
  `service2.task.complete` includes the new step. Document this in `docs/memory/decisions.md`.

---

## Phase 5 — Tests

### Task 5.1 — Shared helper

Files:
- `tests/e2e/shared/helpers.ts`

Plan:
- `completeCourierEntry`: after `btn-confirm-pickup`, add the new step — assert
  `screen-package-details` visible, (optionally select an item type), click
  `btn-package-continue`.

### Task 5.2 — G1 spec

Files:
- `tests/e2e/g1-courier-no-autofill.spec.ts`

Plan:
- Trip Complete assertions: `Rue Saint-Laurent` → `1000 Saint-Catherine Street West`,
  `$28.92` → `$21.40`.
- Add a Package Details step assertion in the courier flow.

### Task 5.3 — G2 spec

Files:
- `tests/e2e/g2-courier-autofill.spec.ts`

Plan:
- Add Package Details step assertion.
- If Phase 3.1 is applied: update the sender auto-fill value assertion
  (`Rue Saint-Laurent - spot 01` → new value) and the `Near …` sublabel.

### Task 5.4 — Regression

Files:
- `tests/e2e/g3-*.spec.ts`, `g4-*.spec.ts`, `post-task-survey.spec.ts`

Plan:
- Confirm Eats flows and survey specs still pass (Trip Complete text is shared but G3/G4
  specs don't assert the old destination string; verify none do after the change).

---

## Phase 6 — Docs, Memory & Verification

### Task 6.1 — Update project memory

Files:
- `docs/memory/progress.md`, `docs/memory/decisions.md`

Plan:
- Log: new Package Details courier step, destination unified to 1000 Saint-Catherine,
  fare `$21.40`, and the timing-DV relocation decision.

### Task 6.2 — Verification gate

Commands:
- `npm run type-check`
- `npm run build`
- `npx playwright test tests/e2e/g1-courier-no-autofill.spec.ts tests/e2e/g2-courier-autofill.spec.ts`
- Manual smoke of G1 & G2 courier flow to confirm the new page renders and advances.

---

## File-Change Summary

| File | Phase | Change |
|------|-------|--------|
| `components/Service2Phase/PackageDetailsScreen.tsx` | 1 | **new** screen |
| `components/Service2Phase/CourierEntryScreen.tsx` | 1, 3 | remove static chips; move timing; (opt) addresses |
| `components/ExperimentFlow.tsx` | 1 | new `Screen`, transition, render case |
| `components/TripCompletePhase/TripCompleteScreen.tsx` | 2 | address + `$21.40` |
| `components/Service2Phase/CourierCompleteScreen.tsx` | 2 | address |
| `components/RidePhase/RideAlmostThereScreen.tsx` | 2 | drop-off address |
| `components/Service2Phase/CourierDeliveryScreen.tsx` | 2 | drop-off address |
| `docs/contracts/experiment-config.json` | 3 | auto-fill label/sublabel (G2/G4) |
| `docs/contracts/event-schema.json` | 4 | new event names |
| `.opencode/agent/qa.md`, `.cursor/rules/opencode-qa.mdc` | 3 | QA table |
| `tests/e2e/shared/helpers.ts` | 5 | courier flow + package step |
| `tests/e2e/g1-courier-no-autofill.spec.ts` | 5 | Trip Complete text/price + step |
| `tests/e2e/g2-courier-autofill.spec.ts` | 5 | step (+ auto-fill if Phase 3) |
| `docs/memory/progress.md`, `docs/memory/decisions.md` | 6 | log changes |

## Open Questions / Notes

1. **Sender vs. recipient semantics** (Task 3.1): the carried-over address auto-fills the
   *sender*; confirm this is intended before rewriting it to the ride destination.
2. **Timing DV relocation** (Task 1.2 / 4.2): confirm the primary task-2 completion time
   should include the Package Details step (recommended) vs. ending at Confirm Pickup.
3. **Delivery fee `$14.75`**: kept as-is (only the ride fare was annotated "+ price").
