/**
 * paper-stats-survey.ts
 * Extract survey aggregate statistics per condition for the paper.
 */
import { fetchAllEventRows } from './lib/supabase-admin'

interface SurveyAggregates {
  cognitive_load_mean: number
  usability_mean: number
  continuance_mean: number
  manipulation_check_mean: number
}

interface SurveyResponses {
  DEM1?: string
  DEM2?: string
  FAM1?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getSurveyAggregates(payload: Record<string, unknown> | null): SurveyAggregates | null {
  if (!isRecord(payload)) {
    return null
  }

  const aggregates = payload.aggregates
  if (!isRecord(aggregates)) {
    return null
  }

  const cognitiveLoad = aggregates.cognitive_load_mean
  const usability = aggregates.usability_mean
  const continuance = aggregates.continuance_mean
  const manipulationCheck = aggregates.manipulation_check_mean

  if (
    typeof cognitiveLoad !== 'number' ||
    typeof usability !== 'number' ||
    typeof continuance !== 'number' ||
    typeof manipulationCheck !== 'number'
  ) {
    return null
  }

  return {
    cognitive_load_mean: cognitiveLoad,
    usability_mean: usability,
    continuance_mean: continuance,
    manipulation_check_mean: manipulationCheck,
  }
}

function getSurveyResponses(payload: Record<string, unknown> | null): SurveyResponses | null {
  if (!isRecord(payload)) {
    return null
  }

  const responses = payload.responses
  if (!isRecord(responses)) {
    return null
  }

  return {
    DEM1: typeof responses.DEM1 === 'string' ? responses.DEM1 : undefined,
    DEM2: typeof responses.DEM2 === 'string' ? responses.DEM2 : undefined,
    FAM1: typeof responses.FAM1 === 'string' ? responses.FAM1 : undefined,
  }
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
function sd(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1))
}

async function main() {
  const rows = await fetchAllEventRows()

  // Get completed events with aggregates in payload (could be questionnaire.completed or survey.completed)
  const qComplete = rows.filter((r) => {
    return (
      (r.event_name === 'questionnaire.completed' || r.event_name === 'survey.completed') &&
      getSurveyAggregates(r.payload) !== null
    )
  })

  // Debug: show what we found
  console.log('DEBUG: total questionnaire.completed:', rows.filter((r) => r.event_name === 'questionnaire.completed').length)
  console.log('DEBUG: total survey.completed:', rows.filter((r) => r.event_name === 'survey.completed').length)
  const withAgg = rows.filter((r) => {
    return (
      (r.event_name === 'questionnaire.completed' || r.event_name === 'survey.completed') &&
      getSurveyAggregates(r.payload) !== null
    )
  })
  console.log('DEBUG: completed with aggregates:', withAgg.length)
  if (withAgg.length === 0) {
    // Try without aggregates filter
    const allCompleted = rows.filter((r) =>
      (r.event_name === 'questionnaire.completed' || r.event_name === 'survey.completed')
    )
    console.log('DEBUG: all completed events with payload samples:')
    for (const r of allCompleted.slice(0, 3)) {
      console.log('  payload keys:', r.payload ? Object.keys(r.payload) : 'null')
      console.log('  payload:', JSON.stringify(r.payload).substring(0, 200))
    }
  }

  // Collect per participant per condition
  interface ParticipantSurvey {
    pid: string
    condition: string
    cognitiveLoad: number
    usability: number
    continuance: number
    manipCheck: number
  }

  const surveys: ParticipantSurvey[] = []
  for (const q of qComplete) {
    const agg = getSurveyAggregates(q.payload)
    if (!agg) {
      continue
    }

    surveys.push({
      pid: q.participant_id,
      condition: q.condition,
      cognitiveLoad: agg.cognitive_load_mean,
      usability: agg.usability_mean,
      continuance: agg.continuance_mean,
      manipCheck: agg.manipulation_check_mean,
    })
  }

  console.log(`Total survey responses with aggregates: ${surveys.length}`)
  console.log('')

  // Per-condition survey stats
  console.log('=== SURVEY STATISTICS BY CONDITION ===')
  console.log('Construct: Cognitive Load (CL1-CL3, 7-pt scale, higher = more load)')
  console.log('Construct: Usability (PU1-PU2, 7-pt scale, higher = better)')
  console.log('Construct: Continuance Intention (CI1-CI2, 7-pt scale, higher = more intent)')
  console.log('Construct: Manipulation Check (MC1-MC2, 7-pt scale, higher = more recognized)')
  console.log('')

  for (const cond of ['G1','G2','G3','G4']) {
    const condSurveys = surveys.filter(s => s.condition === cond)
    console.log(`${cond} (n=${condSurveys.length}):`)

    if (condSurveys.length > 0) {
      const cl = condSurveys.map(s => s.cognitiveLoad)
      const us = condSurveys.map(s => s.usability)
      const ci = condSurveys.map(s => s.continuance)
      const mc = condSurveys.map(s => s.manipCheck)

      console.log(`  Cognitive Load:  M=${mean(cl).toFixed(2)}, SD=${sd(cl).toFixed(2)} (values: ${cl.map(v => v.toFixed(2)).join(', ')})`)
      console.log(`  Usability:       M=${mean(us).toFixed(2)}, SD=${sd(us).toFixed(2)} (values: ${us.map(v => v.toFixed(2)).join(', ')})`)
      console.log(`  Continuance:     M=${mean(ci).toFixed(2)}, SD=${sd(ci).toFixed(2)} (values: ${ci.map(v => v.toFixed(2)).join(', ')})`)
      console.log(`  Manip. Check:    M=${mean(mc).toFixed(2)}, SD=${sd(mc).toFixed(2)} (values: ${mc.map(v => v.toFixed(2)).join(', ')})`)
    }
    console.log('')
  }

  // Now aggregate: Low vs High heterogeneity (G1/G2 = Courier = low, G3/G4 = Eats = high)
  console.log('=== HETEROGENEITY COMPARISON ===')
  const low = surveys.filter(s => s.condition === 'G1' || s.condition === 'G2')
  const high = surveys.filter(s => s.condition === 'G3' || s.condition === 'G4')
  console.log(`Low heterogeneity (G1+G2, n=${low.length}):`)
  console.log(`  CL: M=${mean(low.map(s=>s.cognitiveLoad)).toFixed(2)}, SD=${sd(low.map(s=>s.cognitiveLoad)).toFixed(2)}`)
  console.log(`  PU: M=${mean(low.map(s=>s.usability)).toFixed(2)}, SD=${sd(low.map(s=>s.usability)).toFixed(2)}`)
  console.log(`  CI: M=${mean(low.map(s=>s.continuance)).toFixed(2)}, SD=${sd(low.map(s=>s.continuance)).toFixed(2)}`)
  console.log(`High heterogeneity (G3+G4, n=${high.length}):`)
  console.log(`  CL: M=${mean(high.map(s=>s.cognitiveLoad)).toFixed(2)}, SD=${sd(high.map(s=>s.cognitiveLoad)).toFixed(2)}`)
  console.log(`  PU: M=${mean(high.map(s=>s.usability)).toFixed(2)}, SD=${sd(high.map(s=>s.usability)).toFixed(2)}`)
  console.log(`  CI: M=${mean(high.map(s=>s.continuance)).toFixed(2)}, SD=${sd(high.map(s=>s.continuance)).toFixed(2)}`)

  // Low vs High interrelatedness (G1/G3 = no bridge = low, G2/G4 = bridge = high)
  console.log('\n=== INTERRELATEDNESS COMPARISON ===')
  const noBridge = surveys.filter(s => s.condition === 'G1' || s.condition === 'G3')
  const bridge = surveys.filter(s => s.condition === 'G2' || s.condition === 'G4')
  console.log(`Low interrelatedness (G1+G3, n=${noBridge.length}):`)
  console.log(`  CL: M=${mean(noBridge.map(s=>s.cognitiveLoad)).toFixed(2)}, SD=${sd(noBridge.map(s=>s.cognitiveLoad)).toFixed(2)}`)
  console.log(`  PU: M=${mean(noBridge.map(s=>s.usability)).toFixed(2)}, SD=${sd(noBridge.map(s=>s.usability)).toFixed(2)}`)
  console.log(`  CI: M=${mean(noBridge.map(s=>s.continuance)).toFixed(2)}, SD=${sd(noBridge.map(s=>s.continuance)).toFixed(2)}`)
  console.log(`  MC: M=${mean(noBridge.map(s=>s.manipCheck)).toFixed(2)}, SD=${sd(noBridge.map(s=>s.manipCheck)).toFixed(2)}`)
  console.log(`High interrelatedness (G2+G4, n=${bridge.length}):`)
  console.log(`  CL: M=${mean(bridge.map(s=>s.cognitiveLoad)).toFixed(2)}, SD=${sd(bridge.map(s=>s.cognitiveLoad)).toFixed(2)}`)
  console.log(`  PU: M=${mean(bridge.map(s=>s.usability)).toFixed(2)}, SD=${sd(bridge.map(s=>s.usability)).toFixed(2)}`)
  console.log(`  CI: M=${mean(bridge.map(s=>s.continuance)).toFixed(2)}, SD=${sd(bridge.map(s=>s.continuance)).toFixed(2)}`)
  console.log(`  MC: M=${mean(bridge.map(s=>s.manipCheck)).toFixed(2)}, SD=${sd(bridge.map(s=>s.manipCheck)).toFixed(2)}`)

  // Demographics summary
  console.log('\n=== DEMOGRAPHICS ===')
  const demComplete = rows.filter((r) => {
    const responses = getSurveyResponses(r.payload)
    return (
      (r.event_name === 'survey.completed' || r.event_name === 'questionnaire.completed') &&
      typeof responses?.DEM1 === 'string'
    )
  })
  console.log(`Demographics responses: ${demComplete.length}`)

  const ages: Record<string, number> = {}
  const genders: Record<string, number> = {}
  const famFreqs: Record<string, number> = {}

  for (const d of demComplete) {
    const resp = getSurveyResponses(d.payload)
    if (!resp?.DEM1 || !resp.DEM2 || !resp.FAM1) {
      continue
    }

    ages[resp.DEM1] = (ages[resp.DEM1] || 0) + 1
    genders[resp.DEM2] = (genders[resp.DEM2] || 0) + 1
    famFreqs[resp.FAM1] = (famFreqs[resp.FAM1] || 0) + 1
  }
  console.log('Age distribution:', ages)
  console.log('Gender distribution:', genders)
  console.log('App familiarity:', famFreqs)
}

main()
