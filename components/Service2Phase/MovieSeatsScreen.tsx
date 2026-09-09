import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BackButton from '../shared/BackButton'
import { logger } from '@/lib/logger'
import { markService2Complete } from '@/lib/timing'
import { ConditionConfig } from '@/lib/experiment-config'
import { enterScreen } from '@/lib/screen-tracker'

interface MovieSeatsScreenProps {
  config: ConditionConfig
  onNext: () => void
  onBack: () => void
  parentEventId?: string
}

const ROWS = ['A', 'B', 'C', 'D', 'E']
const COLS = [1, 2, 3, 4, 5, 6, 7, 8]
/** Seats already taken (common across G3/G4; not a manipulation). */
const TAKEN = new Set(['A3', 'A4', 'B6', 'C1', 'D5', 'D6', 'E8'])
const REQUIRED_SEATS = 2

export default function MovieSeatsScreen({ config, onNext, onBack, parentEventId }: MovieSeatsScreenProps) {
  const [ticketType, setTicketType] = useState<string>(config.service2Options[0]?.id ?? 'standard')
  const [seats, setSeats] = useState<string[]>([])
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    logger.trackEvent('service2.package_details.viewed', 'service2', 'service2_task_active')
    const cleanup = enterScreen('service2_movie_seats', 'service2')
    return cleanup
  }, [])

  const handleTicketType = (id: string, label: string) => {
    setTicketType(id)
    logger.trackEvent('service2.item_selected', 'service2', 'service2_task_active', {
      payload: { itemType: id, itemLabel: label },
    })
  }

  const toggleSeat = (seat: string) => {
    if (TAKEN.has(seat)) return
    setSeats((prev) => {
      if (prev.includes(seat)) return prev.filter((s) => s !== seat)
      if (prev.length >= REQUIRED_SEATS) return [prev[1], seat]
      return [...prev, seat]
    })
    setShowError(false)
    logger.trackEvent('service2.option_selected', 'service2', 'service2_task_active', {
      payload: { optionId: seat, optionLabel: seat },
    })
  }

  const unitPrice = config.service2Options.find((o) => o.id === ticketType)?.price ?? 0
  const total = unitPrice * REQUIRED_SEATS

  const handleConfirm = () => {
    if (seats.length < REQUIRED_SEATS) {
      setShowError(true)
      return
    }
    logger.trackEvent('service2.task.submitting', 'service2', 'service2_task_submitting')
    const duration = markService2Complete()
    logger.trackEvent('service2.task.complete', 'service2', 'service2_task_complete', {
      durationMs: duration ?? 0,
      parentEventId,
      payload: { ticketType, seats, seatCount: seats.length },
    })
    onNext()
  }

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in" data-testid="screen-movie-seats">
      <StatusBar />
      <BackButton onClick={onBack} />

      <div className="px-5 overflow-y-auto pb-4 no-scrollbar mt-[104px]">
        <h1 className="text-[26px] font-bold tracking-tight text-black mb-1.5 leading-tight">Choose your seats</h1>
        <p className="text-[15px] text-gray-500 mb-6 leading-snug">Select {REQUIRED_SEATS} seats for the 7:10 PM showing.</p>

        {/* Ticket type */}
        <div className="mb-6">
          <h2 className="text-[14px] font-bold text-black mb-3">Ticket type</h2>
          <div className="bg-gray-100 p-1 rounded-full flex">
            {config.service2Options.map((opt) => {
              const on = ticketType === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTicketType(opt.id, opt.label)}
                  data-testid={`ticket-type-${opt.id}`}
                  aria-pressed={on}
                  className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${on ? 'bg-black text-white shadow-sm' : 'text-gray-500'}`}
                >
                  {opt.label} · ${opt.price.toFixed(2)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Screen indicator */}
        <div className="mb-4">
          <div className="mx-auto w-3/4 h-2 rounded-full bg-gradient-to-b from-gray-300 to-transparent mb-1" />
          <p className="text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest">Screen</p>
        </div>

        {/* Seat grid */}
        <div className="space-y-2 mb-6" data-testid="seat-grid">
          {ROWS.map((row) => (
            <div key={row} className="flex items-center justify-center gap-1.5">
              <span className="w-4 text-[11px] font-bold text-gray-400">{row}</span>
              {COLS.map((col) => {
                const seat = `${row}${col}`
                const taken = TAKEN.has(seat)
                const chosen = seats.includes(seat)
                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={taken}
                    onClick={() => toggleSeat(seat)}
                    data-testid={`seat-${seat}`}
                    aria-pressed={chosen}
                    aria-label={`Seat ${seat}${taken ? ' (taken)' : ''}`}
                    className={`w-7 h-7 rounded-[7px] text-[10px] font-bold transition-all active:scale-90 ${
                      taken ? 'bg-gray-200 text-gray-300 cursor-not-allowed' : chosen ? 'bg-black text-white shadow-md' : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {col}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-gray-500 mb-4">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-black inline-block" /> Selected</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Taken</span>
        </div>

        {showError && (
          <p data-testid="seat-error" role="alert" className="text-center text-[12px] font-semibold text-red-600 mb-2">Select {REQUIRED_SEATS} seats to continue.</p>
        )}
      </div>

      <div className="mt-auto px-5 pb-4 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] text-gray-500">{seats.length}/{REQUIRED_SEATS} seats · {seats.join(', ') || '—'}</span>
          <span className="font-bold text-[17px] text-black">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={handleConfirm}
          data-testid="btn-confirm-tickets"
          className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] active:scale-[0.98] transition-all"
        >
          Confirm tickets
        </button>
      </div>
    </div>
  )
}
