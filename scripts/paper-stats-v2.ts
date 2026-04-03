/**
 * paper-stats-v2.ts
 * Refined stats script with correct banner event name and more detail.
 */
import {
  CONDITIONS,
  computePaperStats,
  getSurveyAggregates,
  groupEventsBySession,
} from '../lib/paper-stats/analysis'
import { fetchAllEventRows } from './lib/supabase-admin'

async function main() {
  const rows = await fetchAllEventRows()
  const stats = computePaperStats(rows)
  const bySession = groupEventsBySession(rows)
  console.log(`Total DB rows: ${rows.length}\n`)

  console.log('=== PER-SESSION DETAIL ===')
  for (const session of stats.sessionDetail) {
    console.log(
      `  ${session.condition} | pid=${session.participantId.substring(0, 8)}... | navLag=${
        session.navLagS?.toFixed(1) ?? 'N/A'
      }s | s2dur=${session.s2DurS?.toFixed(1) ?? 'N/A'}s | banner=${
        session.bannerTapped ? 'YES' : 'no'
      } | completed=${session.completed} | events=${session.eventCount}`,
    )
  }

  // Banner tapped breakdown
  console.log('\n=== BANNER TAP DETAIL ===')
  const bannerRows = rows.filter((row) => row.event_name === 'trip_complete.banner_tapped')
  console.log(`Total banner_tapped events: ${bannerRows.length}`)
  for (const b of bannerRows) {
    console.log(
      `  session=${b.session_id.substring(0, 8)}, condition=${b.condition}, pid=${b.participant_id.substring(0, 8)}`,
    )
  }

  // Check how many unique sessions tapped banner per condition
  const bannerSessions = new Set(bannerRows.map((row) => row.session_id))
  console.log(`Unique sessions that tapped banner: ${bannerSessions.size}`)
  for (const condition of CONDITIONS) {
    const conditionBanner = bannerRows.filter((row) => row.condition === condition)
    const conditionBannerSessions = new Set(
      conditionBanner.map((row) => row.session_id),
    )
    console.log(`  ${condition}: ${conditionBannerSessions.size} sessions tapped banner`)
  }

  console.log('\n=== CORRECTED SUMMARY TABLE (real sessions only) ===')
  console.log('Condition | n | Nav_Lag_M(s) | Nav_Lag_SD | S2_Dur_M(s) | S2_Dur_SD | Banner_Used')
  for (const condition of CONDITIONS) {
    const conditionStats = stats.conditionStats[condition]
    const bannerSummary = conditionStats.bannerUptake
      ? `${conditionStats.bannerUptake.used}/${conditionStats.bannerUptake.total}`
      : 'N/A'
    console.log(
      `${condition} | ${conditionStats.total} | ${
        conditionStats.navLag?.mean.toFixed(1) ?? 'N/A'
      } | ${conditionStats.navLag?.sd.toFixed(1) ?? 'N/A'} | ${
        conditionStats.s2Dur?.mean.toFixed(1) ?? 'N/A'
      } | ${conditionStats.s2Dur?.sd.toFixed(1) ?? 'N/A'} | ${bannerSummary}`,
    )
  }

  // Look at questionnaire/survey data
  console.log('\n=== QUESTIONNAIRE/SURVEY DATA ===')
  const surveyEvents = rows.filter(
    (row) => row.event_name.includes('questionnaire') || row.event_name.includes('survey'),
  )
  console.log(`Total questionnaire/survey events: ${surveyEvents.length}`)

  const surveyEventNames = new Set(surveyEvents.map((row) => row.event_name))
  console.log('Event types:', [...surveyEventNames])

  // Check for item_answered payloads
  const itemAnswered = surveyEvents.filter(
    (row) =>
      row.event_name === 'questionnaire.item_answered' ||
      row.event_name === 'survey.item_answered',
  )
  console.log(`\nItem answered events: ${itemAnswered.length}`)
  if (itemAnswered.length > 0) {
    console.log('Sample payloads:')
    for (const item of itemAnswered.slice(0, 10)) {
      console.log(
        `  ${item.condition} | pid=${item.participant_id.substring(0, 8)} | ${JSON.stringify(item.payload)}`,
      )
    }
  }

  // Check questionnaire.completed payloads
  const completedSurveys = surveyEvents.filter(
    (row) =>
      (row.event_name === 'questionnaire.completed' || row.event_name === 'survey.completed') &&
      getSurveyAggregates(row.payload) !== null,
  )
  console.log(`\nQuestionnaire/survey completed events: ${completedSurveys.length}`)
  for (const survey of completedSurveys) {
    console.log(
      `  ${survey.condition} | pid=${survey.participant_id.substring(0, 8)} | duration_ms=${
        survey.duration_ms
      } | payload=${JSON.stringify(survey.payload)}`,
    )
  }

  console.log('\n=== SESSION EVENT COUNTS ===')
  for (const [sessionId, events] of bySession) {
    console.log(`  ${sessionId.substring(0, 8)}... | count=${events.length}`)
  }
}

main()
