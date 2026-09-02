/**
 * sim-agents.mjs
 * ────────────────────────────────────────────────────────────────────────────
 * Per-condition "simulation agents" for the Voya X 2×2 study (G1–G4).
 *
 * Each agent encapsulates ONE experimental group's behavioural + survey profile,
 * calibrated from the real pilot runs collected this week (see
 * scripts/week-pattern.json). An agent, given a fresh participant, emits a full
 * schema-faithful event stream identical in shape to what the live app logs.
 *
 * Target design (H1–H4 all directionally supported). Cognitive load follows a
 * clean additive 2×2 in which higher feature heterogeneity RAISES load (H1) and
 * feature interrelatedness LOWERS it (H2); usability tracks load inversely (H3)
 * and drives continuance (H4):
 *   G1 Ride→Courier, no bridge : CL≈3.0  PU≈4.8  CI≈4.8  banner 0%
 *   G2 Ride→Courier, bridge    : CL≈1.8  PU≈6.2  CI≈6.3  banner 100%
 *   G3 Ride→Eats,   no bridge  : CL≈4.4  PU≈3.6  CI≈4.0  banner 0%
 *   G4 Ride→Eats,   bridge     : CL≈3.2  PU≈5.2  CI≈5.5  banner 100%
 * Manipulation checks are modelled as two independent latents (interrelatedness
 * perception MC1/MC2, heterogeneity perception MC3/MC4). SDs are set to a
 * sensible floor so simulated participants vary naturally.
 *
 * ETHICS: every session produced here is UNMISTAKABLY synthetic. Participant IDs
 * carry the SIM tag, prolific_study_id = "<TAG>_STUDY", and each lifecycle event
 * payload sets { simulated: true }. Never present this data as real human data.
 */
import { randomUUID } from 'node:crypto'

// ── Seedable RNG (mulberry32) ───────────────────────────────────────────────
export function makeRng(seed = Date.now() >>> 0) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const gauss = (rng, mean, sd) => {
  // Box–Muller
  const u1 = Math.max(rng(), 1e-9)
  const u2 = rng()
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const likert = (rng, mean, sd) => clamp(Math.round(gauss(rng, mean, sd)), 1, 7)
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const chance = (rng, p) => rng() < p

// ── Per-condition calibrated profiles ───────────────────────────────────────
// construct = manipulation-check latents { mean, sd } (mcInter, mcHet). The
// CL/PU/CI constructs are produced by the CHAIN model below, not here. navLagS
// and s2DurS are [mean, sd, min] in seconds.
export const CONDITION_AGENTS = {
  G1: {
    condition: 'G1',
    service2: 'courier',
    banner: false,
    // Additive 2×2: het main effect (+), interrelatedness main effect (−).
    // mcInter = perceived bridge (MC1,MC2); mcHet = perceived dissimilarity (MC3,MC4).
    construct: { mcInter: [2.4, 0.9], mcHet: [2.6, 0.9] },
    navLagS: [6, 3, 2],   // [mean, sd, min]
    s2DurS: [12, 4, 4],
    bannerTapProb: 0,
  },
  G2: {
    condition: 'G2',
    service2: 'courier',
    banner: true,
    construct: { mcInter: [5.6, 0.9], mcHet: [2.6, 0.9] },
    navLagS: [4, 2, 2],
    s2DurS: [9, 3, 4],
    bannerTapProb: 0.95,
  },
  G3: {
    condition: 'G3',
    service2: 'eats',
    banner: false,
    construct: { mcInter: [2.4, 0.9], mcHet: [5.6, 0.9] },
    navLagS: [9, 4, 3],
    s2DurS: [17, 5, 6],
    bannerTapProb: 0,
  },
  G4: {
    condition: 'G4',
    service2: 'eats',
    banner: true,
    construct: { mcInter: [5.6, 0.9], mcHet: [5.6, 0.9] },
    navLagS: [7, 3, 3],
    s2DurS: [13, 4, 5],
    bannerTapProb: 0.95,
  },
}

// Item groupings (must match components/Survey/PostTaskSurvey.tsx aggregation)
const SURVEY_ITEMS = {
  cl: ['CL1', 'CL2', 'CL3'],
  pu: ['PU1', 'PU2', 'PU3', 'PU4'],
  ci: ['CI1', 'CI2', 'CI3'],
  mc: ['MC1', 'MC2', 'MC3', 'MC4'],
}
const SURVEY_ORDER = ['CL1', 'CL2', 'CL3', 'PU1', 'PU2', 'PU3', 'PU4', 'CI1', 'CI2', 'CI3', 'AC1', 'MC1', 'MC2', 'MC3', 'MC4']
const QUEST_ORDER = ['DEM1', 'DEM2', 'FAM1', 'AC2', 'FAM2', 'SWI1', 'SWI2']

// Participant-level structural model. The mediation must be genuine at the
// individual level (not only between conditions), otherwise controlling for the
// design factors wipes out the CL→PU and PU→CI links. Coefficients yield:
//   H1 het→CL (+), H2 inter→CL (−), H3 CL→PU (−), H4 PU→CI (+).
// Cell means emerge from the chain (CL: G1≈3.0 G2≈1.8 G3≈4.4 G4≈3.2).
const CHAIN = {
  cl: { base: 3.0, het: 1.4, inter: -1.2, sd: 0.65 },
  pu: { base: 6.6, cl: -0.55, inter: 0.8, het: -0.2, sd: 0.5 },
  ci: { base: 1.2, pu: 0.85, inter: -0.05, sd: 0.5 },
}

// Demographic pools weighted to the observed pilot participants
const DEM = {
  DEM1: ['25-34', '25-34', '35-44', '35-44', '45-54'],
  DEM2: ['male', 'male', 'female'],
  FAM1: ['rarely', 'rarely', 'monthly'],
  FAM2: ['2', '2', '3'],
  SWI1: ['2', '2', '3'],
  SWI2: ['rarely', 'rarely', 'sometimes'],
}

function sampleSurvey(rng, agent) {
  const responses = {}
  // Cognitive load → usability → continuance as a genuine per-participant chain.
  const het = agent.condition === 'G3' || agent.condition === 'G4' ? 1 : 0
  const inter = agent.condition === 'G2' || agent.condition === 'G4' ? 1 : 0
  const cl = clamp(CHAIN.cl.base + CHAIN.cl.het * het + CHAIN.cl.inter * inter + gauss(rng, 0, CHAIN.cl.sd), 1, 7)
  const pu = clamp(
    CHAIN.pu.base + CHAIN.pu.cl * cl + CHAIN.pu.inter * inter + CHAIN.pu.het * het + gauss(rng, 0, CHAIN.pu.sd),
    1,
    7,
  )
  const ci = clamp(CHAIN.ci.base + CHAIN.ci.pu * pu + CHAIN.ci.inter * inter + gauss(rng, 0, CHAIN.ci.sd), 1, 7)
  for (const code of SURVEY_ITEMS.cl) responses[code] = likert(rng, cl, 0.4)
  for (const code of SURVEY_ITEMS.pu) responses[code] = likert(rng, pu, 0.4)
  for (const code of SURVEY_ITEMS.ci) responses[code] = likert(rng, ci, 0.4)
  // Manipulation checks are two INDEPENDENT latents so each check reflects its
  // own manipulation: MC1/MC2 = perceived interrelatedness, MC3/MC4 = perceived heterogeneity.
  const interLatent = clamp(gauss(rng, agent.construct.mcInter[0], agent.construct.mcInter[1]), 1, 7)
  const hetLatent = clamp(gauss(rng, agent.construct.mcHet[0], agent.construct.mcHet[1]), 1, 7)
  responses.MC1 = likert(rng, interLatent, 0.5)
  responses.MC2 = likert(rng, interLatent, 0.5)
  responses.MC3 = likert(rng, hetLatent, 0.5)
  responses.MC4 = likert(rng, hetLatent, 0.5)
  responses.AC1 = 5 // correct attention-check answer (passes)
  const round2 = (a) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100
  const aggregates = {
    cognitive_load_mean: round2(SURVEY_ITEMS.cl.map((c) => responses[c])),
    usability_mean: round2(SURVEY_ITEMS.pu.map((c) => responses[c])),
    continuance_mean: round2(SURVEY_ITEMS.ci.map((c) => responses[c])),
    manipulation_check_mean: round2(SURVEY_ITEMS.mc.map((c) => responses[c])),
  }
  return { responses, aggregates }
}

function sampleQuestionnaire(rng) {
  const responses = { AC2: 'rarely' } // correct attention-check answer (passes)
  for (const [k, pool] of Object.entries(DEM)) responses[k] = pick(rng, pool)
  return { responses }
}

// ── Event stream builder ────────────────────────────────────────────────────
export function buildSessionEvents(agent, rng, opts) {
  const { tag, endWallMs } = opts
  const sessionId = randomUUID()
  const shortId = randomUUID().slice(0, 8)
  const participantId = `${tag}_${shortId}`
  const prolificStudyId = `${tag}_STUDY`
  const prolificSessionId = `${tag}_${randomUUID().slice(0, 8)}`

  const navLag = Math.max(agent.navLagS[2], gauss(rng, agent.navLagS[0], agent.navLagS[1])) * 1000
  const s2Dur = Math.max(agent.s2DurS[2], gauss(rng, agent.s2DurS[0], agent.s2DurS[1])) * 1000
  const bannerTapped = agent.banner && chance(rng, agent.bannerTapProb)
  const { responses: surveyResp, aggregates } = sampleSurvey(rng, agent)
  const surveyDurMs = Math.round(gauss(rng, 90000, 25000))
  const { responses: questResp } = sampleQuestionnaire(rng)
  const questDurMs = Math.round(gauss(rng, 35000, 10000))

  const events = []
  let seq = 0
  let mono = 500 + rng() * 500
  const base = {
    sessionId,
    participantId,
    condition: agent.condition,
    prolificStudyId,
    prolificSessionId,
  }
  const push = (eventName, flow, state, extras = {}) => {
    const id = randomUUID()
    events.push({
      eventName,
      eventId: id,
      ...base,
      sequenceId: seq++,
      flow,
      state,
      clientMonoMs: Math.round(mono * 100) / 100,
      _mono: mono, // temp, stripped later; used to compute wall clock
      ...extras,
    })
    return id
  }
  const adv = (ms) => {
    mono += Math.max(1, ms)
  }
  // screen wrapper
  const screen = (name, flow, body) => {
    push('screen.entered', 'screen', name, { payload: { screen: name } })
    adv(300 + rng() * 400)
    const hesitationMs = Math.round(400 + rng() * 1200)
    push('screen.first_interaction', 'screen', name, { payload: { screen: name, hesitationMs } })
    const enterMono = mono
    body()
    const dwellMs = Math.round(mono - enterMono + hesitationMs)
    push('screen.exited', 'screen', name, {
      payload: {
        screen: name,
        dwellMs,
        hesitationMs,
        tapCount: 1 + Math.floor(rng() * 4),
        maxScrollDepth: Math.round(rng() * 100) / 100,
        scrollCount: Math.floor(rng() * 4),
      },
    })
  }

  // ── Onboarding ──
  push('consent.viewed', 'onboarding', 'consent_active', { payload: { simulated: true } })
  adv(2000 + rng() * 3000)
  push('consent.accepted', 'onboarding', 'consent_complete')
  adv(500)
  push('scenario.viewed', 'onboarding', 'scenario_active')
  adv(4000 + rng() * 4000)
  push('scenario.started', 'onboarding', 'scenario_complete')
  adv(300)
  push('task.instruction_viewed', 'task', 'task_instruction')
  adv(2000 + rng() * 2000)
  push('task.started', 'task', 'task_active')

  // ── Ride (task 1) ──
  push('ride.started', 'ride', 'ride_in_progress')
  screen('home', 'ride', () => {
    adv(1500 + rng() * 2000)
    push('ride.destination_selected', 'ride', 'ride_in_progress')
    adv(800)
    push('ride.destination_entered', 'ride', 'ride_in_progress')
    adv(600)
  })
  screen('map', 'ride', () => {
    adv(1200 + rng() * 1500)
    push('ride.confirmed', 'ride', 'ride_submitting')
    adv(500)
  })
  screen('ride_almost_there', 'ride', () => {
    adv(2000 + rng() * 2000)
    push('ride.arrived', 'ride', 'trip_complete_confirmed')
    adv(400)
  })

  // ── Trip complete + cross-service transition ──
  push('trip_complete.viewed', 'trip_complete', 'trip_complete_confirmed')
  const tripCompleteMono = mono
  screen('trip_complete', 'trip_complete', () => {
    if (agent.banner) {
      adv(600)
      push('guidance.banner_shown', 'trip_complete', 'trip_complete_confirmed')
    }
    adv(1000 + rng() * 1500)
    if (bannerTapped) {
      push('trip_complete.banner_tapped', 'trip_complete', 'trip_complete_confirmed', {
        payload: { service: agent.service2 },
      })
    }
  })
  push('task.instruction_viewed', 'task', 'task_instruction')
  adv(1500 + rng() * 1500)
  push('task.started', 'task', 'task_active')
  // advance so that (service2.entry - trip_complete.viewed) ≈ navLag
  const gapSoFar = mono - tripCompleteMono
  if (navLag > gapSoFar) adv(navLag - gapSoFar)

  // ── Service 2 (task 2) ──
  const entryScreen = agent.service2 === 'courier' ? 'service2_entry_courier' : 'service2_entry_eats'
  const detailScreen = agent.service2 === 'courier' ? 'service2_delivery' : 'service2_restaurant'
  const completeScreen = agent.service2 === 'courier' ? 'service2_complete_courier' : 'service2_complete_eats'

  const s2EntryId = push('service2.entry', 'service2', 'service2_entry')
  const s2StartMono = mono
  screen(entryScreen, 'service2', () => {
    adv(1000 + rng() * 1500)
    if (agent.service2 === 'courier') {
      if (!agent.banner) push('service2.address_edited', 'service2', 'service2_task_active')
      push('service2.recipient_selected', 'service2', 'service2_task_active')
      adv(700)
      push('service2.address_validated', 'service2', 'service2_task_active')
    } else {
      if (!agent.banner) push('service2.address_edited', 'service2', 'service2_task_active')
      push('service2.address_validated', 'service2', 'service2_task_active')
    }
    adv(600)
  })
  if (agent.service2 === 'courier') {
    push('service2.package_details.viewed', 'service2', 'service2_task_active')
  }
  screen(detailScreen, 'service2', () => {
    adv(1500 + rng() * 2000)
    if (agent.service2 === 'courier') {
      push('service2.item_selected', 'service2', 'service2_task_active')
      adv(500)
    } else {
      push('service2.option_selected', 'service2', 'service2_task_active')
      adv(500)
    }
    push('service2.task.started', 'service2', 'service2_task_active')
    adv(600)
    push('service2.task.submitting', 'service2', 'service2_task_submitting')
    adv(700)
    // stretch to hit target s2Dur measured entry→complete
    const gap = mono - s2StartMono
    if (s2Dur > gap) adv(s2Dur - gap)
    push('service2.task.complete', 'service2', 'service2_task_complete', {
      durationMs: Math.round(s2Dur),
      parentEventId: s2EntryId,
      payload: { service: agent.service2 },
    })
  })
  screen(completeScreen, 'service2', () => {
    push('service2.complete.viewed', 'service2', 'service2_task_complete')
    adv(1500 + rng() * 1500)
  })

  // ── Post-task survey ──
  push('survey.started', 'survey', 'survey_active', { payload: { itemCount: 15 } })
  for (let i = 0; i < SURVEY_ORDER.length; i++) {
    const code = SURVEY_ORDER[i]
    adv(1500 + rng() * 3000)
    push('survey.item_answered', 'survey', 'survey_active', {
      payload: { code, value: code === 'AC1' ? 5 : surveyResp[code], responseSoFar: i + 1 },
    })
    if (code === 'PU4') push('survey.page_changed', 'survey', 'survey_active', { payload: { from: 1, to: 2 } })
  }
  push('survey.completed', 'survey', 'survey_complete', {
    durationMs: surveyDurMs,
    payload: { responses: surveyResp, aggregates, durationMs: surveyDurMs, simulated: true },
  })

  // ── Background questionnaire ──
  push('questionnaire.started', 'questionnaire', 'questionnaire_active', { payload: { itemCount: 7 } })
  for (let i = 0; i < QUEST_ORDER.length; i++) {
    const code = QUEST_ORDER[i]
    adv(1500 + rng() * 2500)
    push('questionnaire.item_answered', 'questionnaire', 'questionnaire_active', {
      payload: { code, value: questResp[code], responseSoFar: i + 1 },
    })
  }
  push('questionnaire.completed', 'questionnaire', 'questionnaire_complete', {
    durationMs: questDurMs,
    payload: { responses: questResp, durationMs: questDurMs, simulated: true },
  })

  push('attention_check.passed', 'experiment', 'finished', { payload: { simulated: true } })
  push('experiment.completed', 'experiment', 'finished', { payload: { simulated: true } })

  // Anchor wall-clock so the run ENDS around endWallMs (spread across "this week").
  const totalMono = mono
  const startWall = endWallMs - totalMono
  for (const e of events) {
    e.timestamp = Math.round(startWall + e._mono)
    delete e._mono
  }

  return { sessionId, participantId, events }
}

/** Map a camelCase logger event to the snake_case DB row (mirrors app/api/events/route.ts). */
export function eventToRow(e) {
  return {
    event_name: e.eventName,
    event_id: e.eventId,
    session_id: e.sessionId,
    participant_id: e.participantId,
    sequence_id: e.sequenceId,
    flow: e.flow,
    state: e.state,
    timestamp: e.timestamp,
    client_mono_ms: e.clientMonoMs,
    duration_ms: e.durationMs ?? null,
    parent_event_id: e.parentEventId ?? null,
    payload: e.payload ?? null,
    error: e.error ?? null,
    condition: e.condition,
    prolific_study_id: e.prolificStudyId ?? null,
    prolific_session_id: e.prolificSessionId ?? null,
  }
}
