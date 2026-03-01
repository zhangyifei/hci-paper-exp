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

export interface ConditionConfig {
  service2: Service2Type
  banner: boolean
  autoPopulate: boolean
  listUI: ListUIType
  bannerText: string | null
  bannerCTA: string | null
  pickupOptions: PickupOption[]
  addressLabel: string | null
  addressSublabel: string | null
}

const config = experimentConfigJson as Record<Condition, ConditionConfig>

export function getConditionConfig(condition: Condition): ConditionConfig {
  return config[condition]
}

export const CONDITIONS: Condition[] = ['G1', 'G2', 'G3', 'G4']
