import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import BackButton from '../shared/BackButton'
import { logger } from '@/lib/logger'
import { markService2Complete } from '@/lib/timing'
import { enterScreen } from '@/lib/screen-tracker'

interface PackageDetailsScreenProps {
  onNext: () => void
  onBack: () => void
  parentEventId?: string
}

interface ItemType {
  id: string
  label: string
  icon: string
}

/** Common courier step (identical across G1 and G2); not a manipulation. */
const ITEM_TYPES: ItemType[] = [
  { id: 'package', label: 'Package', icon: '📦' },
  { id: 'keys', label: 'Keys', icon: '🔑' },
  { id: 'documents', label: 'Document', icon: '📄' },
]

const SIZES = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
]

const NOTE_MAX = 250

export default function PackageDetailsScreen({ onNext, onBack, parentEventId }: PackageDetailsScreenProps) {
  const [itemType, setItemType] = useState<string>('package')
  const [size, setSize] = useState<string>('medium')
  const [weight, setWeight] = useState<string>('')
  const [fragile, setFragile] = useState<boolean>(false)
  const [note, setNote] = useState<string>('')

  useEffect(() => {
    logger.trackEvent('service2.package_details.viewed', 'service2', 'service2_task_active')
    const cleanup = enterScreen('service2_package_details', 'service2')
    return cleanup
  }, [])

  const handleSelectItem = (id: string, label: string) => {
    setItemType(id)
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
      payload: { itemType, size, weightKg: weight.trim() || null, fragile, hasNote: note.trim().length > 0 },
    })
    onNext()
  }

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in" data-testid="screen-package-details">
      <StatusBar />
      <BackButton onClick={onBack} />

      {/* Header — Task indicator pill */}
      <div className="flex justify-center mt-[68px] mb-3">
        <span className="text-[11px] font-bold text-gray-500 tracking-widest bg-gray-100 rounded-full px-4 py-1.5 uppercase">Task 2 of 2</span>
      </div>

      <div className="px-5 overflow-y-auto pb-4 no-scrollbar">
        <h1 className="text-[28px] font-bold tracking-tight text-black mb-1.5 leading-tight">Add delivery details</h1>
        <p className="text-[15px] text-gray-500 mb-7 leading-snug">Tell us what you&apos;re sending and add any handling instructions.</p>

        {/* What are you sending? */}
        <div className="mb-6">
          <h2 className="text-[14px] font-bold text-black mb-3">What are you sending?</h2>
          <div className="grid grid-cols-3 gap-3">
            {ITEM_TYPES.map((item) => {
              const on = itemType === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectItem(item.id, item.label)}
                  data-testid={`item-type-${item.id}`}
                  aria-pressed={on}
                  className={`h-[52px] rounded-[14px] text-[14px] font-bold flex items-center justify-center active:scale-95 transition-all ${on ? 'bg-black text-white shadow-md' : 'bg-gray-50 border border-gray-200 text-black'}`}
                >
                  <span className="mr-1.5">{item.icon}</span> {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Package size */}
        <div className="mb-6">
          <h2 className="text-[14px] font-bold text-black mb-3">Package size</h2>
          <div className="bg-gray-100 p-1 rounded-full flex">
            {SIZES.map((s) => {
              const on = size === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSize(s.id)}
                  data-testid={`package-size-${s.id}`}
                  aria-pressed={on}
                  className={`flex-1 py-2 rounded-full text-[14px] font-bold transition-all ${on ? 'bg-black text-white shadow-sm' : 'text-gray-500'}`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Estimated weight */}
        <div className="mb-6">
          <label htmlFor="package-weight" className="text-[14px] font-bold text-black mb-2 block">
            Estimated weight <span className="text-gray-400 font-medium">(optional)</span>
          </label>
          <div className="flex items-center rounded-[14px] px-4 h-[52px] border-2 border-transparent bg-gray-50 focus-within:border-black transition-colors">
            <input
              id="package-weight"
              type="number"
              inputMode="decimal"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Enter weight (optional)"
              data-testid="input-package-weight"
              className="flex-1 bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-400"
            />
            <span className="text-[14px] font-medium text-gray-400 ml-2">kg</span>
          </div>
        </div>

        {/* Fragile toggle */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setFragile((f) => !f)}
            data-testid="toggle-fragile"
            aria-pressed={fragile}
            className="w-full flex items-center justify-between rounded-[14px] px-4 h-[56px] bg-gray-50 active:scale-[0.99] transition-transform"
          >
            <span className="text-[15px] font-bold text-black">Fragile item</span>
            <span className={`w-[46px] h-[28px] rounded-full flex items-center transition-colors ${fragile ? 'bg-black' : 'bg-gray-300'}`}>
              <span className={`w-[22px] h-[22px] bg-white rounded-full shadow transition-transform ${fragile ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
            </span>
          </button>
        </div>

        {/* Delivery notes */}
        <div className="mb-6">
          <label htmlFor="delivery-notes" className="text-[14px] font-bold text-black mb-2 block">
            Delivery notes <span className="text-gray-400 font-medium">(optional)</span>
          </label>
          <div className="rounded-[14px] px-4 py-3 border-2 border-transparent bg-gray-50 focus-within:border-black transition-colors">
            <textarea
              id="delivery-notes"
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any special handling or pickup details"
              data-testid="input-delivery-notes"
              className="w-full bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-400 resize-none"
            />
            <div className="text-right text-[12px] text-gray-400 font-medium">{note.length}/{NOTE_MAX}</div>
          </div>
        </div>
      </div>

      {/* Confirm Pickup */}
      <div className="sticky bottom-[70px] w-full px-5 pb-4 pt-4 bg-gradient-to-t from-white via-white to-transparent z-10">
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
