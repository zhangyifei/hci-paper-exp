import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CONDITION_AGENTS, buildSessionEvents, makeRng } from './lib/sim-agents.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schema = JSON.parse(readFileSync(path.join(ROOT, 'docs/contracts/event-schema.json'), 'utf8'))
// Event names the production app emits that the (stale) schema contract omits,
// but which appear in the real pilot data — kept for fidelity to real sessions.
const PRODUCTION_EXTRA_NAMES = ['ride.destination_selected', 'ride.destination_entered']
const okName = new Set([...schema.properties.eventName.enum, ...PRODUCTION_EXTRA_NAMES])
const okFlow = new Set(schema.properties.flow.enum)
const okState = new Set(schema.properties.state.enum)

const rng = makeRng(1)
let errors = 0
let checked = 0
for (const cond of ['G1', 'G2', 'G3', 'G4']) {
  const { events } = buildSessionEvents(CONDITION_AGENTS[cond], rng, { tag: 'SIMCHK', endWallMs: Date.now() })
  // ordering + required fields
  let prevSeq = -1
  for (const e of events) {
    checked++
    if (!okName.has(e.eventName)) console.log(`${cond} bad eventName: ${e.eventName}`), errors++
    if (!okFlow.has(e.flow)) console.log(`${cond} bad flow: ${e.flow} (${e.eventName})`), errors++
    if (!okState.has(e.state)) console.log(`${cond} bad state: ${e.state} (${e.eventName})`), errors++
    if (e.sequenceId !== prevSeq + 1) console.log(`${cond} seq gap at ${e.eventName}: ${e.sequenceId}`), errors++
    prevSeq = e.sequenceId
    for (const k of ['eventId', 'sessionId', 'participantId', 'timestamp', 'clientMonoMs', 'condition']) {
      if (e[k] == null) console.log(`${cond} missing ${k} on ${e.eventName}`), errors++
    }
    if (e.eventName === 'service2.task.complete') {
      if (e.durationMs == null || e.parentEventId == null)
        console.log(`${cond} task.complete missing durationMs/parentEventId`), errors++
    }
  }
  // timestamps monotonic non-decreasing
  for (let i = 1; i < events.length; i++)
    if (events[i].timestamp < events[i - 1].timestamp)
      console.log(`${cond} non-monotonic ts at ${events[i].eventName}`), errors++
  // navLag/s2dur sanity
  const trip = events.find((e) => e.eventName === 'trip_complete.viewed')
  const entry = events.find((e) => e.eventName === 'service2.entry')
  const done = events.find((e) => e.eventName === 'service2.task.complete')
  console.log(
    `${cond}: events=${events.length} navLag=${((entry.timestamp - trip.timestamp) / 1000).toFixed(1)}s s2dur=${(
      done.durationMs / 1000
    ).toFixed(1)}s`,
  )
}
console.log(`\nChecked ${checked} events. Errors: ${errors}`)
process.exit(errors ? 1 : 0)
