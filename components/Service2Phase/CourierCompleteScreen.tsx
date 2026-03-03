import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'
import { ConditionConfig } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'

interface CourierCompleteScreenProps {
  config: ConditionConfig
  onNext: () => void
}

const NEARBY = [
  {
    name: 'Souvlaki Bar',
    image: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=400&q=75',
    sub: '$0.99 Delivery Fee',
    subColor: 'text-gray-500',
  },
  {
    name: 'Pop-Pop',
    image: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=75',
    sub: 'Buy 1, Get 1 Free',
    subColor: 'text-green-600 font-bold',
  },
  {
    name: 'Burger House',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=75',
    sub: 'Free Delivery',
    subColor: 'text-gray-500',
  },
]

export default function CourierCompleteScreen({ config, onNext }: CourierCompleteScreenProps) {
  useEffect(() => {
    logger.trackEvent('service2.complete.viewed', 'service2', 'service2_task_complete')
  }, [])

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in overflow-hidden">
      <StatusBar />

      {/* Hero image — package at door */}
      <div className="relative w-full h-[260px] flex-shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white" />

        {/* Close button */}
        <button
          onClick={onNext}
          className="absolute top-[68px] left-5 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Success badge on image */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-xl mb-2 animate-[scale-in_0.4s_ease-out]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-[28px] font-bold tracking-tight text-black">Delivery Complete</h1>
          <p className="text-gray-500 text-[15px] mt-1">Package delivered at 10:15 AM</p>
        </div>

        {/* Destination Info Card */}
        <div className="bg-gray-50 rounded-[16px] p-5 mb-6 border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Delivered to</div>
              <div className="font-bold text-[17px] text-black">Rue Saint-Laurent</div>
            </div>
            <div className="font-bold text-[17px] text-black">$14.75</div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-green-500 h-1.5 rounded-full w-full"></div>
          </div>
        </div>

        {/* Proof of delivery photo strip */}
        <div className="mb-6">
          <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wide mb-2">Proof of delivery</div>
          <div className="flex space-x-3">
            <div className="w-[100px] h-[80px] rounded-[12px] overflow-hidden relative flex-shrink-0 border border-gray-100 shadow-sm">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=300&q=75')" }}
              />
            </div>
            <div className="w-[100px] h-[80px] rounded-[12px] overflow-hidden relative flex-shrink-0 border border-gray-100 shadow-sm">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=300&q=75')" }}
              />
            </div>
            <div className="flex-1 h-[80px] bg-gray-50 rounded-[12px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className="text-[10px] font-medium mt-1">+2 more</span>
            </div>
          </div>
        </div>

        {/* G2 Only: Popular nearby */}
        {config.autoPopulate && (
          <div className="mb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="font-bold text-[19px] tracking-tight text-black">Popular nearby</h2>
              <span className="text-gray-400 text-lg font-bold">→</span>
            </div>

            <div
              className="flex overflow-x-auto space-x-4 no-scrollbar pb-2"
              style={{ touchAction: 'pan-x' }}
            >
              {NEARBY.map((r) => (
                <div
                  key={r.name}
                  className="min-w-[180px] flex-shrink-0 h-[150px] bg-white rounded-[16px] border border-gray-100 shadow-ios-card active:scale-[0.98] transition-transform relative overflow-hidden"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${r.image}')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="font-bold text-[14px] text-white mb-0.5">{r.name}</div>
                    <div className={`text-[11px] font-medium ${r.subColor === 'text-green-600 font-bold' ? 'text-green-400 font-bold' : 'text-white/70'}`}>{r.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done button */}
        <div className="mt-auto pt-2">
          <button
            onClick={onNext}
            data-testid="btn-delivery-complete"
            className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] shadow-lg active:scale-[0.97] hover:bg-gray-900 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
