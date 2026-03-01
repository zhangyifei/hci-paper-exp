import React from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'

interface MapScreenProps {
  onNext: () => void
  onBack: () => void
}

export default function MapScreen({ onNext, onBack }: MapScreenProps) {
  
  const handleChoose = () => {
    logger.trackEvent('ride.confirmed', 'ride', 'ride_submitting')
    onNext()
  }

  return (
    <div className="relative w-full h-full bg-white flex flex-col">
      <StatusBar />

      {/* Header */}
      <div className="flex items-center px-4 pt-14 pb-4 bg-white shadow-sm z-10 relative">
        <button onClick={onBack} className="p-2 -ml-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <div className="ml-4 bg-gray-100 rounded-full px-4 py-2 text-sm font-semibold flex items-center">
          Home <span className="mx-2">▸</span>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="w-full h-64 bg-gray-200 relative overflow-hidden flex-shrink-0">
        <svg className="w-full h-full" preserveAspectRatio="none">
           {/* Route Line */}
           <path d="M40,200 Q150,150 300,50" stroke="black" strokeWidth="3" fill="none" strokeDasharray="8 4" />
        </svg>
        {/* Car Icon */}
        <div className="absolute left-8 bottom-12 text-2xl transform -rotate-12">🚗</div>
        {/* Pin Icon */}
        <div className="absolute right-16 top-8 text-3xl">📍</div>
      </div>

      {/* Choose a ride */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-6 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 flex flex-col">
        <h2 className="text-xl font-bold mb-4 text-center">Choose a ride</h2>
        
        <div className="space-y-3 mb-auto">
          {/* Uber X - Selected */}
          <div className="border-2 border-black rounded-xl p-3 flex items-center justify-between bg-white shadow-sm cursor-pointer relative">
            <div className="absolute -top-3 right-4 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Faster</div>
            <div className="flex items-center">
               <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-3 text-xl">🚘</div>
               <div>
                 <div className="font-bold text-lg flex items-center">Uber X <span className="ml-2 text-xs font-normal text-gray-500">8:46pm · 4 min away</span></div>
                 <div className="text-sm text-gray-500">Affordable, everyday rides</div>
               </div>
            </div>
            <div className="font-bold text-lg">$12.59</div>
          </div>

          {/* Uber Comfort */}
           <div className="border border-gray-200 rounded-xl p-3 flex items-center justify-between bg-white opacity-70">
            <div className="flex items-center">
               <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-3 text-xl">🚙</div>
               <div>
                 <div className="font-bold text-lg flex items-center">Uber Comfort <span className="ml-2 text-xs font-normal text-gray-500">8:46pm · 5 min away</span></div>
                 <div className="text-sm text-gray-500">Newer cars with extra legroom</div>
               </div>
            </div>
            <div className="font-bold text-lg">$14.33</div>
          </div>

          {/* Uber Premier */}
           <div className="border border-gray-200 rounded-xl p-3 flex items-center justify-between bg-white opacity-70">
            <div className="flex items-center">
               <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-3 text-xl">🏎️</div>
               <div>
                 <div className="font-bold text-lg flex items-center">Uber Premier <span className="ml-2 text-xs font-normal text-gray-500">8:46pm · 5 min away</span></div>
                 <div className="text-sm text-gray-500">Premium rides in high-end cars</div>
               </div>
            </div>
            <div className="font-bold text-lg">$18.11</div>
          </div>
        </div>

        {/* Button */}
        <div className="mt-4 pb-6">
           <button
            onClick={handleChoose}
            data-testid="btn-choose-uber-x"
            className="w-full h-14 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-900 transition-colors"
          >
            Choose Uber X
          </button>
        </div>
      </div>
    </div>
  )
}
