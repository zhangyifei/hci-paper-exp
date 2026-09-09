import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BackButton from '../shared/BackButton'
import { logger } from '@/lib/logger'
import { markService2Complete } from '@/lib/timing'
import { enterScreen } from '@/lib/screen-tracker'

interface ReturnRideConfirmScreenProps {
  onNext: () => void
  onBack: () => void
  parentEventId?: string
}

/** Optional ride preferences (common across G1/G2; not a manipulation). */
const RIDE_NOTES = [
  { id: 'quiet', label: 'Quiet ride', icon: '🤫' },
  { id: 'trunk', label: 'Trunk space', icon: '🧳' },
  { id: 'ac', label: 'Air conditioning', icon: '❄️' },
]

export default function ReturnRideConfirmScreen({ onNext, onBack, parentEventId }: ReturnRideConfirmScreenProps) {
  const [note, setNote] = useState<string>('quiet')

  useEffect(() => {
    logger.trackEvent('service2.package_details.viewed', 'service2', 'service2_task_active')
    const cleanup = enterScreen('service2_return_ride_confirm', 'service2')
    return cleanup
  }, [])

  const handleSelectNote = (id: string, label: string) => {
    setNote(id)
    logger.trackEvent('service2.item_selected', 'service2', 'service2_task_active', {
      payload: { itemType: id, itemLabel: label },
    })
  }

  const handleConfirm = () => {
    logger.trackEvent('service2.task.submitting', 'service2', 'service2_task_submitting')
    const duration = markService2Complete()
    logger.trackEvent('service2.task.complete', 'service2', 'service2_task_complete', {
      durationMs: duration ?? 0,
      parentEventId,
      payload: { ridePreference: note },
    })
    onNext()
  }

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in" data-testid="screen-return-ride-confirm">
      <StatusBar />
      <BackButton onClick={onBack} />

      <div className="px-5 overflow-y-auto pb-4 no-scrollbar mt-[104px]">
        <h1 className="text-[26px] font-bold tracking-tight text-black mb-1.5 leading-tight">Your driver is nearby</h1>
        <p className="text-[15px] text-gray-500 mb-6 leading-snug">Review the details and confirm your return ride.</p>

        {/* Driver card */}
        <div className="bg-gray-50 rounded-[16px] p-4 mb-6 border border-gray-100 flex items-center">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-[22px] mr-3 flex-shrink-0">🧑‍✈️</div>
          <div className="flex-1">
            <div className="font-bold text-[15px] text-black">Marc · Toyota Prius</div>
            <div className="text-[13px] text-gray-500">Arrives in 3 min · ⭐ 4.9</div>
          </div>
          <div className="text-[13px] font-bold text-black bg-white border border-gray-200 rounded-full px-3 py-1.5">DTL 482</div>
        </div>

        {/* Ride preferences */}
        <div className="mb-6">
          <h2 className="text-[14px] font-bold text-black mb-3">Ride preferences</h2>
          <div className="grid grid-cols-3 gap-3">
            {RIDE_NOTES.map((item) => {
              const on = note === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNote(item.id, item.label)}
                  data-testid={`ride-note-${item.id}`}
                  aria-pressed={on}
                  className={`h-[64px] rounded-[14px] text-[12px] font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${on ? 'bg-black text-white shadow-md' : 'bg-gray-50 border border-gray-200 text-black'}`}
                >
                  <span className="text-[18px]">{item.icon}</span> {item.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto px-5 pb-4">
        <button
          onClick={handleConfirm}
          data-testid="btn-confirm-return-ride"
          className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] active:scale-[0.98] transition-all"
        >
          Confirm return ride
        </button>
      </div>
    </div>
  )
}
