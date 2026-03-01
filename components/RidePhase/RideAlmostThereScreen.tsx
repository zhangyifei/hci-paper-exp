import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'

interface RideAlmostThereScreenProps {
  onNext: () => void
}

export default function RideAlmostThereScreen({ onNext }: RideAlmostThereScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onNext()
    }, 2500)
    return () => clearTimeout(timer)
  }, [onNext])

  return (
    <div className="relative w-full h-full bg-white flex flex-col pt-12 pb-6 px-4">
      <StatusBar />
      
      {/* Top Row */}
      <div className="flex justify-between items-center mb-6">
        <button className="p-2 -ml-2 text-2xl">✕</button>
        <div className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Help</span>
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-bold mb-2">Your Ride Almost there…</h1>
      
      {/* Arrival Time */}
      <div className="flex items-center text-lg font-semibold mb-4">
        Arriving at 10:15 <span className="text-green-600 mx-2 text-2xl">•</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2 overflow-hidden">
        <div className="bg-green-600 h-1.5 rounded-full w-[95%]"></div>
      </div>
      <div className="text-xs text-gray-500 mb-8">Latest arrival by 10:40</div>

      {/* Map Placeholder */}
      <div className="w-full h-40 bg-gray-200 rounded-xl mb-6 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gray-100 opacity-50"></div>
          {/* Street Grid */}
          <div className="absolute top-0 left-1/3 w-2 h-full bg-white transform -skew-x-12"></div>
          <div className="absolute top-1/2 left-0 w-full h-2 bg-white transform -skew-y-6"></div>
          <div className="text-4xl z-10">🚗</div>
      </div>

      <div className="h-px bg-gray-100 w-full mb-6"></div>

      {/* Driver Info */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gray-300 rounded-full mr-3 overflow-hidden">
            <svg className="w-full h-full text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-lg">Jonathan • 7EL005</div>
            <div className="text-sm text-gray-500">White Honda Civic</div>
          </div>
        </div>
        <div className="flex flex-col items-center">
           <div className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full mb-1">95%</div>
           <div className="text-[10px] text-gray-400">Match</div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-4">
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Pick up spot details</div>
          <div className="text-sm font-medium">Spot-01, Rue McGill, Montreal, Canada</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Address</div>
          <div className="text-sm font-medium">100 Rue McGill</div>
        </div>
      </div>

    </div>
  )
}
