/**
 * clean-test-data.ts
 * Delete ALL collected experiment data from Supabase so a fresh (real-user)
 * data collection can begin.
 *
 * This truncates the `experiment_events` table (the single source of truth —
 * survey, questionnaire, behavioral and timing data all live here) and refreshes
 * the `screen_metrics` materialized view. The `participant_responses` view is a
 * plain view and updates automatically.
 *
 * Usage:
 *   npx tsx scripts/clean-test-data.ts            # dry run: report counts only
 *   npx tsx scripts/clean-test-data.ts --confirm  # actually delete everything
 */
import { supabase } from './lib/supabase-admin'

async function countRows(): Promise<number> {
  const { count, error } = await supabase
    .from('experiment_events')
    .select('*', { count: 'exact', head: true })

  if (error) {
    throw new Error(`Count failed: ${error.message}`)
  }

  return count ?? 0
}

async function countSessions(): Promise<number> {
  const { data, error } = await supabase
    .from('experiment_events')
    .select('session_id')

  if (error) {
    throw new Error(`Session query failed: ${error.message}`)
  }

  return new Set((data ?? []).map((row) => row.session_id)).size
}

async function main() {
  const confirmed = process.argv.includes('--confirm')

  const beforeRows = await countRows()
  const beforeSessions = await countSessions()

  console.log('Current experiment data:')
  console.log(`  events:   ${beforeRows}`)
  console.log(`  sessions: ${beforeSessions}`)

  if (beforeRows === 0) {
    console.log('\nDatabase is already empty. Nothing to clean up.')
    return
  }

  if (!confirmed) {
    console.log('\nDRY RUN — no data deleted.')
    console.log('Re-run with --confirm to permanently delete all rows above.')
    return
  }

  console.log('\nDeleting all rows from experiment_events ...')
  const { error: deleteError } = await supabase
    .from('experiment_events')
    .delete()
    .gte('id', 0)

  if (deleteError) {
    throw new Error(`Delete failed: ${deleteError.message}`)
  }

  const afterRows = await countRows()
  console.log(`\nDone. events remaining: ${afterRows}`)
  if (afterRows === 0) {
    console.log('All test data cleared. Ready for real users.')
  }

  // `participant_responses` is a plain view and updates automatically.
  // `screen_metrics` is a MATERIALIZED view — refresh it in the Supabase SQL
  // editor so /stats and paper-stats reflect the reset:
  console.log('\nNote: refresh the materialized view in Supabase SQL editor:')
  console.log('  REFRESH MATERIALIZED VIEW screen_metrics;')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
