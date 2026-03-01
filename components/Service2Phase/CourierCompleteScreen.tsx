import React from 'react'
import StatusBar from '../shared/StatusBar'
import { ConditionConfig } from '@/lib/experiment-config'

interface CourierCompleteScreenProps {
  config: ConditionConfig
  onNext: () => void
}

export default function CourierCompleteScreen({ config, onNext }: CourierCompleteScreenProps) {
  return (
    <div className="relative w-full h-full bg-white flex flex-col px-4 pt-12 pb-6">
      <StatusBar />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button className="p-2 -ml-2 text-2xl">✕</button>
      </div>

      <h1 className="text-3xl font-bold mb-6">Delivery Complete 🎉</h1>

      {/* Destination Info */}
      <div className="flex justify-between items-center mb-4">
        <div className="font-bold text-lg">Destination: Rue Saint-Laurent</div>
        <div className="font-bold text-lg">$14.75</div>
      </div>

      {/* Progress Bar (Completed) */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-8 overflow-hidden">
        <div className="bg-green-600 h-1.5 rounded-full w-full"></div>
      </div>

      {/* Map Placeholder */}
      <div className="w-full h-48 bg-gray-200 rounded-xl mb-8 relative overflow-hidden flex items-center justify-center">
         <div className="absolute inset-0 bg-gray-100 opacity-50"></div>
         <div className="text-4xl z-10">🏁</div>
      </div>

      {/* G2 Only: Popular nearby */}
      {config.autoPopulate && (
        <div className="mb-6 animate-in slide-in-from-bottom-4 fade-in duration-700">
           <div className="flex justify-between items-center mb-3">
             <h2 className="font-bold text-lg">Popular nearby</h2>
             <span className="text-gray-400">→</span>
           </div>
           
           <div className="flex overflow-x-auto space-x-4 no-scrollbar pb-2">
             <div className="min-w-[200px] h-[140px] bg-white rounded-xl border border-gray-100 p-3 flex flex-col justify-end shadow-sm relative">
                <div className="absolute top-0 left-0 w-full h-full bg-orange-100 opacity-20 rounded-xl"></div>
                <div className="absolute top-3 left-3 w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🥙</div>
                <div className="font-bold text-sm relative z-10">Souvlaki Bar</div>
                <div className="text-xs text-gray-500 relative z-10">$0.99 Delivery Fee</div>
             </div>
             <div className="min-w-[200px] h-[140px] bg-white rounded-xl border border-gray-100 p-3 flex flex-col justify-end shadow-sm relative">
                <div className="absolute top-0 left-0 w-full h-full bg-yellow-100 opacity-20 rounded-xl"></div>
                <div className="absolute top-3 left-3 w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🍿</div>
                <div className="font-bold text-sm relative z-10">Pop-Pop</div>
                <div className="text-xs text-green-600 font-semibold relative z-10">Buy 1, Get 1 Free</div>
             </div>
           </div>
        </div>
      )}

      {/* Bottom Action */}
      <div className="mt-auto">
        <button
          onClick={onNext}
          data-testid="btn-delivery-complete"
          className="w-full h-14 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-900 transition-colors"
        >
          Back to Home
        </button>
      </div>

    </div>
  )
}
