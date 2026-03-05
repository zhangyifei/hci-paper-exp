import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'
import { enterScreen } from '@/lib/screen-tracker'

const WAIT_MS = 2500

interface CourierDeliveryScreenProps {
  onNext: () => void
}

export default function CourierDeliveryScreen({ onNext }: CourierDeliveryScreenProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    logger.trackEvent('service2.task.started', 'service2', 'service2_task_active')
    const cleanupScreen = enterScreen('service2_delivery', 'service2')

    const start = performance.now()
    const frame = () => {
      const elapsed = performance.now() - start
      const pct = Math.min(elapsed / WAIT_MS, 1)
      setProgress(pct)
      if (pct < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)

    const timer = setTimeout(() => {
      logger.trackEvent('service2.task.submitting', 'service2', 'service2_task_submitting')
      onNext()
    }, WAIT_MS)
    return () => {
      clearTimeout(timer)
      cleanupScreen()
    }
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
      <h1 className="text-[28px] font-bold leading-tight mb-2 tracking-tight text-black">Your delivery is<br/>almost here</h1>
      
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
        <div className="text-[13px] text-gray-500 font-medium">Latest arrival by 10:40</div>
        <div className="text-[13px] text-gray-400 font-medium tabular-nums">{Math.max(0, Math.ceil((1 - progress) * (WAIT_MS / 1000)))}s</div>
      </div>

      {/* Map Card */}
      <div className="w-full h-[200px] bg-white rounded-[20px] mb-6 flex items-center justify-center relative overflow-hidden shadow-ios-card">
          <div className="absolute inset-0 bg-gray-100 opacity-50"></div>
          {/* Street Grid */}
          <div className="absolute top-0 left-1/3 w-16 h-full bg-gray-200 transform -skew-x-12"></div>
          <div className="absolute top-1/2 left-0 w-full h-16 bg-gray-200 transform -skew-y-6"></div>
          
          <div className="text-[40px] z-10 absolute animate-[bounce-subtle_2s_infinite]">📦</div>
          <div className="text-[30px] z-10 absolute right-8 top-8 opacity-50">📍</div>
      </div>

      <div className="h-px bg-gray-200 w-full mb-6"></div>

      {/* Package Info */}
      <div className="bg-white rounded-[20px] p-4 shadow-sm active:scale-[0.98] transition-transform mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center mr-3 text-2xl border border-gray-100 relative">
               📦
               <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-full text-white text-[10px] flex items-center justify-center font-bold">1</div>
            </div>
            <div>
              <div className="font-bold text-[17px] text-black">Package 01</div>
              <div className="text-[13px] text-gray-500 font-medium">White Honda Civic • 7EL005</div>
            </div>
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-2 space-y-5 opacity-0 animate-[fade-in_0.5s_ease-out_0.3s_forwards]">
        <div className="flex items-start">
           <div className="w-2 h-2 bg-black rounded-full mt-2 mr-4"></div>
           <div>
            <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wide mb-0.5">Drop off</div>
            <div className="text-[15px] font-medium text-black">Spot-01, Rue McGill</div>
          </div>
        </div>
        <div className="flex items-start">
           <div className="w-2 h-2 bg-gray-300 rounded-full mt-2 mr-4"></div>
           <div>
            <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wide mb-0.5">Address</div>
            <div className="text-[15px] font-medium text-gray-400">100 Rue McGill</div>
          </div>
        </div>
      </div>

    </div>
  )
}
