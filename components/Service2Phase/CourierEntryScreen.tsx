import React, { useEffect, useRef, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import BackButton from '../shared/BackButton'
import { logger } from '@/lib/logger'
import { markService2Entry, markService2Complete } from '@/lib/timing'
import { ConditionConfig } from '@/lib/experiment-config'
import { enterScreen } from '@/lib/screen-tracker'

interface CourierEntryScreenProps {
  config: ConditionConfig
  onNext: () => void
  onBack: () => void
}

interface SavedAddress {
  id: string
  name: string
  detail: string
  tag?: string
  icon: string
}

const SAVED_ADDRESSES: SavedAddress[] = [
  { id: 'rue-mcgill', name: 'Rue McGill', detail: '3008, Rue McGill, Montreal', tag: 'RECENT', icon: '🕒' },
  { id: 'saint-louis', name: 'Saint-Louis', detail: '1502, Rue Saint-Louis, Montreal', icon: '📍' },
]

const SENDER_SUGGESTIONS = [
  'Rue Saint-Laurent - spot 01, Montreal',
  '100 Rue Saint-Laurent, Montreal',
  '1000 Saint-Catherine Street West, Montreal',
]

/** A valid address has a street number and a street name. */
function isValidAddress(value: string): boolean {
  const v = value.trim()
  return v.length >= 5 && /\d/.test(v) && /[a-zA-Z]/.test(v)
}

export default function CourierEntryScreen({ config, onNext, onBack }: CourierEntryScreenProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')

  // Sender address (editable; pre-filled with the suggestion when permitted).
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

    // Set default option
    if (config.pickupOptions.length > 0) {
      setSelectedOption(config.pickupOptions[0].id)
    }
    return cleanup
  }, [config.pickupOptions])

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
    logger.trackEvent('service2.task.submitting', 'service2', 'service2_task_submitting')
    const duration = markService2Complete()
    logger.trackEvent('service2.task.complete', 'service2', 'service2_task_complete', { durationMs: duration ?? 0, parentEventId: service2EntryEventId })
    onNext()
  }

  const senderError = (senderTouched || showErrors) && !senderValid
  const recipientError = (recipientTouched || showErrors) && !recipientValid


  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in">
      <StatusBar />
      <BackButton onClick={onBack} />

      {/* Tab Bar */}
      <div className="flex items-center space-x-3 px-4 mt-[104px] mb-6 pt-2 overflow-x-auto no-scrollbar">
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Rides</div>
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Eats</div>
        <div className="bg-black text-white px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform">Courier</div>
      </div>

      <div className="px-4 overflow-y-auto pb-4 no-scrollbar">
        {/* Sender Address */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="sender-address" className="text-[13px] font-bold text-black tracking-wide">Sender Details</label>
            {config.autoPopulate && (
              <span className="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-100">SUGGESTED</span>
            )}
          </div>

          <div className="relative">
            <div className={`flex items-center rounded-[16px] px-4 h-[52px] border-2 transition-colors bg-gray-50 ${senderError ? 'border-red-500' : senderFocused ? 'border-black' : config.autoPopulate ? 'border-green-500' : 'border-transparent'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 mr-3 flex-shrink-0" aria-hidden>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                id="sender-address"
                type="text"
                inputMode="text"
                autoComplete="off"
                value={senderAddress}
                onChange={(e) => handleSenderChange(e.target.value)}
                onFocus={() => setSenderFocused(true)}
                onBlur={() => { setSenderFocused(false); setSenderTouched(true) }}
                placeholder="Enter sender address"
                aria-invalid={senderError}
                aria-describedby={senderError ? 'sender-error' : undefined}
                data-testid="input-sender-address"
                className="flex-1 bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-400"
              />
            </div>

            {suggestionMatches.length > 0 && (
              <ul role="listbox" aria-label="Address suggestions" className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-[14px] shadow-lg border border-gray-100 overflow-hidden" data-testid="sender-suggestions">
                {suggestionMatches.map((s) => (
                  <li key={s} role="option" aria-selected={false}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handlePickSuggestion(s)} data-testid="sender-suggestion-item" className="w-full text-left px-4 py-3 text-[14px] text-black hover:bg-gray-50 flex items-center gap-2">
                      <span aria-hidden>📍</span> {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {config.autoPopulate && config.addressSublabel && !senderFocused && (
            <p className="mt-1.5 text-[12px] text-gray-400 pl-1">{config.addressSublabel}</p>
          )}

          {senderError && (
            <p id="sender-error" data-testid="sender-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-red-600 pl-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Enter a valid street address (e.g. 100 Rue Saint-Laurent).
            </p>
          )}
        </div>

        {/* Recipient Address */}
        <div className="mb-8">
          <label htmlFor="recipient-address" className="text-[13px] font-bold text-black tracking-wide mb-2 block">Recipient Details</label>

          {selectedRecipientId ? (
            <div className="flex items-center justify-between rounded-[16px] px-4 h-[56px] border-2 border-black bg-gray-50" data-testid="recipient-selected">
              <div className="flex items-center min-w-0">
                <span aria-hidden className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-[12px] mr-3 flex-shrink-0">✓</span>
                <span className="text-[14px] font-semibold text-black truncate">{recipientAddress}</span>
              </div>
              <button type="button" onClick={handleChangeRecipient} data-testid="btn-change-recipient" className="text-[13px] font-bold text-blue-600 flex-shrink-0 ml-3 active:scale-95">Change</button>
            </div>
          ) : (
            <div className={`flex items-center rounded-[16px] px-4 h-[52px] border-2 transition-colors bg-gray-50 ${recipientError ? 'border-red-500' : 'border-transparent focus-within:border-black'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black mr-3 flex-shrink-0" aria-hidden>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                id="recipient-address"
                ref={recipientInputRef}
                type="text"
                autoComplete="off"
                value={recipientAddress}
                onChange={(e) => handleRecipientChange(e.target.value)}
                onBlur={() => setRecipientTouched(true)}
                placeholder="Enter recipient address"
                aria-invalid={recipientError}
                aria-describedby={recipientError ? 'recipient-error' : undefined}
                data-testid="input-recipient-address"
                className="flex-1 bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-400"
              />
            </div>
          )}

          {recipientError && (
            <p id="recipient-error" data-testid="recipient-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-red-600 pl-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Choose a saved address or enter a valid recipient address.
            </p>
          )}

          {/* Saved / recent places */}
          {!selectedRecipientId && (
            <div className="mt-4 space-y-1">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 mb-1">Saved &amp; recent</p>
              {SAVED_ADDRESSES.map((addr) => (
                <button key={addr.id} type="button" onClick={() => handleSelectSaved(addr)} data-testid={`saved-address-${addr.id}`} className="w-full flex items-center text-left active:opacity-60 transition-opacity py-2">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-[14px] flex-shrink-0">{addr.icon}</div>
                  <div className="flex-1 border-b border-gray-100 pb-3">
                    <div className="font-bold text-[15px] flex items-center mb-0.5 text-black">{addr.name}{addr.tag && <span className="ml-2 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{addr.tag}</span>}</div>
                    <div className="text-[13px] text-gray-500">{addr.detail}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pickup Options */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
               <h2 className="text-[13px] font-bold text-black tracking-wide">
                 {config.listUI === 'categorized-by-destination' ? 'Choose by Destination' : 'Select Service'}
               </h2>
          </div>
          
          <div className="space-y-3">
              {config.pickupOptions.map((option) => (
                  <div 
                      key={option.id}
                      onClick={() => handleOptionSelect(option.id, option.label)}
                      className={`flex items-center justify-between p-4 rounded-[16px] border-2 cursor-pointer transition-all active:scale-[0.98] ${selectedOption === option.id ? 'border-black bg-gray-50' : 'border-transparent bg-gray-50'}`}
                      data-testid={`pickup-option-${option.id}`}
                  >
                      <div className="flex items-center">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${selectedOption === option.id ? 'border-black' : 'border-gray-300'}`}>
                              {selectedOption === option.id && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                          </div>
                          <span className="font-bold text-[15px]">{option.label}</span>
                      </div>
                      <span className="font-bold text-[15px]">${option.price}</span>
                  </div>
              ))}
          </div>
        </div>

        {/* Item Types */}
        <div className="mb-8">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-3">What are you sending?</h2>
          <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
              <div className="bg-black text-white px-5 py-2.5 rounded-[12px] text-[13px] font-bold flex items-center shadow-md whitespace-nowrap active:scale-95 transition-transform">
                  <span className="mr-2">📦</span> Package
              </div>
               <div className="bg-white border border-gray-200 text-black px-5 py-2.5 rounded-[12px] text-[13px] font-bold flex items-center shadow-sm whitespace-nowrap active:scale-95 transition-transform">
                  <span className="mr-2">🔑</span> Keys
              </div>
               <div className="bg-white border border-gray-200 text-black px-5 py-2.5 rounded-[12px] text-[13px] font-bold flex items-center shadow-sm whitespace-nowrap active:scale-95 transition-transform">
                  <span className="mr-2">📄</span> Documents
              </div>
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <div className="sticky bottom-[70px] w-full px-4 pb-4 pt-4 bg-gradient-to-t from-white via-white to-transparent z-10">
          <button
            onClick={handleConfirm}
            data-testid="btn-confirm-pickup"
            className="w-full h-[54px] rounded-[16px] font-bold text-[17px] shadow-lg transition-all active:scale-[0.97] flex items-center justify-center bg-black text-white hover:bg-gray-900"
          >
            Confirm Pickup
          </button>
      </div>

      <BottomNav />
    </div>
  )
    }
