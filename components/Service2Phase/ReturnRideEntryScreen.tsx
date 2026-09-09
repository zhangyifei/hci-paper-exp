import React, { useEffect, useRef, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import BackButton from '../shared/BackButton'
import { logger } from '@/lib/logger'
import { markService2Entry } from '@/lib/timing'
import { ConditionConfig } from '@/lib/experiment-config'
import { enterScreen } from '@/lib/screen-tracker'

interface ReturnRideEntryScreenProps {
  config: ConditionConfig
  onNext: (eventId: string, fee: number) => void
  onBack: () => void
}

interface SavedAddress {
  id: string
  name: string
  detail: string
  tag?: string
  icon: string
}

/** Selectable saved/recent drop-off places (tap instead of typing). */
const SAVED_DROPOFFS: SavedAddress[] = [
  { id: 'rue-mcgill', name: '3008 Rue McGill', detail: '3008 Rue McGill, Montreal', tag: 'RECENT', icon: '🕒' },
  { id: 'saint-louis', name: '1502 Rue Saint-Louis', detail: '1502 Rue Saint-Louis, Montreal', icon: '🏠' },
]

const PICKUP_SUGGESTIONS = [
  '1000 Saint-Catherine Street West, Montreal',
  '750 Rue Peel, Montreal',
  '680 Rue Sherbrooke Ouest, Montreal',
]

/** Selectable saved/recent pickup places. */
const SAVED_PICKUPS: SavedAddress[] = [
  { id: 'pickup-saint-catherine', name: '1000 Saint-Catherine Street West', detail: '1000 Saint-Catherine Street West, Montreal', tag: 'RECENT', icon: '🕒' },
  { id: 'pickup-peel', name: '750 Rue Peel', detail: '750 Rue Peel, Montreal', icon: '📍' },
]

/** A valid address has a street number and a street name. */
function isValidAddress(value: string): boolean {
  const v = value.trim()
  return v.length >= 5 && /\d/.test(v) && /[a-zA-Z]/.test(v)
}

export default function ReturnRideEntryScreen({ config, onNext, onBack }: ReturnRideEntryScreenProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')

  // Pickup address (editable; pre-filled with the destination when permitted).
  const [pickupAddress, setPickupAddress] = useState<string>(
    config.autoPopulate && config.addressLabel ? config.addressLabel : '',
  )
  const [pickupTouched, setPickupTouched] = useState(false)
  const [pickupFocused, setPickupFocused] = useState(false)

  // Drop-off address (editable; can be filled from saved/recent addresses).
  const [dropoffAddress, setDropoffAddress] = useState<string>('')
  const [dropoffTouched, setDropoffTouched] = useState(false)
  const [selectedDropoffId, setSelectedDropoffId] = useState<string | null>(null)

  const [showErrors, setShowErrors] = useState(false)
  const dropoffInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    markService2Entry()
    const eventId = logger.trackEvent('service2.entry', 'service2', 'service2_entry')
    setService2EntryEventId(eventId)
    const cleanup = enterScreen('service2_entry_return_ride', 'service2')

    if (config.service2Options.length > 0) {
      setSelectedTier(config.service2Options[0].id)
    }
    return cleanup
  }, [config.service2Options])

  const handleTierSelect = (id: string, label: string) => {
    setSelectedTier(id)
    logger.trackEvent('service2.option_selected', 'service2', 'service2_task_active', { payload: { optionId: id, optionLabel: label } })
  }

  const pickupValid = isValidAddress(pickupAddress)
  const dropoffValid = isValidAddress(dropoffAddress)

  const suggestionMatches =
    config.addressSuggestions && pickupFocused && pickupAddress.trim().length > 0
      ? PICKUP_SUGGESTIONS.filter((s) => s.toLowerCase().includes(pickupAddress.trim().toLowerCase()) && s !== pickupAddress)
      : []

  const handlePickupChange = (value: string) => {
    setPickupAddress(value)
    logger.trackEvent('service2.address_edited', 'service2', 'service2_task_active', {
      payload: { field: 'pickup' },
    })
  }

  const handlePickSuggestion = (value: string) => {
    setPickupAddress(value)
    setPickupFocused(false)
    logger.trackEvent('service2.address_validated', 'service2', 'service2_task_active', {
      payload: { field: 'pickup', source: 'suggestion' },
    })
  }

  const handlePickPickupSaved = (place: SavedAddress) => {
    setPickupAddress(place.detail)
    setPickupTouched(true)
    logger.trackEvent('service2.address_validated', 'service2', 'service2_task_active', {
      payload: { field: 'pickup', source: 'saved', placeId: place.id },
    })
  }

  const handleDropoffChange = (value: string) => {
    setDropoffAddress(value)
    setSelectedDropoffId(null)
    logger.trackEvent('service2.address_edited', 'service2', 'service2_task_active', {
      payload: { field: 'dropoff' },
    })
  }

  const handleSelectSaved = (addr: SavedAddress) => {
    setDropoffAddress(addr.detail)
    setSelectedDropoffId(addr.id)
    setDropoffTouched(true)
    logger.trackEvent('service2.recipient_selected', 'service2', 'service2_task_active', {
      payload: { recipientId: addr.id, recipient: addr.detail },
    })
  }

  const handleChangeDropoff = () => {
    setSelectedDropoffId(null)
    setDropoffAddress('')
    requestAnimationFrame(() => dropoffInputRef.current?.focus())
  }

  const handleConfirm = () => {
    if (!selectedTier || !pickupValid || !dropoffValid) {
      setShowErrors(true)
      setPickupTouched(true)
      setDropoffTouched(true)
      return
    }
    logger.trackEvent('service2.address_validated', 'service2', 'service2_task_active', {
      payload: { pickup: pickupAddress, dropoff: dropoffAddress },
    })
    const fee = config.service2Options.find((o) => o.id === selectedTier)?.price ?? 0
    onNext(service2EntryEventId, fee)
  }

  const pickupError = (pickupTouched || showErrors) && !pickupValid
  const dropoffError = (dropoffTouched || showErrors) && !dropoffValid

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in" data-testid="screen-return-ride-entry">
      <StatusBar />
      <BackButton onClick={onBack} />

      {/* Tab Bar */}
      <div className="flex items-center space-x-3 px-4 mt-[104px] mb-6 pt-2 overflow-x-auto no-scrollbar">
        <div className="bg-black text-white px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform flex items-center">
          <span className="mr-2 text-[18px]">🚕</span> Rides
        </div>
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Cinema</div>
      </div>

      <div className="px-4 overflow-y-auto pb-4 no-scrollbar">
        <h1 className="text-[26px] font-bold tracking-tight text-black mb-1 leading-tight">Book a return ride</h1>
        <p className="text-[14px] text-gray-500 mb-6 leading-snug">Confirm your pickup and drop-off, then choose a ride.</p>

        {/* Pickup */}
        <div className="mb-5">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-2">Pickup</h2>
          {config.autoPopulate ? (
            <div className="bg-white rounded-[16px] p-4 border border-green-500 shadow-[0_4px_12px_rgba(22,163,74,0.08)] relative" data-testid="pickup-address-autofilled">
              <div className="flex items-center mb-1">
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold mr-2 border border-green-200">SUGGESTED</span>
                <div className="font-bold text-[15px] text-black">{config.addressLabel || '1000 Saint-Catherine Street West'}</div>
              </div>
              <div className="text-[13px] text-green-600 font-medium">{config.addressSublabel || 'Downtown, Montreal'}</div>
            </div>
          ) : (
            <>
              <div className={`bg-gray-100 rounded-[16px] h-[52px] flex items-center px-4 border-2 transition-colors ${pickupError ? 'border-red-500' : 'border-transparent focus-within:border-black'}`} data-testid="pickup-address-empty">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  autoComplete="off"
                  value={pickupAddress}
                  onChange={(e) => handlePickupChange(e.target.value)}
                  onFocus={() => setPickupFocused(true)}
                  onBlur={() => { setPickupFocused(false); setPickupTouched(true) }}
                  placeholder="Enter pickup address"
                  aria-label="Pickup address"
                  aria-invalid={pickupError}
                  data-testid="input-pickup-address"
                  className="flex-1 bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-500"
                />
              </div>
              {suggestionMatches.length > 0 && (
                <div className="mt-2 rounded-[12px] border border-gray-100 overflow-hidden" data-testid="pickup-suggestions">
                  {suggestionMatches.map((s) => (
                    <button key={s} type="button" onClick={() => handlePickSuggestion(s)} className="w-full text-left px-4 py-2.5 text-[14px] text-black active:bg-gray-50 border-b border-gray-50 last:border-0">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {pickupError && (
                <p data-testid="pickup-error" role="alert" className="mt-1.5 text-[12px] font-semibold text-red-600 pl-1">Enter a valid pickup address.</p>
              )}
              {pickupAddress.trim().length === 0 && (
                <div className="mt-3 space-y-1" data-testid="pickup-saved-places">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 mb-1">Saved &amp; recent</p>
                  {SAVED_PICKUPS.map((place) => (
                    <button key={place.id} type="button" onClick={() => handlePickPickupSaved(place)} data-testid={`pickup-saved-${place.id}`} className="w-full flex items-center text-left active:opacity-60 transition-opacity py-2">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-[14px] flex-shrink-0">{place.icon}</div>
                      <div className="flex-1 border-b border-gray-100 pb-3">
                        <div className="font-bold text-[15px] flex items-center mb-0.5 text-black">{place.name}{place.tag && <span className="ml-2 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{place.tag}</span>}</div>
                        <div className="text-[13px] text-gray-500">{place.detail}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drop-off */}
        <div className="mb-6">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-2">Drop-off</h2>
          {selectedDropoffId ? (
            <div className="bg-gray-50 rounded-[16px] p-4 border border-gray-200 flex items-center justify-between" data-testid="dropoff-selected">
              <div className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-black mr-3 flex-shrink-0" />
                <div className="font-bold text-[15px] text-black">{dropoffAddress}</div>
              </div>
              <button type="button" onClick={handleChangeDropoff} className="text-[13px] text-gray-400 font-bold">Change</button>
            </div>
          ) : (
            <>
              <div className={`bg-gray-100 rounded-[16px] h-[52px] flex items-center px-4 border-2 transition-colors ${dropoffError ? 'border-red-500' : 'border-transparent focus-within:border-black'}`} data-testid="dropoff-address-empty">
                <span className="w-2.5 h-2.5 rounded-full bg-black mr-3 flex-shrink-0" />
                <input
                  ref={dropoffInputRef}
                  type="text"
                  autoComplete="off"
                  value={dropoffAddress}
                  onChange={(e) => handleDropoffChange(e.target.value)}
                  onBlur={() => setDropoffTouched(true)}
                  placeholder="Enter drop-off address"
                  aria-label="Drop-off address"
                  aria-invalid={dropoffError}
                  data-testid="input-dropoff-address"
                  className="flex-1 bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-500"
                />
              </div>
              {dropoffError && (
                <p data-testid="dropoff-error" role="alert" className="mt-1.5 text-[12px] font-semibold text-red-600 pl-1">Enter a valid drop-off address.</p>
              )}
              {dropoffAddress.trim().length === 0 && (
                <div className="mt-3 space-y-1" data-testid="dropoff-saved-places">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 mb-1">Saved &amp; recent</p>
                  {SAVED_DROPOFFS.map((addr) => (
                    <button key={addr.id} type="button" onClick={() => handleSelectSaved(addr)} data-testid={`dropoff-saved-${addr.id}`} className="w-full flex items-center text-left active:opacity-60 transition-opacity py-2">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-[14px] flex-shrink-0">{addr.icon}</div>
                      <div className="flex-1 border-b border-gray-100 pb-3">
                        <div className="font-bold text-[15px] flex items-center mb-0.5 text-black">{addr.name}{addr.tag && <span className="ml-2 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{addr.tag}</span>}</div>
                        <div className="text-[13px] text-gray-500">{addr.detail}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Ride tiers */}
        <div className="mb-4">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-2">Choose a ride</h2>
          <div className="space-y-2" data-testid="ride-tiers">
            {config.service2Options.map((tier) => {
              const on = selectedTier === tier.id
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => handleTierSelect(tier.id, tier.label)}
                  data-testid={`ride-tier-${tier.id}`}
                  aria-pressed={on}
                  className={`w-full flex items-center justify-between px-4 h-[56px] rounded-[14px] border-2 transition-all active:scale-[0.99] ${on ? 'border-black bg-gray-50 shadow-sm' : 'border-gray-100 bg-white'}`}
                >
                  <div className="flex items-center">
                    <span className="text-[22px] mr-3">🚗</span>
                    <span className="font-bold text-[15px] text-black">{tier.label}</span>
                  </div>
                  <span className="font-bold text-[15px] text-black">${tier.price.toFixed(2)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto px-4 pb-3">
        <button
          onClick={handleConfirm}
          data-testid="btn-confirm-ride"
          className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] active:scale-[0.98] transition-all"
        >
          Confirm ride
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
