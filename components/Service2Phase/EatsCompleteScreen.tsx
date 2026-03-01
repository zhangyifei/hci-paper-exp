import React from 'react'
import StatusBar from '../shared/StatusBar'
import { ConditionConfig } from '@/lib/experiment-config'

interface EatsCompleteScreenProps {
  config: ConditionConfig
  onNext: () => void
}

export default function EatsCompleteScreen({ config, onNext }: EatsCompleteScreenProps) {
  return (
    <div className="relative w-full h-full bg-white flex flex-col px-4 pt-12 pb-6">
      <StatusBar />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button className="p-2 -ml-2 text-2xl">✕</button>
        <div className="font-semibold text-sm bg-gray-100 rounded-full px-3 py-1">Help</div>
      </div>

      <h1 className="text-3xl font-bold mb-8">Enjoy your order 🎉</h1>

      {/* Green Bag Illustration */}
      <div className="w-40 h-40 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-8 relative">
        <div className="text-6xl z-10">🛍️</div>
        <div className="absolute inset-0 border-4 border-green-50 rounded-full animate-ping opacity-20"></div>
      </div>

      {/* G4 Only: Explore More Services */}
      {config.autoPopulate && (
        <div className="mb-8 animate-in slide-in-from-bottom-4 fade-in duration-700">
           <h2 className="font-bold text-lg mb-4 text-center">Explore More Services</h2>
           <div className="flex justify-between px-2">
             <div className="flex flex-col items-center space-y-2">
               <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-xl">🚘</div>
               <span className="text-xs font-medium text-gray-500">Ride</span>
             </div>
             <div className="flex flex-col items-center space-y-2">
               <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-xl">📦</div>
               <span className="text-xs font-medium text-gray-500">Package</span>
             </div>
             <div className="flex flex-col items-center space-y-2">
               <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-xl">🥕</div>
               <span className="text-xs font-medium text-gray-500">Grocery</span>
             </div>
             <div className="flex flex-col items-center space-y-2">
               <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-xl">🍔</div>
               <span className="text-xs font-medium text-gray-500">Eat</span>
             </div>
           </div>
        </div>
      )}

      {/* Bottom Action */}
      <div className="mt-auto">
        <button
          onClick={onNext}
          data-testid="btn-enjoy-complete"
          className="w-full h-14 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-900 transition-colors"
        >
          Back to Home
        </button>
      </div>

    </div>
  )
}
