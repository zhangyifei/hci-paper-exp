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
  CL: ['CL1', 'CL2', 'CL3', 'CL4', 'CL5'],
  PU: ['PU1', 'PU2', 'PU3', 'PU4', 'PU5'],
  CI: ['CI1', 'CI2', 'CI3', 'CI4'],
  MCi: ['MC1', 'MC2', 'MC3', 'MC4'],
  MCh: ['MC5', 'MC6', 'MC7', 'MC8', 'MC9'],
}
export const REVERSE = new Set(['PU5'])
export const SURVEY_CODES = [...Object.values(ITEMS).flat(), 'AC1']
export const QUEST_CODES = ['DEM1', 'DEM2', 'FAM1', 'FAM2', 'KNW1', 'KNW2', 'USE1', 'SWI1', 'SWI2']
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
  CL1: 'Mental activity required', CL2: 'How hard you worked mentally', CL3: 'A lot of thinking',
  CL4: 'Think carefully about next steps', CL5: 'Mentally demanding',
  PU1: 'Easy to use for consecutive tasks', PU2: 'Could efficiently complete my goal',
  PU3: 'Transition felt smooth', PU4: 'Easy to continue from 1st to 2nd service', PU5: 'Frustrating experience',
  CI1: 'Continue rather than discontinue', CI2: 'Continue rather than use an alternative',
  CI3: 'Would choose again', CI4: 'Would like to continue use',
  MC1: 'Direct link between services', MC2: 'Go straight to second service',
  MC3: 'Information carried over', MC4: 'Destination address filled in', MC5: 'Services served different purposes',
  MC6: 'Main functions are different', MC7: 'Different broad service categories',
  MC8: 'Different steps for main tasks', MC9: 'Different types of activities',
}
// Verbatim participant-facing wording (components/Survey/*).
export const ITEM_WORDING = {
  CL1: 'How much mental activity was required to complete the two tasks?',
  CL2: 'How hard did you have to work mentally to complete these two tasks?',
  CL3: 'Using this app required a lot of thinking.',
  CL4: 'While using this app, I had to think carefully about what to do next.',
  CL5: 'Overall, using this app was mentally demanding.',
  PU1: 'I found this app easy to use for these consecutive tasks.',
  PU2: 'I felt I could efficiently complete my goal using this app.',
  PU3: 'The transition between the two services felt smooth.',
  PU4: 'The app made it easy to continue from the first service to the second service.',
  PU5: 'Using this app was a frustrating experience.',
  CI1: 'I intend to continue using this app rather than discontinue its use.',
  CI2: 'My intentions are to continue using this app rather than use any alternative app.',
  CI3: 'I would choose this super app again for similar tasks.',
  CI4: 'I would like to continue my use of this app.',
  MC1: 'The app provided a direct link from the first service to the second service.',
  MC2: 'The app allowed me to go straight from the first service to the second service.',
  MC3: 'Information from the first service was automatically carried over to the second service.',
  MC4: 'The destination address from my ride booking was automatically filled in for the second service.',
  MC5: 'The two services served different purposes.',
  MC6: 'The main functions performed by the two services are different.',
  MC7: 'The two services belong to different broad service categories.',
  MC8: 'The two services follow different steps to complete their main tasks.',
  MC9: 'The two services involve different types of activities.',
  AC1: 'To show that you are reading carefully, please select "Somewhat agree" for this statement.',
  DEM1: 'What is your age range?',
  DEM2: 'What is your gender?',
  FAM1: 'How familiar are you with super apps such as Uber, Grab, WeChat, or similar?',
  FAM2: 'How clear an idea do you have about which characteristics of a super app are important for you to have a satisfying experience using it?',
  KNW1: 'How would you rate your knowledge about super apps relative to the general population?',
  KNW2: 'I know a lot about super apps.',
  USE1: 'How frequently do you use super apps?',
  SWI1: 'How familiar are you with switching between different services (e.g. ride → food) within the same app?',
  SWI2: 'How often do you switch between services mid-session (e.g. finish a ride, then order food without closing the app)?',
}
export const scored = (code, v) => (REVERSE.has(code) ? 8 - v : v)
export const construct = (survey, key) => mean(ITEMS[key].map((c) => scored(c, survey[c])).filter(Number.isFinite))
