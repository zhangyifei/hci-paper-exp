import React, { useEffect, useRef, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import BackButton from '../shared/BackButton'
import { logger } from '@/lib/logger'
import { markService2Entry } from '@/lib/timing'
import { ConditionConfig } from '@/lib/experiment-config'
import { enterScreen } from '@/lib/screen-tracker'

interface CourierEntryScreenProps {
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

/** Selectable saved/recent recipient places (tap instead of typing). */
const SAVED_RECIPIENTS: SavedAddress[] = [
  { id: 'rue-mcgill', name: '3008 Rue McGill', detail: '3008 Rue McGill, Montreal', tag: 'RECENT', icon: '🕒' },
  { id: 'saint-louis', name: '1502 Rue Saint-Louis', detail: '1502 Rue Saint-Louis, Montreal', icon: '🏠' },
]

const SENDER_SUGGESTIONS = [
  '1000 Saint-Catherine Street West, Montreal',
  '750 Rue Peel, Montreal',
  '680 Rue Sherbrooke Ouest, Montreal',
]

/** Selectable saved/recent sender places. */
const SAVED_SENDERS: SavedAddress[] = [
  { id: 'sender-saint-catherine', name: '1000 Saint-Catherine Street West', detail: '1000 Saint-Catherine Street West, Montreal', tag: 'RECENT', icon: '🕒' },
  { id: 'sender-peel', name: '750 Rue Peel', detail: '750 Rue Peel, Montreal', icon: '📍' },
]

/** A valid address has a street number and a street name. */
function isValidAddress(value: string): boolean {
  const v = value.trim()
  return v.length >= 5 && /\d/.test(v) && /[a-zA-Z]/.test(v)
}

export default function CourierEntryScreen({ config, onNext, onBack }: CourierEntryScreenProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')

  // Sender address (editable; pre-filled with the destination when permitted).
  const [senderAddress, setSenderAddress] = useState<string>(
    config.autoPopulate && config.addressLabel ? config.addressLabel : '',
  )
  const [senderTouched, setSenderTouched] = useState(false)
  const [senderFocused, setSenderFocused] = useState(false)

  // Recipient address (editable; can be filled from saved/recent addresses).
  const [recipientAddress, setRecipientAddress] = useState<string>('')
  const [recipientTouched, setRecipientTouched] = useState(false)
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null)

  const [showErrors, setShowErrors] = useState(false)
  const recipientInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    markService2Entry()
    const eventId = logger.trackEvent('service2.entry', 'service2', 'service2_entry')
    setService2EntryEventId(eventId)
    const cleanup = enterScreen('service2_entry_courier', 'service2')

    if (config.service2Options.length > 0) {
      setSelectedOption(config.service2Options[0].id)
    }
    return cleanup
  }, [config.service2Options])

  const handleOptionSelect = (id: string, label: string) => {
    setSelectedOption(id)
    logger.trackEvent('service2.option_selected', 'service2', 'service2_task_active', { payload: { optionId: id, optionLabel: label } })
  }

  const senderValid = isValidAddress(senderAddress)
  const recipientValid = isValidAddress(recipientAddress)

  const suggestionMatches =
    config.addressSuggestions && senderFocused && senderAddress.trim().length > 0
      ? SENDER_SUGGESTIONS.filter((s) => s.toLowerCase().includes(senderAddress.trim().toLowerCase()) && s !== senderAddress)
      : []

  const handleSenderChange = (value: string) => {
    setSenderAddress(value)
    logger.trackEvent('service2.address_edited', 'service2', 'service2_task_active', {
      payload: { field: 'sender' },
    })
  }

  const handlePickSuggestion = (value: string) => {
    setSenderAddress(value)
    setSenderFocused(false)
    logger.trackEvent('service2.address_validated', 'service2', 'service2_task_active', {
      payload: { field: 'sender', source: 'suggestion' },
    })
  }

  const handlePickSenderSaved = (place: SavedAddress) => {
    setSenderAddress(place.detail)
    setSenderTouched(true)
    logger.trackEvent('service2.address_validated', 'service2', 'service2_task_active', {
      payload: { field: 'sender', source: 'saved', placeId: place.id },
    })
  }

  const handleRecipientChange = (value: string) => {
    setRecipientAddress(value)
    setSelectedRecipientId(null)
    logger.trackEvent('service2.address_edited', 'service2', 'service2_task_active', {
      payload: { field: 'recipient' },
    })
  }

  const handleSelectSaved = (addr: SavedAddress) => {
    setRecipientAddress(addr.detail)
    setSelectedRecipientId(addr.id)
    setRecipientTouched(true)
    logger.trackEvent('service2.recipient_selected', 'service2', 'service2_task_active', {
      payload: { recipientId: addr.id, recipient: addr.detail },
    })
  }

  const handleChangeRecipient = () => {
    setSelectedRecipientId(null)
    setRecipientAddress('')
    requestAnimationFrame(() => recipientInputRef.current?.focus())
  }

  const handleConfirm = () => {
    if (!selectedOption || !senderValid || !recipientValid) {
      setShowErrors(true)
      setSenderTouched(true)
      setRecipientTouched(true)
      return
    }
    logger.trackEvent('service2.address_validated', 'service2', 'service2_task_active', {
      payload: { sender: senderAddress, recipient: recipientAddress },
    })
    const fee = config.service2Options.find((o) => o.id === selectedOption)?.price ?? 0
    onNext(service2EntryEventId, fee)
  }

  const senderError = (senderTouched || showErrors) && !senderValid
  const recipientError = (recipientTouched || showErrors) && !recipientValid

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in" data-testid="screen-courier-entry">
      <StatusBar />
      <BackButton onClick={onBack} />

      {/* Tab Bar */}
      <div className="flex items-center space-x-3 px-4 mt-[104px] mb-6 pt-2 overflow-x-auto no-scrollbar">
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Rides</div>
        <div className="bg-black text-white px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform flex items-center">
          <span className="mr-2 text-[18px]">📦</span> Courier
        </div>
      </div>

      <div className="px-4 overflow-y-auto pb-4 no-scrollbar">
        <h1 className="text-[26px] font-bold tracking-tight text-black mb-1 leading-tight">Send a package</h1>
        <p className="text-[14px] text-gray-500 mb-6 leading-snug">Confirm the sender and recipient, then choose a delivery option.</p>

        {/* Sender */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[13px] font-bold text-black tracking-wide">Sender</h2>
            {config.autoPopulate && (
              <span className="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-100">SUGGESTED</span>
            )}
          </div>
          {config.autoPopulate ? (
            <div className="bg-white rounded-[16px] p-4 border border-green-500 shadow-[0_4px_12px_rgba(22,163,74,0.08)] relative" data-testid="sender-address-autofilled">
              <div className="flex items-center mb-1">
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold mr-2 border border-green-200">SUGGESTED</span>
                <div className="font-bold text-[15px] text-black">{config.addressLabel || '1000 Saint-Catherine Street West'}</div>
              </div>
              <div className="text-[13px] text-green-600 font-medium">{config.addressSublabel || 'Downtown, Montreal'}</div>
            </div>
          ) : (
            <>
              <div className={`bg-gray-100 rounded-[16px] h-[52px] flex items-center px-4 border-2 transition-colors ${senderError ? 'border-red-500' : 'border-transparent focus-within:border-black'}`} data-testid="sender-address-empty">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  autoComplete="off"
                  value={senderAddress}
                  onChange={(e) => handleSenderChange(e.target.value)}
                  onFocus={() => setSenderFocused(true)}
                  onBlur={() => { setSenderFocused(false); setSenderTouched(true) }}
                  placeholder="Enter sender address"
                  aria-label="Sender address"
                  aria-invalid={senderError}
                  data-testid="input-sender-address"
                  className="flex-1 bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-500"
                />
              </div>
              {suggestionMatches.length > 0 && (
                <div className="mt-2 rounded-[12px] border border-gray-100 overflow-hidden" data-testid="sender-suggestions">
                  {suggestionMatches.map((s) => (
                    <button key={s} type="button" onClick={() => handlePickSuggestion(s)} className="w-full text-left px-4 py-2.5 text-[14px] text-black active:bg-gray-50 border-b border-gray-50 last:border-0">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {senderError && (
                <p data-testid="sender-error" role="alert" className="mt-1.5 text-[12px] font-semibold text-red-600 pl-1">Enter a valid sender address.</p>
              )}
              {senderAddress.trim().length === 0 && (
                <div className="mt-3 space-y-1" data-testid="sender-saved-places">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 mb-1">Saved &amp; recent</p>
                  {SAVED_SENDERS.map((place) => (
                    <button key={place.id} type="button" onClick={() => handlePickSenderSaved(place)} data-testid={`sender-saved-${place.id}`} className="w-full flex items-center text-left active:opacity-60 transition-opacity py-2">
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

        {/* Recipient */}
        <div className="mb-6">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-2">Recipient</h2>
          {selectedRecipientId ? (
            <div className="bg-gray-50 rounded-[16px] p-4 border border-gray-200 flex items-center justify-between" data-testid="recipient-selected">
              <div className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-black mr-3 flex-shrink-0" />
                <div className="font-bold text-[15px] text-black">{recipientAddress}</div>
              </div>
              <button type="button" onClick={handleChangeRecipient} data-testid="btn-change-recipient" className="text-[13px] text-gray-400 font-bold">Change</button>
            </div>
          ) : (
            <>
              <div className={`bg-gray-100 rounded-[16px] h-[52px] flex items-center px-4 border-2 transition-colors ${recipientError ? 'border-red-500' : 'border-transparent focus-within:border-black'}`} data-testid="recipient-address-empty">
                <span className="w-2.5 h-2.5 rounded-full bg-black mr-3 flex-shrink-0" />
                <input
                  ref={recipientInputRef}
                  type="text"
                  autoComplete="off"
                  value={recipientAddress}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  onBlur={() => setRecipientTouched(true)}
                  placeholder="Enter recipient address"
                  aria-label="Recipient address"
                  aria-invalid={recipientError}
                  data-testid="input-recipient-address"
                  className="flex-1 bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-500"
                />
              </div>
              {recipientError && (
                <p data-testid="recipient-error" role="alert" className="mt-1.5 text-[12px] font-semibold text-red-600 pl-1">Choose a saved address or enter a valid recipient address.</p>
              )}
              {recipientAddress.trim().length === 0 && (
                <div className="mt-3 space-y-1" data-testid="recipient-saved-places">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 mb-1">Saved &amp; recent</p>
                  {SAVED_RECIPIENTS.map((addr) => (
                    <button key={addr.id} type="button" onClick={() => handleSelectSaved(addr)} data-testid={`recipient-saved-${addr.id}`} className="w-full flex items-center text-left active:opacity-60 transition-opacity py-2">
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

        {/* Delivery options */}
        <div className="mb-4">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-2">
            {config.listUI === 'categorized-by-destination' ? 'Choose by destination' : 'Choose a delivery option'}
          </h2>
          <div className="space-y-2" data-testid="courier-options">
            {config.service2Options.map((option) => {
              const on = selectedOption === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleOptionSelect(option.id, option.label)}
                  data-testid={`courier-option-${option.id}`}
                  aria-pressed={on}
                  className={`w-full flex items-center justify-between px-4 h-[56px] rounded-[14px] border-2 transition-all active:scale-[0.99] ${on ? 'border-black bg-gray-50 shadow-sm' : 'border-gray-100 bg-white'}`}
                >
                  <div className="flex items-center">
                    <span className="text-[22px] mr-3">📦</span>
                    <span className="font-bold text-[15px] text-black">{option.label}</span>
                  </div>
                  <span className="font-bold text-[15px] text-black">${option.price.toFixed(2)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto px-4 pb-3">
        <button
          onClick={handleConfirm}
          data-testid="btn-confirm-courier"
          className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] active:scale-[0.98] transition-all"
        >
          Continue
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
