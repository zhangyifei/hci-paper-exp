import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'
import { ConditionConfig } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'
import { enterScreen } from '@/lib/screen-tracker'

interface MovieCompleteScreenProps {
  config: ConditionConfig
  onNext: () => void
}

const EXPLORE = [
  { icon: '🚕', label: 'Rides',   color: 'bg-gray-100', border: 'border-gray-200' },
  { icon: '🎬', label: 'Cinema',  color: 'bg-gray-100', border: 'border-gray-200' },
  { icon: '🕒', label: 'Reserve', color: 'bg-gray-100', border: 'border-gray-200' },
  { icon: '🚌', label: 'Transit', color: 'bg-gray-100', border: 'border-gray-200' },
]

export default function MovieCompleteScreen({ config, onNext }: MovieCompleteScreenProps) {
  useEffect(() => {
    logger.trackEvent('service2.complete.viewed', 'service2', 'service2_task_complete')
    const cleanup = enterScreen('service2_complete_movie', 'service2')
    return cleanup
  }, [])

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in overflow-hidden">
      <StatusBar />

      {/* Hero cinema image */}
      <div className="relative w-full h-[260px] flex-shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center saturate-[0.7]"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white" />
        <button
          onClick={onNext}
          className="absolute top-[68px] left-5 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-xl animate-[scale-in_0.4s_ease-out]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-[28px] font-bold tracking-tight text-black">Tickets Booked!</h1>
          <p className="text-gray-500 text-[15px] mt-1">Enjoy the movie 🍿</p>
        </div>

        {/* Ticket stub */}
        <div className="bg-gray-50 rounded-[16px] p-5 mb-6 border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Cineplex Forum</div>
              <div className="font-bold text-[17px] text-black">Skyline Runners</div>
              <div className="text-[13px] text-gray-500 mt-0.5">Today · 7:10 PM · 2 seats</div>
            </div>
            <div className="text-[40px]">🎟️</div>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3 flex justify-between items-center">
            <span className="text-[12px] text-gray-500">Booking ref</span>
            <span className="font-bold text-[15px] text-black tracking-wider">SKY-4821</span>
          </div>
        </div>

        {/* Bridge cell only: Explore More */}
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

        <button
          onClick={onNext}
          data-testid="btn-service2-done"
          className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] active:scale-[0.98] transition-all"
        >
          Done
        </button>
      </div>
    </div>
  )
}
