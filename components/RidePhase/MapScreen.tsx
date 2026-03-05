import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'
import { enterScreen } from '@/lib/screen-tracker'

interface MapScreenProps {
  onNext: () => void
  onBack: () => void
}

export default function MapScreen({ onNext, onBack }: MapScreenProps) {

  useEffect(() => {
    logger.trackEvent('ride.option_selected', 'ride', 'ride_in_progress', { payload: { optionId: 'voya-x', optionLabel: 'Voya X', price: 12.59 } })
    const cleanup = enterScreen('map', 'ride')
    return cleanup
  }, [])
  
  const handleChoose = () => {
    logger.trackEvent('ride.confirmed', 'ride', 'ride_submitting')
    onNext()
  }

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-slide-in-right">
      <StatusBar />

      {/* Header - Floating with blur */}
      <div className="absolute top-[62px] left-4 z-30">
        <button 
          onClick={onBack} 
          className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-md flex items-center justify-center active:scale-90 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
      </div>

      {/* Map — real satellite-style photo */}
      <div className="w-full h-[280px] relative overflow-hidden flex-shrink-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1476973422084-e0fa66ff9456?auto=format&fit=crop&w=800&q=80')" }}
        />
        <div className="absolute inset-0 bg-black/10" />
        {/* Route overlay */}
        <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none">
          <path d="M-10,260 Q150,200 390,90" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M-10,260 Q150,200 390,90" stroke="#1f1f1f" strokeWidth="3" fill="none" strokeDasharray="10 7" strokeLinecap="round" />
        </svg>
        {/* Car Icon */}
        <div className="absolute left-[18%] bottom-[28%] z-10">
          <div className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-xl transform -rotate-12">🚗</div>
        </div>
        {/* Destination Pin */}
        <div className="absolute right-[18%] top-[22%] z-10">
          <div className="w-10 h-10 bg-black rounded-full shadow-lg flex items-center justify-center text-xl animate-bounce-subtle">📍</div>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className="bg-white rounded-t-[20px] -mt-6 pt-3 px-4 pb-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-20 flex flex-col">
        {/* Drag Handle */}
        <div className="w-9 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>

        <h2 className="text-[20px] font-bold mb-4 text-center tracking-tight">Choose a ride</h2>
        
        <div className="space-y-2">
          {/* Voya X — Selected */}
          <div className="border-[2px] border-black rounded-[12px] p-3 pr-4 flex items-center justify-between bg-white shadow-sm cursor-pointer relative active:scale-[0.98] transition-all">
            <div className="absolute -top-2.5 right-4 bg-[#1f1f1f] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">Faster</div>
            <div className="flex items-center">
              <div className="w-[54px] h-[40px] relative overflow-hidden rounded-lg mr-2 flex-shrink-0">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1485291571150-772bcfc10da5?auto=format&fit=crop&w=200&q=80')" }}
                />
              </div>
              <div>
                <div className="font-bold text-[17px] flex items-center leading-tight">Voya X <span className="ml-2 text-[12px] font-normal text-gray-500">8:46 PM</span></div>
                <div className="text-[13px] text-gray-500 mt-0.5">Affordable, everyday rides</div>
              </div>
            </div>
            <div className="font-bold text-[17px]">$12.59</div>
          </div>

          {/* Comfort */}
          <div className="border border-gray-100 rounded-[12px] p-3 pr-4 flex items-center justify-between bg-white active:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer">
            <div className="flex items-center">
              <div className="w-[54px] h-[40px] relative overflow-hidden rounded-lg mr-2 flex-shrink-0 grayscale opacity-80">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=200&q=80')" }}
                />
              </div>
              <div>
                <div className="font-bold text-[17px] flex items-center leading-tight">Comfort <span className="ml-2 text-[12px] font-normal text-gray-500">8:47 PM</span></div>
                <div className="text-[13px] text-gray-500 mt-0.5">Newer cars with extra legroom</div>
              </div>
            </div>
            <div className="font-bold text-[17px]">$14.33</div>
          </div>

          {/* Premier */}
          <div className="border border-gray-100 rounded-[12px] p-3 pr-4 flex items-center justify-between bg-white active:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer">
            <div className="flex items-center">
              <div className="w-[54px] h-[40px] relative overflow-hidden rounded-lg mr-2 flex-shrink-0 grayscale opacity-80">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1563720360172-67b8f3dce741?auto=format&fit=crop&w=200&q=80')" }}
                />
              </div>
              <div>
                <div className="font-bold text-[17px] flex items-center leading-tight">Premier <span className="ml-2 text-[12px] font-normal text-gray-500">8:49 PM</span></div>
                <div className="text-[13px] text-gray-500 mt-0.5">Premium rides in high-end cars</div>
              </div>
            </div>
            <div className="font-bold text-[17px]">$18.11</div>
          </div>
        </div>

        {/* CTA */}
        <div className="w-full px-0 pb-2 pt-3 bg-white">
          <button
            onClick={handleChoose}
            data-testid="btn-choose-uber-x"
            className="w-full h-[54px] bg-black text-white rounded-[12px] font-bold text-[17px] shadow-lg active:scale-[0.97] transition-all flex items-center justify-center"
          >
            Choose Voya X
          </button>
        </div>
      </div>
    </div>
  )
}
