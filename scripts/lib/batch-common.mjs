// Shared clients + study-v2 instrument definitions for the batch report/export scripts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { mean } from './stats.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT = path.join(ROOT, 'docs', 'paper')
export const DEFAULT_BATCH_ID = '5df44e4d-8503-425b-b700-9e0a2515d8ca'
export const DEFAULT_STUDY_ID = '6abdd9153a152ef8d19a491f'
const PROLIFIC_API = 'https://api.prolific.com/api/v1'

function parseEnv(file) {
  const out = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}
const env = { ...parseEnv(path.join(ROOT, '.env.local')), ...process.env }
export const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const prolificToken = readFileSync(path.join(OUT, 'prolific-env.conf'), 'utf8').match(/prolific_token="?([^"\n]*)"?/)?.[1]
if (!prolificToken) throw new Error('prolific_token not found in docs/paper/prolific-env.conf')

export async function prolific(pathname) {
  const res = await fetch(`${PROLIFIC_API}${pathname}`, { headers: { Authorization: `Token ${prolificToken}` } })
  if (!res.ok) throw new Error(`Prolific ${pathname} → HTTP ${res.status}`)
  return res.json()
}
export async function query(builder, label) {
  const { data, error } = await builder
  if (error) throw new Error(`Supabase ${label}: ${error.message}`)
  return data
}

// ── instrument (study v2) ────────────────────────────────────────────────────
export const ITEMS = {
  CL: ['CL1', 'CL2', 'CL3'],
  PU: ['PU1', 'PU2', 'PU3', 'PU4', 'PU5', 'PU6'],
  CI: ['CI1', 'CI2', 'CI3', 'CI4'],
  MCi: ['MC1', 'MC2', 'MC5'],
  MCh: ['MC3', 'MC4', 'MC6'],
}
export const REVERSE = new Set(['PU3', 'PU5', 'PU6', 'CI4', 'MC5', 'MC6'])
export const SURVEY_CODES = [...Object.values(ITEMS).flat(), 'AC1']
export const QUEST_CODES = ['DEM1', 'DEM2', 'FAM1', 'FAM2', 'SWI1', 'SWI2']
export const PROLIFIC_PID = /^[a-f0-9]{24}$/
export const CELLS = ['G1', 'G2', 'G3', 'G4']
export const DESIGN = {
  G1: { het: 'low', inter: 'absent', svc2: 'Courier' },
  G2: { het: 'low', inter: 'present', svc2: 'Courier' },
  G3: { het: 'high', inter: 'absent', svc2: 'Cinema' },
  G4: { het: 'high', inter: 'present', svc2: 'Cinema' },
}
export const CONSTRUCT_NAMES = { CL: 'Cognitive load', PU: 'Perceived usability', CI: 'Continuance intention', MCi: 'MC · interrelatedness', MCh: 'MC · heterogeneity' }
export const ITEM_TEXT = {
  CL1: 'Mental activity required', CL2: 'How hard you worked mentally', CL3: 'Stressed or annoyed',
  PU1: 'Easy to use for consecutive tasks', PU2: 'Could efficiently complete my goal', PU3: 'Moving to 2nd service took more steps than expected',
  PU4: 'Easy to continue from 1st to 2nd service', PU5: 'Felt unsure how to start the 2nd service', PU6: 'More effortful than needed',
  CI1: 'Would use again', CI2: 'Intend to use again', CI3: 'Would choose again', CI4: 'Would use another app instead',
  MC1: 'Prompted with the next service at the right moment', MC2: 'Details already filled in', MC5: 'Had to enter address again',
  MC3: '2nd service clearly a different type of task', MC4: 'Steps unlike booking the ride', MC6: 'Services felt like the same kind of activity',
}
// Verbatim participant-facing wording (components/Survey/*).
export const ITEM_WORDING = {
  CL1: 'How much mental activity was required to complete these tasks?',
  CL2: 'How hard did you have to work mentally to reach your performance?',
  CL3: 'How stressed or annoyed did you feel during the tasks?',
  PU1: 'I found this super app easy to use for these consecutive tasks.',
  PU2: 'I felt I could efficiently complete my goal using this super app.',
  PU3: 'Moving from the first service to the second took more steps than I expected.',
  PU4: 'The super app made it easy to continue from the first service to the second service.',
  PU5: 'At some point I felt unsure how to get to or start the second service.',
  PU6: 'Parts of completing the two tasks were more effortful than they needed to be.',
  CI1: 'I would use this super app again for similar service tasks.',
  CI2: 'I intend to use this super app again if I need to complete similar tasks.',
  CI3: 'I would choose this super app again for similar tasks.',
  CI4: 'If another app could do these tasks, I would probably use it instead of this one.',
  MC1: 'The super app prompted me with the next service at the right moment.',
  MC2: 'My details (e.g., my address) were already filled in for the second service.',
  MC5: 'I had to enter my address again from scratch for the second service.',
  MC3: 'The second service was a clearly different type of task from booking a ride.',
  MC4: 'The steps for the second service were unlike those for booking the ride.',
  MC6: 'The two services felt like basically the same kind of activity.',
  AC1: 'To show that you are reading carefully, please select "Somewhat agree" for this statement.',
  DEM1: 'What is your age range?',
  DEM2: 'What is your gender?',
  FAM1: 'How often do you use multi-service (super) apps such as Grab, Gojek, WeChat, or similar?',
  FAM2: 'How familiar are you with switching between different services (e.g. ride → food) within the same app?',
  SWI1: 'When using a multi-service app in a single session, how many different services do you typically use?',
  SWI2: 'How often do you switch between services mid-session (e.g. finish a ride, then order food without closing the app)?',
}
export const scored = (code, v) => (REVERSE.has(code) ? 8 - v : v)
export const construct = (survey, key) => mean(ITEMS[key].map((c) => scored(c, survey[c])).filter(Number.isFinite))
