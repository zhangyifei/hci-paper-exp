/**
 * paper-stats-v2.ts
 * Refined stats script with correct banner event name and more detail.
 */
import { fetchAllEventRows } from './lib/supabase-admin'

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
  const rows = await fetchAllEventRows()
  console.log(`Total DB rows: ${rows.length}\n`)

  // Group by session
  const bySession = new Map<string, any[]>()
  for (const r of rows) {
    if (!bySession.has(r.session_id)) bySession.set(r.session_id, [])
    bySession.get(r.session_id)!.push(r)
  }

  console.log('=== PER-SESSION DETAIL ===')
  for (const [sid, events] of bySession) {
    const sorted = events.sort((a: any, b: any) => a.sequence_id - b.sequence_id)
    const cond = sorted[0].condition
    const pid = sorted[0].participant_id

    const tripComplete = sorted.find((e: any) => e.event_name === 'trip_complete.viewed')
    const s2Entry = sorted.find((e: any) => e.event_name === 'service2.entry')
    const s2TaskComplete = sorted.find((e: any) => e.event_name === 'service2.task.complete')
    const bannerTap = sorted.find((e: any) => e.event_name === 'trip_complete.banner_tapped')
    const expCompleted = sorted.find((e: any) => e.event_name === 'experiment.completed')

    const navLag = tripComplete && s2Entry ? (s2Entry.timestamp - tripComplete.timestamp) / 1000 : null
    const s2Dur = s2TaskComplete?.duration_ms ? s2TaskComplete.duration_ms / 1000 : null
    const completed = !!expCompleted

    console.log(`  ${cond} | pid=${pid.substring(0,8)}... | navLag=${navLag?.toFixed(1) ?? 'N/A'}s | s2dur=${s2Dur?.toFixed(1) ?? 'N/A'}s | banner=${bannerTap ? 'YES' : 'no'} | completed=${completed} | events=${sorted.length}`)
  }

  // Banner tapped breakdown
  console.log('\n=== BANNER TAP DETAIL ===')
  const bannerRows = rows.filter((r: any) => r.event_name === 'trip_complete.banner_tapped')
  console.log(`Total banner_tapped events: ${bannerRows.length}`)
  for (const b of bannerRows) {
    console.log(`  session=${b.session_id.substring(0,8)}, condition=${b.condition}, pid=${b.participant_id.substring(0,8)}`)
  }

  // Check how many unique sessions tapped banner per condition
  const bannerSessions = new Set(bannerRows.map((r: any) => r.session_id))
  console.log(`Unique sessions that tapped banner: ${bannerSessions.size}`)
  for (const cond of ['G1','G2','G3','G4']) {
    const condBanner = bannerRows.filter((r: any) => r.condition === cond)
    const condBannerSessions = new Set(condBanner.map((r: any) => r.session_id))
    console.log(`  ${cond}: ${condBannerSessions.size} sessions tapped banner`)
  }

  // Now compute the actual summary with correct banner detection
  console.log('\n=== CORRECTED SUMMARY TABLE ===')
  console.log('Condition | n | Nav_Lag_M(s) | Nav_Lag_SD | S2_Dur_M(s) | S2_Dur_SD | Banner_Used')
  for (const cond of ['G1','G2','G3','G4']) {
    const condSessions = [...bySession.entries()].filter(([_sid, evts]) => evts[0].condition === cond)
    const n = condSessions.length

    const navLags: number[] = []
    const s2Durs: number[] = []
    let bannerUsed = 0
    let bannerTotal = 0

    for (const [sid, events] of condSessions) {
      const sorted = events.sort((a: any, b: any) => a.sequence_id - b.sequence_id)
      const tc = sorted.find((e: any) => e.event_name === 'trip_complete.viewed')
      const s2e = sorted.find((e: any) => e.event_name === 'service2.entry')
      const s2tc = sorted.find((e: any) => e.event_name === 'service2.task.complete')
      const bt = sorted.find((e: any) => e.event_name === 'trip_complete.banner_tapped')

      if (tc && s2e) {
        navLags.push((s2e.timestamp - tc.timestamp) / 1000)
      }
      if (s2tc?.duration_ms) {
        s2Durs.push(s2tc.duration_ms / 1000)
      }
      if (cond === 'G2' || cond === 'G4') {
        bannerTotal++
        if (bt) bannerUsed++
      }
    }

    const navM = navLags.length > 0 ? mean(navLags).toFixed(1) : 'N/A'
    const navS = navLags.length > 1 ? sd(navLags).toFixed(1) : 'N/A'
    const s2M = s2Durs.length > 0 ? mean(s2Durs).toFixed(1) : 'N/A'
    const s2S = s2Durs.length > 1 ? sd(s2Durs).toFixed(1) : 'N/A'
    const bannerStr = (cond === 'G2' || cond === 'G4') ? `${bannerUsed}/${bannerTotal}` : 'N/A'

    console.log(`${cond} | ${n} | ${navM} | ${navS} | ${s2M} | ${s2S} | ${bannerStr}`)
  }

  // Look at questionnaire/survey data
  console.log('\n=== QUESTIONNAIRE/SURVEY DATA ===')
  const surveyEvents = rows.filter((r: any) =>
    r.event_name.includes('questionnaire') || r.event_name.includes('survey')
  )
  console.log(`Total questionnaire/survey events: ${surveyEvents.length}`)

  const surveyEventNames = new Set(surveyEvents.map((r: any) => r.event_name))
  console.log('Event types:', [...surveyEventNames])

  // Check for item_answered payloads
  const itemAnswered = surveyEvents.filter((r: any) =>
    r.event_name === 'questionnaire.item_answered' || r.event_name === 'survey.item_answered'
  )
  console.log(`\nItem answered events: ${itemAnswered.length}`)
  if (itemAnswered.length > 0) {
    console.log('Sample payloads:')
    for (const item of itemAnswered.slice(0, 10)) {
      console.log(`  ${item.condition} | pid=${item.participant_id.substring(0,8)} | ${JSON.stringify(item.payload)}`)
    }
  }

  // Check questionnaire.completed payloads
  const qCompleted = surveyEvents.filter((r: any) =>
    r.event_name === 'questionnaire.completed' || r.event_name === 'survey.completed'
  )
  console.log(`\nQuestionnaire/survey completed events: ${qCompleted.length}`)
  for (const q of qCompleted) {
    console.log(`  ${q.condition} | pid=${q.participant_id.substring(0,8)} | duration_ms=${q.duration_ms} | payload=${JSON.stringify(q.payload)}`)
  }
}

main()
