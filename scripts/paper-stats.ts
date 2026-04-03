/**
 * paper-stats.ts
 * Extract key behavioral metrics from experiment_events for the paper.
 *
 * Usage: npx tsx scripts/paper-stats.ts
 */
import {
  CONDITIONS,
  computePaperStats,
  mean,
  median,
  sd,
  type ConditionStats,
  type NumericSummary,
  type SessionDetail,
} from '../lib/paper-stats/analysis'
import { fetchAllEventRows } from './lib/supabase-admin'

function formatSummary(summary: NumericSummary | null): string {
  if (!summary) {
    return 'no data'
  }

  return `M=${summary.mean.toFixed(1)}, SD=${summary.sd.toFixed(1)}, Mdn=${summary.median.toFixed(
    1,
  )}, range=[${summary.min.toFixed(1)}, ${summary.max.toFixed(1)}], n=${summary.n}`
}

function buildSummary(values: number[]): NumericSummary | null {
  if (values.length === 0) {
    return null
  }

  return {
    mean: mean(values),
    sd: sd(values),
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    n: values.length,
    values,
  }
}

function printConditionBlock(
  condition: string,
  stats: ConditionStats,
  navSummary: NumericSummary | null,
  durationSummary: NumericSummary | null,
) {
  console.log(`\n${condition}: ${stats.total} total, ${stats.completed} completed`)
  console.log(`  Nav lag (s): ${formatSummary(navSummary)}`)
  if (navSummary) {
    console.log(
      `  Individual nav lags: ${navSummary.values.map((value) => value.toFixed(1)).join(', ')}`,
    )
  }

  console.log(`  S2 task dur (s): ${formatSummary(durationSummary)}`)
  if (durationSummary) {
    console.log(
      `  Individual s2 durs: ${durationSummary.values
        .map((value) => value.toFixed(1))
        .join(', ')}`,
    )
  }

  if (stats.bannerUptake) {
    console.log(`  Banner uptake: ${stats.bannerUptake.used}/${stats.bannerUptake.total}`)
  }
}

function summarizeSessions(
  sessions: SessionDetail[],
  condition: string,
): {
  total: number
  completed: number
  navSummary: NumericSummary | null
  durationSummary: NumericSummary | null
  bannerUsed: number
  bannerTotal: number
} {
  const conditionSessions = sessions.filter((session) => session.condition === condition)
  const completed = conditionSessions.filter((session) => session.completed)
  const navSummary = buildSummary(
    completed
      .filter((session) => session.navLagS !== null && session.navLagS > 0)
      .map((session) => session.navLagS!),
  )
  const durationSummary = buildSummary(
    completed
      .filter((session) => session.s2DurS !== null && session.s2DurS > 0)
      .map((session) => session.s2DurS!),
  )

  return {
    total: conditionSessions.length,
    completed: completed.length,
    navSummary,
    durationSummary,
    bannerUsed: completed.filter((session) => session.bannerTapped).length,
    bannerTotal: completed.length,
  }
}

async function main() {
  const allRows = await fetchAllEventRows()
  const stats = computePaperStats(allRows)
  console.log(`Total rows in DB: ${allRows.length}`)
  console.log('')

  // Identify unique event names
  console.log('=== All event names ===')
  for (const name of Object.keys(stats.eventNameCounts).sort()) {
    console.log(`  ${name}`)
  }
  console.log('')

  console.log(`Total unique sessions: ${stats.sessionDetail.length}`)
  const sessionCounts = Object.fromEntries(
    CONDITIONS.map((condition) => [
      condition,
      stats.sessionDetail.filter((session) => session.condition === condition).length,
    ]),
  )
  console.log('Sessions per condition:', sessionCounts)
  console.log('')

  const completedCounts = Object.fromEntries(
    CONDITIONS.map((condition) => [
      condition,
      stats.sessionDetail.filter(
        (session) => session.condition === condition && session.completed,
      ).length,
    ]),
  )
  console.log(
    `Completed sessions: ${stats.sessionDetail.filter((session) => session.completed).length}`,
  )
  console.log('Completed per condition:', completedCounts)
  console.log('')

  console.log(
    `Bot sessions: ${stats.overview.botSessions}, Real sessions: ${stats.overview.realSessions}`,
  )
  console.log('')

  console.log('=== NAVIGATION LAG (trip_complete.viewed -> service2.entry) ===')

  console.log('\n--- ALL Sessions (including bots) ---')
  for (const condition of CONDITIONS) {
    const summary = summarizeSessions(stats.sessionDetail, condition)
    printConditionBlock(
      condition,
      {
        total: summary.total,
        completed: summary.completed,
        completionRate: summary.total > 0 ? (summary.completed / summary.total) * 100 : 0,
        navLag: summary.navSummary,
        s2Dur: summary.durationSummary,
        bannerUptake:
          condition === 'G2' || condition === 'G4'
            ? { used: summary.bannerUsed, total: summary.bannerTotal }
            : null,
      },
      summary.navSummary,
      summary.durationSummary,
    )
  }

  // Now separate REAL (non-bot) sessions
  console.log('\n\n--- REAL (non-bot) Sessions Only ---')
  for (const condition of CONDITIONS) {
    printConditionBlock(
      condition,
      stats.conditionStats[condition],
      stats.conditionStats[condition].navLag,
      stats.conditionStats[condition].s2Dur,
    )
  }

  // BOT Sessions for reference
  console.log('\n\n--- BOT Sessions Only ---')
  const botSessions = stats.sessionDetail.filter((session) => session.isBot)
  for (const condition of CONDITIONS) {
    const summary = summarizeSessions(botSessions, condition)
    console.log(`\n${condition}: ${summary.total} total, ${summary.completed} completed`)
    if (summary.navSummary) {
      console.log(
        `  Nav lag (s): M=${summary.navSummary.mean.toFixed(1)}, SD=${summary.navSummary.sd.toFixed(
          1,
        )}, Mdn=${summary.navSummary.median.toFixed(1)}, n=${summary.navSummary.n}`,
      )
    }
    if (summary.durationSummary) {
      console.log(
        `  S2 task dur (s): M=${summary.durationSummary.mean.toFixed(
          1,
        )}, SD=${summary.durationSummary.sd.toFixed(1)}, Mdn=${summary.durationSummary.median.toFixed(
          1,
        )}, n=${summary.durationSummary.n}`,
      )
    }
    if (condition === 'G2' || condition === 'G4') {
      console.log(`  Banner uptake: ${summary.bannerUsed}/${summary.bannerTotal}`)
    }
  }

  // Overall summary
  console.log('\n\n=== SUMMARY FOR PAPER ===')
  console.log(`Total non-bot sessions: ${stats.overview.realSessions}`)
  console.log(`Completed non-bot sessions: ${stats.overview.completedRealSessions}`)
  console.log(`Completion rate: ${stats.overview.completionRate.toFixed(1)}%`)

  // Per-condition summary table
  console.log('\nCondition | n_total | n_completed | Nav_Lag_M | Nav_Lag_SD | S2_Dur_M | S2_Dur_SD')
  for (const condition of CONDITIONS) {
    const conditionStats = stats.conditionStats[condition]
    console.log(
      `${condition} | ${conditionStats.total} | ${conditionStats.completed} | ${
        conditionStats.navLag?.mean.toFixed(1) ?? 'N/A'
      } | ${conditionStats.navLag?.sd.toFixed(1) ?? 'N/A'} | ${
        conditionStats.s2Dur?.mean.toFixed(1) ?? 'N/A'
      } | ${conditionStats.s2Dur?.sd.toFixed(1) ?? 'N/A'}`,
    )
  }

  // Check for banner-related events
  console.log('\n=== Banner-related events ===')
  const bannerEvents = allRows.filter(
    (row) => row.event_name.includes('banner') || row.event_name.includes('cta'),
  )
  const bannerEventNames = new Set(bannerEvents.map((row) => row.event_name))
  console.log('Banner event types:', [...bannerEventNames])
  console.log('Total banner events:', bannerEvents.length)

  // Also check for any service2-related events to understand navigation patterns
  console.log('\n=== Service2 navigation events ===')
  const s2Events = allRows.filter(
    (row) => row.flow === 'service2' || row.event_name.includes('service2'),
  )
  const s2EventNames = new Set(s2Events.map((row) => row.event_name))
  console.log('Service2 event types:', [...s2EventNames].sort())
}

main()
