# Feature Orchestration Recipe

This command guides orchestration of a new feature through the full agent pipeline.

## Usage

Invoke this recipe when adding a new screen, behavior, or instrumentation event.

---

## Step 1 — Contract Gate

Before any code changes:

1. **Contract Agent**: Update `docs/contracts/experiment-config.json` if the feature changes G1–G4 behavior
2. **Contract Agent**: Update `docs/contracts/event-schema.json` if the feature adds new events
3. Get contract agent sign-off before proceeding

```
task(subagent_type="contract", prompt="Review proposed change to experiment-config.json: [describe change]. Validate against G1–G4 spec. Return: approved/rejected with reason.")
```

---

## Step 2 — UI Implementation

4. **UI Agent**: Implement the screen/component reading from `src/lib/experiment-config.ts`
5. Must emit instrumentation events at all state transitions
6. Must include `data-testid` attributes on all interactive elements

```
task(category="visual-engineering", load_skills=["frontend-ui-ux"], prompt="...")
```

---

## Step 3 — Instrumentation

7. **Instrumentation Agent**: Add any new events to logger, verify schema compliance
8. Update DB schema if new fields needed

```
task(category="unspecified-low", load_skills=["instrumentation"], prompt="...")
```

---

## Step 4 — QA

9. **QA Agent**: Write/update Playwright tests for the new feature
10. Run tests, confirm pass

```
task(category="unspecified-low", load_skills=["qa", "playwright"], prompt="...")
```

---

## Step 5 — Deploy

11. **DevOps Agent**: Deploy to Vercel staging, run smoke test
12. If passes → promote to prod

```
task(category="unspecified-low", load_skills=["devops"], prompt="...")
```

---

## Step 6 — Memory Update

13. Log decision to `docs/memory/decisions.md`
14. Update progress in `docs/memory/progress.md`

---

## Anti-Patterns (never do)

- Skip the contract gate for any condition behavior change
- Hardcode condition logic in UI components
- Deploy without a passing build
- Commit without orchestrator approval
