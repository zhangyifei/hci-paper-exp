import experimentConfigJson from '@/docs/contracts/experiment-config.json'

export type Condition = 'G1' | 'G2' | 'G3' | 'G4'
/** The second service crossed with interrelatedness (C2 heterogeneity redesign):
 *  `courier` = low heterogeneity (sending a package — still an address/logistics task);
 *  `movie` = high heterogeneity (booking cinema tickets — a different activity). */
export type Service2Type = 'courier' | 'movie'
export type ListUIType =
  | 'generic-options'
  | 'categorized-by-destination'
  | 'citywide-popular'
  | 'distance-filtered'
export type TripCompleteBackDestination = 'home' | 'service2'

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
  /** Whether Service 2's destination field reveals two options after typing. */
  service2EntryAddressTypeahead: boolean
  /** Optional page-specific reminder for the Service 2 entry screen. */
  service2EntryGuidanceText: string | null
  /** Reminder for package details or cinema seat selection. */
  service2DetailGuidanceText: string
  /** Reminder shown after Service 2 is complete. */
  service2CompleteGuidanceText: string
  /** Exact address required before Service 2 results appear; null shows them immediately. */
  service2ResultsRequireAddress: string | null
  /** Reminder for the ride-option selection screen. */
  rideSelectionGuidanceText: string
  /** Reminder for the short ride-arrival waiting screen. */
  rideWaitingGuidanceText: string
  /** Idle delay (ms) before the non-blocking guidance banner appears. */
  guidanceThresholdMs: number
  listUI: ListUIType
  bannerText: string | null
  bannerCTA: string | null
  /** Optional helper shown below the Trip Complete action. */
  tripCompleteHint: string | null
  /** Optional idle-reminder override used only on the Trip Complete screen. */
  tripCompleteGuidanceText: string | null
  /** Destination of the Back to Home action on the Trip Complete screen. */
  tripCompleteBackDestination: TripCompleteBackDestination
  /** Whether the Trip Complete screen shows its map image. */
  showTripCompleteMap: boolean
  /** Whether the secondary study address is underlined on the scenario screen. */
  underlineSecondaryAddressInScenario: boolean
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
