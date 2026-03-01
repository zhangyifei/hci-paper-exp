import React from 'react'
import StatusBar from '../shared/StatusBar'
import { ConditionConfig } from '@/lib/experiment-config'

interface CourierCompleteScreenProps {
  config: ConditionConfig
  onNext: () => void
}

export default function CourierCompleteScreen({ config, onNext }: CourierCompleteScreenProps) {
  return (
    <div className="relative w-full min-h-full bg-white flex flex-col pt-[59px] pb-8 px-5 animate-fade-in">
      <StatusBar />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={onNext}
          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-90 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-[scale-in_0.4s_ease-out]">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
             <polyline points="20 6 9 17 4 12"></polyline>
           </svg>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight text-black">Delivery Complete</h1>
        <p className="text-gray-500 text-[15px]">Package delivered at 10:15 AM</p>
      </div>

      {/* Destination Info Card */}
      <div className="bg-gray-50 rounded-[16px] p-5 mb-8 border border-gray-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Delivered to</div>
            <div className="font-bold text-[17px] text-black">Rue Saint-Laurent</div>
          </div>
          <div className="font-bold text-[17px] text-black">$14.75</div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div className="bg-green-600 h-1.5 rounded-full w-full"></div>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="w-full h-40 bg-gray-100 rounded-[20px] mb-8 relative overflow-hidden flex items-center justify-center opacity-80 grayscale">
         <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=40.714728,-73.998672&zoom=15&size=600x300&sensor=false')] bg-cover opacity-20"></div>
         <div className="text-4xl z-10 drop-shadow-md">🏁</div>
      </div>

      {/* G2 Only: Popular nearby */}
      {config.autoPopulate && (
        <div className="mb-6 animate-fade-in">
           <div className="flex justify-between items-center mb-4 px-1">
             <h2 className="font-bold text-[19px] tracking-tight">Popular nearby</h2>
             <span className="text-gray-400 text-lg">→</span>
           </div>
           
           <div className="flex overflow-x-auto space-x-4 no-scrollbar pb-6 px-1 clip-none">
             <div className="min-w-[200px] h-[160px] bg-white rounded-[16px] border border-gray-100 p-4 flex flex-col justify-end shadow-ios-card active:scale-[0.98] transition-transform relative">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-50 to-white opacity-50 rounded-[16px]"></div>
                <div className="absolute top-4 left-4 w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm border border-gray-50">🥙</div>
                <div className="font-bold text-[15px] relative z-10 text-black">Souvlaki Bar</div>
                <div className="text-xs text-gray-500 font-medium relative z-10">$0.99 Delivery Fee</div>
             </div>
             <div className="min-w-[200px] h-[160px] bg-white rounded-[16px] border border-gray-100 p-4 flex flex-col justify-end shadow-ios-card active:scale-[0.98] transition-transform relative">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-yellow-50 to-white opacity-50 rounded-[16px]"></div>
                <div className="absolute top-4 left-4 w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm border border-gray-50">🍿</div>
                <div className="font-bold text-[15px] relative z-10 text-black">Pop-Pop</div>
                <div className="text-xs text-green-600 font-bold relative z-10">Buy 1, Get 1 Free</div>
             </div>
           </div>
        </div>
      )}

      {/* Bottom Action */}
      <div className="mt-auto">
        <button
          onClick={onNext}
          data-testid="btn-delivery-complete"
          className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] shadow-lg active:scale-[0.97] hover:bg-gray-900 transition-all mb-4"
        >
          Done
        </button>
      </div>

    </div>
  )
      }
