/**
 * Create or list single-use external (non-Prolific) invite links for a batch.
 * Each invite is bound to one batch cell; only the token's SHA-256 hash is stored,
 * so the printed links cannot be recovered later — save them when created.
 *
 * Usage:
 *   node scripts/external-invites.mjs create <batchId> <G1|G2|G3|G4>...
 *   node scripts/external-invites.mjs list <batchId>
 */
import { createHash, randomBytes } from 'node:crypto'
import { db, query } from './lib/batch-common.mjs'

const BASE_URL = process.env.EXPERIMENT_BASE_URL || 'https://hci-paper-exp.vercel.app'
const [command, batchId, ...cells] = process.argv.slice(2)

if (!batchId || !['create', 'list'].includes(command)) {
  console.error('Usage: node scripts/external-invites.mjs create <batchId> <G1|G2|G3|G4>...\n       node scripts/external-invites.mjs list <batchId>')
  process.exit(1)
}

const batch = await query(db.from('test_batches').select('id,name,status,group_size').eq('id', batchId).single(), 'batch')

if (command === 'create') {
  if (!cells.length || cells.some((c) => !['G1', 'G2', 'G3', 'G4'].includes(c))) {
    throw new Error('Pass one or more conditions (G1–G4), one per invite')
  }
  if (batch.status !== 'active') throw new Error(`Batch ${batch.name} is ${batch.status}`)

  // Never issue more invites than the cell has open places (active rows + unclaimed invites).
  const active = await query(
    db.from('participant_assignments').select('group_condition').eq('batch_id', batchId).in('status', ['assigned', 'completed']),
    'assignments',
  )
  const pending = await query(
    db.from('external_invites').select('group_condition').eq('batch_id', batchId).is('claimed_at', null),
    'invites',
  )
  for (const cell of new Set(cells)) {
    const used = [...active, ...pending].filter((r) => r.group_condition === cell).length
    const requested = cells.filter((c) => c === cell).length
    if (used + requested > batch.group_size) {
      throw new Error(`${cell}: ${batch.group_size - used} open place(s), ${requested} requested`)
    }
  }

  const rows = cells.map((cell) => {
    const token = randomBytes(16).toString('base64url')
    return {
      token,
      row: {
        batch_id: batchId,
        token_hash: createHash('sha256').update(token).digest('hex'),
        participant_id: `ext_${randomBytes(5).toString('hex')}`,
        group_condition: cell,
      },
    }
  })
  await query(db.from('external_invites').insert(rows.map((r) => r.row)), 'insert invites')

  console.log(`Created ${rows.length} single-use invite(s) for ${batch.name}. Save these links now:\n`)
  for (const { token, row } of rows) {
    console.log(`${row.group_condition}  ${row.participant_id}  ${BASE_URL}/?invite=${token}`)
  }
} else {
  const invites = await query(
    db.from('external_invites').select('participant_id,group_condition,created_at,claimed_at,exp_session_id').eq('batch_id', batchId).order('created_at'),
    'invites',
  )
  const statuses = await query(
    db.from('participant_assignments').select('prolific_pid,status,invalid_reason').eq('batch_id', batchId).like('prolific_pid', 'ext\\_%'),
    'assignments',
  )
  console.log(`${batch.name}: ${invites.length} external invite(s)`)
  for (const invite of invites) {
    const assignment = statuses.find((s) => s.prolific_pid === invite.participant_id)
    console.log(
      `${invite.group_condition}  ${invite.participant_id}  ${invite.claimed_at ? `claimed ${invite.claimed_at}` : 'unclaimed'}` +
        (assignment ? `  app=${assignment.status}${assignment.invalid_reason ? ` (${assignment.invalid_reason})` : ''}` : ''),
    )
  }
}
