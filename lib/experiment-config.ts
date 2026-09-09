import experimentConfigJson from '@/docs/contracts/experiment-config.json'

export type Condition = 'G1' | 'G2' | 'G3' | 'G4'
/** The second service crossed with interrelatedness (C2 heterogeneity redesign):
 *  `return_ride` = low heterogeneity (near-identical mobility task);
 *  `movie` = high heterogeneity (booking cinema tickets — a different activity). */
export type Service2Type = 'return_ride' | 'movie'
export type ListUIType =
  | 'generic-options'
  | 'categorized-by-destination'
  | 'citywide-popular'
  | 'distance-filtered'

export interface Service2Option {
  id: string
  label: string
  price: number
}

/** Per-task guidance metadata shown on task-instruction pages, the persistent
 *  task indicator, and the idle guidance banner. */
export interface TaskInfo {
  title: string
  service: string
  goal: string
  infoToEnter: string
  indicator: string
  guidanceText: string
}

export interface ConditionConfig {
  service2: Service2Type
  banner: boolean
  autoPopulate: boolean
  /** Whether the sender address field offers autocomplete suggestions. */
  addressSuggestions: boolean
  /** Idle delay (ms) before the non-blocking guidance banner appears. */
  guidanceThresholdMs: number
  listUI: ListUIType
  bannerText: string | null
  bannerCTA: string | null
  /** Emoji shown for the second service on the cross-sell banner. */
  service2Emoji: string
  /** Short label for the second service (e.g. "Return ride task", "Cinema task"). */
  service2TaskLabel: string
  /** Selectable options for the second service (ride tiers or ticket types). */
  service2Options: Service2Option[]
  addressLabel: string | null
  addressSublabel: string | null
  rideTaskInstruction: string
  service2TaskInstruction: string
  /** One-paragraph narrative shown on the scenario screen (shared within each
   *  L/H pair; the manipulation is app flow, not the story). */
  scenarioDescription: string
  task1: TaskInfo
  task2: TaskInfo
}

const config = experimentConfigJson as Record<Condition, ConditionConfig>

export function getConditionConfig(condition: Condition): ConditionConfig {
  return config[condition]
}

export const CONDITIONS: Condition[] = ['G1', 'G2', 'G3', 'G4']
