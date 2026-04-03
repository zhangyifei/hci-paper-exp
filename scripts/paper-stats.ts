/**
 * paper-stats.ts
 * Extract key behavioral metrics from experiment_events for the paper.
 * 
 * Usage: npx tsx scripts/paper-stats.ts
 */
import { fetchAllEventRows, type ExperimentEventRow } from './lib/supabase-admin'

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function sd(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1))
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function main() {
  const allRows = await fetchAllEventRows()
  console.log(`Total rows in DB: ${allRows.length}`)
  console.log('')

  // Group by session
  const bySession = new Map<string, ExperimentEventRow[]>()
  for (const row of allRows) {
    if (!bySession.has(row.session_id)) bySession.set(row.session_id, [])
    bySession.get(row.session_id)!.push(row)
  }

  // Identify unique event names
  const eventNames = new Set(allRows.map(r => r.event_name))
  console.log('=== All event names ===')
  for (const name of [...eventNames].sort()) {
    console.log(`  ${name}`)
  }
  console.log('')

  // Count sessions per condition
  const sessionConditions = new Map<string, string>()
  for (const [sid, events] of bySession) {
    sessionConditions.set(sid, events[0].condition)
  }

  console.log(`Total unique sessions: ${bySession.size}`)
  const condCounts: Record<string, number> = {}
  for (const [, cond] of sessionConditions) {
    condCounts[cond] = (condCounts[cond] || 0) + 1
  }
  console.log('Sessions per condition:', condCounts)
  console.log('')

  // Identify completed sessions (experiment.completed or last state = finished)
  const completedSessions = new Map<string, ExperimentEventRow[]>()
  for (const [sid, events] of bySession) {
    const hasCompleted = events.some(
      e => e.event_name === 'experiment.completed' || e.state === 'finished'
    )
    if (hasCompleted) {
      completedSessions.set(sid, events)
    }
  }

  const completedCondCounts: Record<string, number> = {}
  for (const [sid] of completedSessions) {
    const cond = sessionConditions.get(sid)!
    completedCondCounts[cond] = (completedCondCounts[cond] || 0) + 1
  }
  console.log(`Completed sessions: ${completedSessions.size}`)
  console.log('Completed per condition:', completedCondCounts)
  console.log('')

  // Identify BOT sessions vs real sessions
  let botSessions = 0
  let realSessions = 0
  const botSessionIds = new Set<string>()
  for (const [sid, events] of bySession) {
    const isBot = events.some(e =>
      e.prolific_study_id?.includes('BOT') ||
      e.prolific_session_id?.includes('BOT') ||
      e.participant_id?.includes('BOT')
    )
    if (isBot) {
      botSessions++
      botSessionIds.add(sid)
    } else {
      realSessions++
    }
  }
  console.log(`Bot sessions: ${botSessions}, Real sessions: ${realSessions}`)
  console.log('')

  // ======== KEY METRIC: Navigation Lag ========
  // Time from trip_complete.viewed to service2.entry
  console.log('=== NAVIGATION LAG (trip_complete.viewed -> service2.entry) ===')

  interface SessionMetrics {
    sessionId: string
    condition: string
    navLagMs: number | null
    service2DurationMs: number | null
    bannerUsed: boolean | null
    isBot: boolean
    participantId: string
  }

  const metrics: SessionMetrics[] = []

  for (const [sid, events] of bySession) {
    const sortedEvents = events.sort((a, b) => a.sequence_id - b.sequence_id)
    const condition = sessionConditions.get(sid)!
    const isBot = botSessionIds.has(sid)
    const pid = events[0].participant_id

    // Navigation lag: trip_complete.viewed timestamp -> service2.entry timestamp
    const tripCompleteViewed = sortedEvents.find(e => e.event_name === 'trip_complete.viewed')
    const service2Entry = sortedEvents.find(e => e.event_name === 'service2.entry')

    let navLagMs: number | null = null
    if (tripCompleteViewed && service2Entry) {
      navLagMs = service2Entry.timestamp - tripCompleteViewed.timestamp
    }

    // Service 2 task duration - look for service2.task.complete with duration_ms
    const s2TaskComplete = sortedEvents.find(e => e.event_name === 'service2.task.complete')
    let service2DurationMs: number | null = null
    if (s2TaskComplete && s2TaskComplete.duration_ms) {
      service2DurationMs = s2TaskComplete.duration_ms
    }

    // Banner usage 
    const bannerClick = sortedEvents.find((e) => e.event_name === 'trip_complete.banner_tapped')
    let bannerUsed: boolean | null = null
    if (condition === 'G2' || condition === 'G4') {
      bannerUsed = !!bannerClick
    }

    metrics.push({ sessionId: sid, condition, navLagMs, service2DurationMs, bannerUsed, isBot, participantId: pid })
  }

  // Separate bot and real metrics
  console.log('\n--- ALL Sessions (including bots) ---')
  for (const cond of ['G1', 'G2', 'G3', 'G4']) {
    const condMetrics = metrics.filter(m => m.condition === cond)
    const completed = condMetrics.filter(m => {
      const evts = bySession.get(m.sessionId)!
      return evts.some(e => e.event_name === 'experiment.completed' || e.state === 'finished')
    })
    const navLags = completed.filter(m => m.navLagMs !== null && m.navLagMs > 0).map(m => m.navLagMs! / 1000)
    const s2Durs = completed.filter(m => m.service2DurationMs !== null && m.service2DurationMs > 0).map(m => m.service2DurationMs! / 1000)

    console.log(`\n${cond}: ${condMetrics.length} total, ${completed.length} completed`)
    if (navLags.length > 0) {
      console.log(`  Nav lag (s): M=${mean(navLags).toFixed(1)}, SD=${sd(navLags).toFixed(1)}, Mdn=${median(navLags).toFixed(1)}, range=[${Math.min(...navLags).toFixed(1)}, ${Math.max(...navLags).toFixed(1)}], n=${navLags.length}`)
      console.log(`  Individual nav lags: ${navLags.map(v => v.toFixed(1)).join(', ')}`)
    } else {
      console.log(`  Nav lag: no data`)
    }
    if (s2Durs.length > 0) {
      console.log(`  S2 task dur (s): M=${mean(s2Durs).toFixed(1)}, SD=${sd(s2Durs).toFixed(1)}, Mdn=${median(s2Durs).toFixed(1)}, range=[${Math.min(...s2Durs).toFixed(1)}, ${Math.max(...s2Durs).toFixed(1)}], n=${s2Durs.length}`)
      console.log(`  Individual s2 durs: ${s2Durs.map(v => v.toFixed(1)).join(', ')}`)
    } else {
      console.log(`  S2 task dur: no data`)
    }
    // Banner uptake for G2/G4
    if (cond === 'G2' || cond === 'G4') {
      const bannerUsers = completed.filter(m => m.bannerUsed === true).length
      const bannerTotal = completed.filter(m => m.bannerUsed !== null).length
      console.log(`  Banner uptake: ${bannerUsers}/${bannerTotal}`)
    }
  }

  // Now separate REAL (non-bot) sessions
  console.log('\n\n--- REAL (non-bot) Sessions Only ---')
  for (const cond of ['G1', 'G2', 'G3', 'G4']) {
    const condMetrics = metrics.filter(m => m.condition === cond && !m.isBot)
    const completed = condMetrics.filter(m => {
      const evts = bySession.get(m.sessionId)!
      return evts.some(e => e.event_name === 'experiment.completed' || e.state === 'finished')
    })
    const navLags = completed.filter(m => m.navLagMs !== null && m.navLagMs > 0).map(m => m.navLagMs! / 1000)
    const s2Durs = completed.filter(m => m.service2DurationMs !== null && m.service2DurationMs > 0).map(m => m.service2DurationMs! / 1000)

    console.log(`\n${cond}: ${condMetrics.length} total, ${completed.length} completed`)
    if (navLags.length > 0) {
      console.log(`  Nav lag (s): M=${mean(navLags).toFixed(1)}, SD=${sd(navLags).toFixed(1)}, Mdn=${median(navLags).toFixed(1)}, range=[${Math.min(...navLags).toFixed(1)}, ${Math.max(...navLags).toFixed(1)}], n=${navLags.length}`)
      console.log(`  Individual nav lags: ${navLags.map(v => v.toFixed(1)).join(', ')}`)
    } else {
      console.log(`  Nav lag: no data`)
    }
    if (s2Durs.length > 0) {
      console.log(`  S2 task dur (s): M=${mean(s2Durs).toFixed(1)}, SD=${sd(s2Durs).toFixed(1)}, Mdn=${median(s2Durs).toFixed(1)}, range=[${Math.min(...s2Durs).toFixed(1)}, ${Math.max(...s2Durs).toFixed(1)}], n=${s2Durs.length}`)
      console.log(`  Individual s2 durs: ${s2Durs.map(v => v.toFixed(1)).join(', ')}`)
    } else {
      console.log(`  S2 task dur: no data`)
    }
    if (cond === 'G2' || cond === 'G4') {
      const bannerUsers = completed.filter(m => m.bannerUsed === true).length
      const bannerTotal = completed.filter(m => m.bannerUsed !== null).length
      console.log(`  Banner uptake: ${bannerUsers}/${bannerTotal}`)
    }
  }

  // BOT Sessions for reference
  console.log('\n\n--- BOT Sessions Only ---')
  for (const cond of ['G1', 'G2', 'G3', 'G4']) {
    const condMetrics = metrics.filter(m => m.condition === cond && m.isBot)
    const completed = condMetrics.filter(m => {
      const evts = bySession.get(m.sessionId)!
      return evts.some(e => e.event_name === 'experiment.completed' || e.state === 'finished')
    })
    const navLags = completed.filter(m => m.navLagMs !== null && m.navLagMs > 0).map(m => m.navLagMs! / 1000)
    const s2Durs = completed.filter(m => m.service2DurationMs !== null && m.service2DurationMs > 0).map(m => m.service2DurationMs! / 1000)

    console.log(`\n${cond}: ${condMetrics.length} total, ${completed.length} completed`)
    if (navLags.length > 0) {
      console.log(`  Nav lag (s): M=${mean(navLags).toFixed(1)}, SD=${sd(navLags).toFixed(1)}, Mdn=${median(navLags).toFixed(1)}, n=${navLags.length}`)
    }
    if (s2Durs.length > 0) {
      console.log(`  S2 task dur (s): M=${mean(s2Durs).toFixed(1)}, SD=${sd(s2Durs).toFixed(1)}, Mdn=${median(s2Durs).toFixed(1)}, n=${s2Durs.length}`)
    }
    if (cond === 'G2' || cond === 'G4') {
      const bannerUsers = completed.filter(m => m.bannerUsed === true).length
      const bannerTotal = completed.filter(m => m.bannerUsed !== null).length
      console.log(`  Banner uptake: ${bannerUsers}/${bannerTotal}`)
    }
  }

  // Overall summary
  console.log('\n\n=== SUMMARY FOR PAPER ===')
  const allNonBot = metrics.filter(m => !m.isBot)
  const allNonBotCompleted = allNonBot.filter(m => {
    const evts = bySession.get(m.sessionId)!
    return evts.some(e => e.event_name === 'experiment.completed' || e.state === 'finished')
  })
  console.log(`Total non-bot sessions: ${allNonBot.length}`)
  console.log(`Completed non-bot sessions: ${allNonBotCompleted.length}`)
  
  const completionRate = allNonBot.length > 0
    ? (allNonBotCompleted.length / allNonBot.length) * 100
    : 0
  console.log(`Completion rate: ${completionRate.toFixed(1)}%`)

  // Per-condition summary table
  console.log('\nCondition | n_total | n_completed | Nav_Lag_M | Nav_Lag_SD | S2_Dur_M | S2_Dur_SD')
  for (const cond of ['G1', 'G2', 'G3', 'G4']) {
    const condMetrics = metrics.filter(m => m.condition === cond && !m.isBot)
    const completed = condMetrics.filter(m => {
      const evts = bySession.get(m.sessionId)!
      return evts.some(e => e.event_name === 'experiment.completed' || e.state === 'finished')
    })
    const navLags = completed.filter(m => m.navLagMs !== null && m.navLagMs > 0).map(m => m.navLagMs! / 1000)
    const s2Durs = completed.filter(m => m.service2DurationMs !== null && m.service2DurationMs > 0).map(m => m.service2DurationMs! / 1000)

    const navM = navLags.length > 0 ? mean(navLags).toFixed(1) : 'N/A'
    const navSD = navLags.length > 1 ? sd(navLags).toFixed(1) : 'N/A'
    const s2M = s2Durs.length > 0 ? mean(s2Durs).toFixed(1) : 'N/A'
    const s2SD = s2Durs.length > 1 ? sd(s2Durs).toFixed(1) : 'N/A'

    console.log(`${cond} | ${condMetrics.length} | ${completed.length} | ${navM} | ${navSD} | ${s2M} | ${s2SD}`)
  }

  // Check for banner-related events
  console.log('\n=== Banner-related events ===')
  const bannerEvents = allRows.filter(r => r.event_name.includes('banner') || r.event_name.includes('cta'))
  const bannerEventNames = new Set(bannerEvents.map(r => r.event_name))
  console.log('Banner event types:', [...bannerEventNames])
  console.log('Total banner events:', bannerEvents.length)

  // Also check for any service2-related events to understand navigation patterns
  console.log('\n=== Service2 navigation events ===')
  const s2Events = allRows.filter(r => r.flow === 'service2' || r.event_name.includes('service2'))
  const s2EventNames = new Set(s2Events.map(r => r.event_name))
  console.log('Service2 event types:', [...s2EventNames].sort())
}

main()
