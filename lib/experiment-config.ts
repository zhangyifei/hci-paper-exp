import experimentConfigJson from '@/docs/contracts/experiment-config.json'

export type Condition = 'G1' | 'G2' | 'G3' | 'G4'
export type Service2Type = 'courier' | 'eats'
export type ListUIType =
  | 'generic-options'
  | 'categorized-by-destination'
  | 'citywide-popular'
  | 'distance-filtered'

export interface PickupOption {
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
  pickupOptions: PickupOption[]
  addressLabel: string | null
  addressSublabel: string | null
  rideTaskInstruction: string
  service2TaskInstruction: string
  task1: TaskInfo
  task2: TaskInfo
}

const config = experimentConfigJson as Record<Condition, ConditionConfig>

export function getConditionConfig(condition: Condition): ConditionConfig {
  return config[condition]
}

export const CONDITIONS: Condition[] = ['G1', 'G2', 'G3', 'G4']
