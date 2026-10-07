import type { Condition } from '@/lib/experiment-config'

/** Study-v2 survey constructs → item codes (mirrors components/Survey/PostTaskSurvey.tsx). */
export const ITEMS = {
  CL: ['CL1', 'CL2', 'CL3'],
  PU: ['PU1', 'PU2', 'PU3', 'PU4', 'PU5', 'PU6'],
  CI: ['CI1', 'CI2', 'CI3', 'CI4'],
  MCi: ['MC1', 'MC2', 'MC5'],
  MCh: ['MC3', 'MC4', 'MC6'],
} as const
export type ConstructKey = keyof typeof ITEMS

export const CONSTRUCT_KEYS = Object.keys(ITEMS) as ConstructKey[]
export const CONSTRUCT_ITEMS: string[] = CONSTRUCT_KEYS.flatMap((k) => [...ITEMS[k]])
export const REVERSE = new Set(['PU3', 'PU5', 'PU6', 'CI4', 'MC5', 'MC6'])
export const SURVEY_CODES = [...CONSTRUCT_ITEMS, 'AC1']
export const QUEST_CODES = ['DEM1', 'DEM2', 'FAM1', 'FAM2', 'SWI1', 'SWI2']

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
  MC1: 'The system prompted me with the next service at the right moment.',
  MC2: 'The system automatically carried my data into the next service.',
  MC5: 'I had to enter my address again from scratch for the second service.',
  MC3: 'The second service felt different from the ride service.',
  MC4: 'The two service tasks required different kinds of actions.',
  MC6: 'The two services felt like basically the same kind of activity.',
  AC1: 'To show that you are reading carefully, please select "Somewhat agree" for this statement.',
  DEM1: 'What is your age range?',
  DEM2: 'What is your gender?',
  FAM1: 'How often do you use multi-service (super) apps such as Grab, Gojek, WeChat, or similar?',
  FAM2: 'How familiar are you with switching between different services (e.g. ride → food) within the same app?',
  SWI1: 'When using a multi-service app in a single session, how many different services do you typically use?',
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
