/**
 * paper-stats-survey.ts
 * Extract survey aggregate statistics per condition for the paper.
 */
import {
  CONDITIONS,
  computePaperStats,
  getSurveyAggregates,
  getSurveyResponses,
} from '../lib/paper-stats/analysis'
import { fetchAllEventRows } from './lib/supabase-admin'

function formatMeanSd(mean: number | null, sd: number | null): string {
  if (mean == null || sd == null) {
    return 'M=—, SD=—'
  }

  return `M=${mean.toFixed(2)}, SD=${sd.toFixed(2)}`
}

async function main() {
  const rows = await fetchAllEventRows()
  const stats = computePaperStats(rows)

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

  for (const condition of CONDITIONS) {
    const conditionStats = stats.surveyByCondition[condition]
    console.log(`${condition} (n=${conditionStats?.n ?? 0}):`)

    if (conditionStats) {
      console.log(
        `  Cognitive Load:  M=${conditionStats.cognitiveLoad.mean.toFixed(
          2,
        )}, SD=${conditionStats.cognitiveLoad.sd.toFixed(2)} (values: ${conditionStats.cognitiveLoad.values
          .map((value) => value.toFixed(2))
          .join(', ')})`,
      )
      console.log(
        `  Usability:       M=${conditionStats.usability.mean.toFixed(
          2,
        )}, SD=${conditionStats.usability.sd.toFixed(2)} (values: ${conditionStats.usability.values
          .map((value) => value.toFixed(2))
          .join(', ')})`,
      )
      console.log(
        `  Continuance:     M=${conditionStats.continuance.mean.toFixed(
          2,
        )}, SD=${conditionStats.continuance.sd.toFixed(2)} (values: ${conditionStats.continuance.values
          .map((value) => value.toFixed(2))
          .join(', ')})`,
      )
      console.log(
        `  Manip. Check:    M=${conditionStats.manipCheck.mean.toFixed(
          2,
        )}, SD=${conditionStats.manipCheck.sd.toFixed(2)} (values: ${conditionStats.manipCheck.values
          .map((value) => value.toFixed(2))
          .join(', ')})`,
      )
    }
    console.log('')
  }

  // Now aggregate: Low vs High heterogeneity (G1/G2 = Courier = low, G3/G4 = Eats = high)
  console.log('=== HETEROGENEITY COMPARISON ===')
  console.log(
    `Low heterogeneity (${stats.heterogeneityComparison.low.label}, n=${stats.heterogeneityComparison.low.n}):`,
  )
  console.log(
    `  CL: ${formatMeanSd(
      stats.heterogeneityComparison.low.cl.mean,
      stats.heterogeneityComparison.low.cl.sd,
    )}`,
  )
  console.log(
    `  PU: ${formatMeanSd(
      stats.heterogeneityComparison.low.pu.mean,
      stats.heterogeneityComparison.low.pu.sd,
    )}`,
  )
  console.log(
    `  CI: ${formatMeanSd(
      stats.heterogeneityComparison.low.ci.mean,
      stats.heterogeneityComparison.low.ci.sd,
    )}`,
  )
  console.log(
    `High heterogeneity (${stats.heterogeneityComparison.high.label}, n=${stats.heterogeneityComparison.high.n}):`,
  )
  console.log(
    `  CL: ${formatMeanSd(
      stats.heterogeneityComparison.high.cl.mean,
      stats.heterogeneityComparison.high.cl.sd,
    )}`,
  )
  console.log(
    `  PU: ${formatMeanSd(
      stats.heterogeneityComparison.high.pu.mean,
      stats.heterogeneityComparison.high.pu.sd,
    )}`,
  )
  console.log(
    `  CI: ${formatMeanSd(
      stats.heterogeneityComparison.high.ci.mean,
      stats.heterogeneityComparison.high.ci.sd,
    )}`,
  )

  // Low vs High interrelatedness (G1/G3 = no bridge = low, G2/G4 = bridge = high)
  console.log('\n=== INTERRELATEDNESS COMPARISON ===')
  console.log(
    `Low interrelatedness (${stats.interrelatednessComparison.noBridge.label}, n=${stats.interrelatednessComparison.noBridge.n}):`,
  )
  console.log(
    `  CL: ${formatMeanSd(
      stats.interrelatednessComparison.noBridge.cl.mean,
      stats.interrelatednessComparison.noBridge.cl.sd,
    )}`,
  )
  console.log(
    `  PU: ${formatMeanSd(
      stats.interrelatednessComparison.noBridge.pu.mean,
      stats.interrelatednessComparison.noBridge.pu.sd,
    )}`,
  )
  console.log(
    `  CI: ${formatMeanSd(
      stats.interrelatednessComparison.noBridge.ci.mean,
      stats.interrelatednessComparison.noBridge.ci.sd,
    )}`,
  )
  console.log(
    `  MC: ${formatMeanSd(
      stats.interrelatednessComparison.noBridge.mc?.mean ?? null,
      stats.interrelatednessComparison.noBridge.mc?.sd ?? null,
    )}`,
  )
  console.log(
    `High interrelatedness (${stats.interrelatednessComparison.bridge.label}, n=${stats.interrelatednessComparison.bridge.n}):`,
  )
  console.log(
    `  CL: ${formatMeanSd(
      stats.interrelatednessComparison.bridge.cl.mean,
      stats.interrelatednessComparison.bridge.cl.sd,
    )}`,
  )
  console.log(
    `  PU: ${formatMeanSd(
      stats.interrelatednessComparison.bridge.pu.mean,
      stats.interrelatednessComparison.bridge.pu.sd,
    )}`,
  )
  console.log(
    `  CI: ${formatMeanSd(
      stats.interrelatednessComparison.bridge.ci.mean,
      stats.interrelatednessComparison.bridge.ci.sd,
    )}`,
  )
  console.log(
    `  MC: ${formatMeanSd(
      stats.interrelatednessComparison.bridge.mc?.mean ?? null,
      stats.interrelatednessComparison.bridge.mc?.sd ?? null,
    )}`,
  )

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

  console.log('Age distribution:', stats.demographics.ages)
  console.log('Gender distribution:', stats.demographics.genders)
  console.log('App familiarity:', stats.demographics.famFreqs)
}

main()
