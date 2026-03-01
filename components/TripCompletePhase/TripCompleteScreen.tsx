import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'
import { Condition, ConditionConfig } from '@/lib/experiment-config'

interface TripCompleteScreenProps {
  condition: Condition
  config: ConditionConfig
  onNext: () => void
}

export default function TripCompleteScreen({ condition, config, onNext }: TripCompleteScreenProps) {
  
  useEffect(() => {
    logger.trackEvent('trip_complete.viewed', 'trip_complete', 'trip_complete_confirmed')
  }, [])

  const handleBannerClick = () => {
    logger.trackEvent('trip_complete.banner_tapped', 'trip_complete', 'trip_complete_confirmed', { payload: { cta: config.bannerCTA } })
    onNext()
  }

  const handleBackToHome = () => {
    // In this experiment flow, "Back to Home" advances to the next phase (Service 2)
    onNext()
  }

  return (
    <div className="relative w-full h-full bg-white flex flex-col px-4 pt-12 pb-6">
      <StatusBar />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button className="p-2 -ml-2 text-2xl">✕</button>
        <div className="font-semibold text-sm bg-gray-100 rounded-full px-3 py-1">Help</div>
      </div>

      <h1 className="text-3xl font-bold mb-6">Trip Complete 🎉</h1>

      {/* Destination Info */}
      <div className="flex justify-between items-center mb-4">
        <div className="font-bold text-lg">Destination: Rue Saint-Laurent</div>
        <div className="font-bold text-lg">$28.92</div>
      </div>

      {/* Progress Bar (Completed) */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6 overflow-hidden">
        <div className="bg-green-600 h-1.5 rounded-full w-full"></div>
      </div>

      {/* Map Placeholder */}
      <div className="w-full h-48 bg-gray-200 rounded-xl mb-6 relative overflow-hidden flex items-center justify-center">
         <div className="absolute inset-0 bg-gray-100 opacity-50"></div>
         <div className="text-4xl z-10">🛑</div>
      </div>

      {/* Conditional Banner */}
      {config.banner && (
        <div className="w-full bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex items-center justify-between animate-in slide-in-from-bottom-4 fade-in duration-700">
           <div className="flex items-center flex-1">
             <div className="text-4xl mr-3">{config.service2 === 'courier' ? '📦' : '🍽️'}</div>
             <div>
               <div className="font-bold text-sm leading-tight mb-1">{config.service2 === 'courier' ? 'Need to send package?' : 'Arrived at your destination'}</div>
               <div className="text-xs text-gray-500">{config.service2 === 'courier' ? '5+ Courier drivers available nearby' : '3+ restaurants nearby'}</div>
             </div>
           </div>
           <button
             onClick={handleBannerClick}
             data-testid="btn-banner-cta"
             className="bg-black text-white rounded-full px-5 py-2 font-bold text-sm shadow-md hover:bg-gray-800 transition-colors"
           >
             {config.bannerCTA}
           </button>
        </div>
      )}

      {/* Bottom Action */}
      <div className="mt-auto">
        <button
          onClick={handleBackToHome}
          data-testid="btn-back-to-home"
          className="w-full h-14 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-900 transition-colors mb-2"
        >
          Back to Home
        </button>
        
        {/* Footnote for G1/G3 */}
        {!config.banner && (
          <p className="text-center text-xs text-gray-400 italic">
            To continue, tap 'Back to Home' then select the service manually.
          </p>
        )}
      </div>

    </div>
  )
}
