import type { Condition } from '@/lib/experiment-config'

/** Current 24-item survey constructs → item codes (mirrors PostTaskSurvey.tsx). */
export const ITEMS = {
  CL: ['CL1', 'CL2', 'CL3', 'CL4', 'CL5'],
  PU: ['PU1', 'PU2', 'PU3', 'PU4', 'PU5'],
  CI: ['CI1', 'CI2', 'CI3', 'CI4'],
  MCi: ['MC1', 'MC2', 'MC3', 'MC4'],
  MCh: ['MC5', 'MC6', 'MC7', 'MC8', 'MC9'],
} as const
export type ConstructKey = keyof typeof ITEMS

export const CONSTRUCT_KEYS = Object.keys(ITEMS) as ConstructKey[]
export const CONSTRUCT_ITEMS: string[] = CONSTRUCT_KEYS.flatMap((k) => [...ITEMS[k]])
export const REVERSE = new Set(['PU5'])
export const SURVEY_CODES = [...CONSTRUCT_ITEMS, 'AC1']
export const QUEST_CODES = ['DEM1', 'DEM2', 'FAM1', 'FAM2', 'KNW1', 'KNW2', 'USE1', 'SWI1', 'SWI2']

export const CONSTRUCT_NAMES: Record<ConstructKey, string> = {
  CL: 'Cognitive load',
  PU: 'Perceived usability',
  CI: 'Continuance intention',
  MCi: 'MC · interrelatedness',
  MCh: 'MC · heterogeneity',
}

export const DESIGN: Record<Condition, { het: string; inter: string; svc2: string }> = {
  G1: { het: 'low', inter: 'absent', svc2: 'Courier' },
  G2: { het: 'low', inter: 'present', svc2: 'Courier' },
  G3: { het: 'high', inter: 'absent', svc2: 'Cinema' },
  G4: { het: 'high', inter: 'present', svc2: 'Cinema' },
}

/** Verbatim participant-facing wording (components/Survey/*). */
export const ITEM_WORDING: Record<string, string> = {
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

/** 7-point scale: reverse-coded items are scored 8 − x. */
export const scoreItem = (code: string, value: number): number => (REVERSE.has(code) ? 8 - value : value)

export function constructScore(responses: Record<string, unknown>, key: ConstructKey): number | null {
  const values = ITEMS[key]
    .map((code) => {
      const v = responses[code]
      return typeof v === 'number' && Number.isFinite(v) ? scoreItem(code, v) : null
    })
    .filter((v): v is number => v != null)
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}
