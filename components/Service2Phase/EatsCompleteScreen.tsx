import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'
import { ConditionConfig } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'
import { enterScreen } from '@/lib/screen-tracker'

interface EatsCompleteScreenProps {
  config: ConditionConfig
  onNext: () => void
}

const EXPLORE = [
  { icon: '🚘', label: 'Ride',    color: 'bg-blue-50',   border: 'border-blue-100' },
  { icon: '📦', label: 'Courier', color: 'bg-orange-50', border: 'border-orange-100' },
  { icon: '🥕', label: 'Grocery', color: 'bg-green-50',  border: 'border-green-100' },
  { icon: '🍔', label: 'Eats',    color: 'bg-red-50',    border: 'border-red-100' },
]

export default function EatsCompleteScreen({ config, onNext }: EatsCompleteScreenProps) {
  useEffect(() => {
    logger.trackEvent('service2.complete.viewed', 'service2', 'service2_task_complete')
    const cleanup = enterScreen('service2_complete_eats', 'service2')
    return cleanup
  }, [])

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in overflow-hidden">
      <StatusBar />

      {/* Hero food image */}
      <div className="relative w-full h-[280px] flex-shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-white" />

        {/* Close + Help */}
        <button
          onClick={onNext}
          className="absolute top-[68px] left-5 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="absolute top-[68px] right-5 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-md z-10">
          <span className="text-[13px] font-bold text-black">Help</span>
        </div>

        {/* Green badge centered at bottom of image */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-xl animate-[scale-in_0.4s_ease-out]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-[28px] font-bold tracking-tight text-black">Order Confirmed!</h1>
          <p className="text-gray-500 text-[15px] mt-1">Your food is being prepared 🍽️</p>
        </div>

        {/* Order summary card */}
        <div className="bg-gray-50 rounded-[16px] p-5 mb-6 border border-gray-100">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-[10px] overflow-hidden relative mr-3 flex-shrink-0">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=150&q=70')" }}
              />
            </div>
            <div className="flex-1">
              <div className="font-bold text-[15px] text-black">Souvlaki Bar</div>
              <div className="text-[13px] text-gray-500">Chicken Souvlaki Plate × 1</div>
            </div>
            <div className="font-bold text-[15px] text-black">$22.00</div>
          </div>

          {/* Estimated arrival */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-base">🛵</span>
              </div>
              <div>
                <div className="text-[12px] text-gray-500">Estimated arrival</div>
                <div className="font-bold text-[15px] text-black">10:35 – 10:45 AM</div>
              </div>
            </div>
            <div className="text-green-600 font-bold text-[13px]">Track</div>
          </div>
        </div>

        {/* Courier progress bar */}
        <div className="bg-white border border-gray-100 rounded-[16px] p-4 mb-6 shadow-sm">
          <div className="flex justify-between text-[12px] font-bold text-gray-400 mb-3 uppercase tracking-wide">
            <span>Order placed</span>
            <span>Preparing</span>
            <span>On the way</span>
            <span>Delivered</span>
          </div>
          <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-green-500 rounded-full" style={{ width: '42%' }} />
          </div>
          <div className="flex justify-between mt-1">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full -mt-[18px]" />
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full -mt-[18px]" />
            <div className="w-2.5 h-2.5 bg-gray-200 rounded-full -mt-[18px]" />
            <div className="w-2.5 h-2.5 bg-gray-200 rounded-full -mt-[18px]" />
          </div>
        </div>

        {/* G4 Only: Explore More */}
        {config.autoPopulate && (
          <div className="mb-6 animate-fade-in">
            <h2 className="font-bold text-[19px] tracking-tight text-black mb-4">Explore More</h2>
            <div className="grid grid-cols-4 gap-3">
              {EXPLORE.map((item) => (
                <div key={item.label} className="flex flex-col items-center space-y-2 group active:scale-95 transition-transform">
                  <div className={`w-16 h-16 ${item.color} border ${item.border} rounded-2xl flex items-center justify-center text-2xl shadow-sm`}>
                    {item.icon}
                  </div>
                  <span className="text-[12px] font-medium text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done */}
        <div className="mt-auto pt-2">
          <button
            onClick={onNext}
            data-testid="btn-enjoy-complete"
            className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] shadow-lg active:scale-[0.98] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
