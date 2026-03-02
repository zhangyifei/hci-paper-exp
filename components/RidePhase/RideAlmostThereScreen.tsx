import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'

const WAIT_MS = 2500

interface RideAlmostThereScreenProps {
  onNext: () => void
}

export default function RideAlmostThereScreen({ onNext }: RideAlmostThereScreenProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const frame = () => {
      const elapsed = performance.now() - start
      const pct = Math.min(elapsed / WAIT_MS, 1)
      setProgress(pct)
      if (pct < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)

    const timer = setTimeout(() => {
      logger.trackEvent('ride.arrived', 'ride', 'ride_submitting')
      onNext()
    }, WAIT_MS)
    return () => clearTimeout(timer)
  }, [onNext])

  return (
    <div className="relative w-full min-h-full bg-gray-50 flex flex-col pt-[59px] pb-6 px-5 animate-fade-in">
      <StatusBar />
      
      {/* Top Row */}
      <div className="flex justify-between items-center mb-6 z-10">
        <button className="w-9 h-9 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-500 active:scale-90 transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-md rounded-full px-4 py-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer">
          <span className="text-xs font-bold text-black">Help</span>
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-[28px] font-bold leading-tight mb-2 tracking-tight text-black">Your ride is<br/>almost here</h1>
      
      {/* Arrival Time */}
      <div className="flex items-center text-[17px] font-semibold mb-6 text-gray-800">
        Arriving at 10:15 <span className="text-green-600 mx-2 text-xs">●</span> On time
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2 overflow-hidden">
        <div
          className="bg-black h-1.5 rounded-full transition-none"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="flex justify-between items-center mb-8">
        <div className="text-[13px] text-gray-500 font-medium">Latest arrival by 10:20</div>
        <div className="text-[13px] text-gray-400 font-medium tabular-nums">{Math.max(0, Math.ceil((1 - progress) * (WAIT_MS / 1000)))}s</div>
      </div>

      {/* Map Card */}
      <div className="w-full h-[180px] bg-white rounded-[20px] mb-6 flex items-center justify-center relative overflow-hidden shadow-ios-card">
          <div className="absolute inset-0 bg-gray-100 opacity-50"></div>
          {/* Street Grid */}
          <div className="absolute top-0 left-1/3 w-16 h-full bg-gray-200 transform -skew-x-12"></div>
          <div className="absolute top-1/2 left-0 w-full h-16 bg-gray-200 transform -skew-y-6"></div>
          
          {/* Car moving animation */}
          <div className="text-[40px] z-10 absolute animate-[bounce-subtle_2s_infinite]">🚗</div>
          <div className="text-[30px] z-10 absolute right-8 top-8 opacity-50">📍</div>
      </div>

      <div className="h-px bg-gray-200 w-full mb-6"></div>

      {/* Driver Info Card */}
      <div className="bg-white rounded-[20px] p-4 shadow-sm active:scale-[0.98] transition-transform">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full mr-3 overflow-hidden border border-gray-100 shadow-sm relative">
              <div className="absolute inset-0 flex items-center justify-center text-2xl">👨🏻‍✈️</div>
            </div>
            <div>
              <div className="font-bold text-[17px] text-black">Jonathan <span className="text-gray-400 font-normal text-sm ml-1">• 4.9★</span></div>
              <div className="text-[13px] text-gray-500 font-medium">White Honda Civic • 7EL 005</div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-gray-50 border border-gray-100">
             <div className="text-xl">💬</div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 mt-2">
            <button className="h-[44px] bg-black text-white rounded-[12px] font-bold text-[15px] active:scale-95 transition-transform">Message</button>
            <button className="h-[44px] bg-gray-100 text-black rounded-[12px] font-bold text-[15px] active:scale-95 transition-transform">Call</button>
        </div>
      </div>

      {/* Details */}
      <div className="mt-6 px-2 space-y-4 opacity-0 animate-[fade-in_0.5s_ease-out_0.3s_forwards]">
        <div className="flex items-start">
          <div className="w-2 h-2 bg-black rounded-full mt-2 mr-4"></div>
          <div>
            <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wide mb-0.5">Pick up</div>
            <div className="text-[15px] font-medium text-black">100 Rue McGill</div>
          </div>
        </div>
        <div className="flex items-start">
           <div className="w-2 h-2 bg-black rounded-full mt-2 mr-4 opacity-30"></div>
           <div>
            <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wide mb-0.5">Drop off</div>
            <div className="text-[15px] font-medium text-gray-500">Pierre-Elliott-Trudeau Airport</div>
          </div>
        </div>
      </div>

    </div>
  )
}
