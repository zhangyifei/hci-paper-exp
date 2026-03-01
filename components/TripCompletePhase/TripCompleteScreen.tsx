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
    <div className="relative w-full min-h-full bg-white flex flex-col pt-[59px] pb-8 px-5 animate-fade-in">
      <StatusBar />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={handleBackToHome}
          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-90 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="font-semibold text-[13px] bg-gray-100 rounded-full px-4 py-1.5 active:bg-gray-200 transition-colors">Help</div>
      </div>

      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-[scale-in_0.4s_ease-out]">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
             <polyline points="20 6 9 17 4 12"></polyline>
           </svg>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight text-black">Trip Complete</h1>
        <p className="text-gray-500 text-[15px]">You arrived at 10:15 AM</p>
      </div>

      {/* Destination Info Card */}
      <div className="bg-gray-50 rounded-[16px] p-5 mb-8 border border-gray-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Destination</div>
            <div className="font-bold text-[17px] text-black">Rue Saint-Laurent</div>
          </div>
          <div className="font-bold text-[17px] text-black">$28.92</div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div className="bg-green-600 h-1.5 rounded-full w-full"></div>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="w-full h-40 bg-gray-100 rounded-[20px] mb-8 relative overflow-hidden flex items-center justify-center opacity-80 grayscale">
         <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=40.714728,-73.998672&zoom=15&size=600x300&sensor=false')] bg-cover opacity-20"></div>
         <div className="text-4xl z-10 drop-shadow-md">📍</div>
      </div>

      {/* Conditional Banner - The "Super App" Cross-sell */}
      {config.banner && (
        <div 
          onClick={handleBannerClick}
          className="w-full bg-white border border-gray-200 rounded-[20px] p-5 mb-6 shadow-ios-float flex flex-col animate-[slide-in-right_0.5s_ease-out_0.2s_forwards,bounce-subtle_3s_infinite_1s] active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden"
        >
           {/* Decorative background element */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-10 -mt-10 z-0"></div>

           <div className="flex items-center mb-3 z-10">
             <div className="text-[40px] mr-4 shadow-sm rounded-full bg-white w-16 h-16 flex items-center justify-center border border-gray-50">
                {config.service2 === 'courier' ? '📦' : '🍔'}
             </div>
             <div>
               <div className="font-bold text-[17px] leading-tight mb-1 text-black">
                 {config.service2 === 'courier' ? 'Send a package nearby?' : 'Hungry? Order food now'}
               </div>
               <div className="text-[13px] text-gray-500 font-medium">
                 {config.service2 === 'courier' ? '5+ drivers available now' : 'Popular spots near you'}
               </div>
             </div>
           </div>
           
           <button
             data-testid="btn-banner-cta"
             className="w-full bg-black text-white rounded-[12px] py-3 font-bold text-[15px] shadow-md z-10"
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
          className="w-full h-[54px] bg-gray-100 text-black rounded-[16px] font-bold text-[17px] active:bg-gray-200 active:scale-[0.98] transition-all mb-4"
        >
          Done
        </button>
        
        {/* Footnote for G1/G3 */}
        {!config.banner && (
          <p className="text-center text-[13px] text-gray-400 font-medium px-8 leading-relaxed">
            Tap 'Done' to go home and start a new request.
          </p>
        )}
      </div>

    </div>
  )
}
