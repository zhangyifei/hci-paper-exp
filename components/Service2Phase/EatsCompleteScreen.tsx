import React from 'react'
import StatusBar from '../shared/StatusBar'
import { ConditionConfig } from '@/lib/experiment-config'

interface EatsCompleteScreenProps {
  config: ConditionConfig
  onNext: () => void
}

export default function EatsCompleteScreen({ config, onNext }: EatsCompleteScreenProps) {
  return (
    <div className="relative w-full h-full bg-gray-50 flex flex-col overflow-hidden">
      <StatusBar />

      <div className="flex-1 flex flex-col px-4 pt-14 pb-8 overflow-y-auto overscroll-none">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 animate-fade-in">
          <button 
            onClick={onNext}
            className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform"
          >
            <span className="text-xl font-semibold">✕</span>
          </button>
          <div className="px-3 py-1 bg-gray-200/80 backdrop-blur-sm rounded-full">
            <span className="text-xs font-semibold text-gray-600">Help</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center mt-8 animate-slide-in-right">
          <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mb-6 relative">
            <span className="text-6xl z-10 animate-bounce-subtle">🛍️</span>
            <div className="absolute inset-0 border-4 border-green-500/20 rounded-full animate-ping"></div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Order Confirmed</h1>
          <p className="text-gray-500 text-center mb-12">Your food is being prepared!</p>
        </div>

        {/* G4 Only: Explore More Services */}
        {config.autoPopulate && (
          <div className="mb-8 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-300">
            <h2 className="font-bold text-xl mb-4 px-1">Explore More</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: "🚘", label: "Ride", color: "bg-blue-50" },
                { icon: "📦", label: "Package", color: "bg-orange-50" },
                { icon: "🥕", label: "Grocery", color: "bg-green-50" },
                { icon: "🍔", label: "Eats", color: "bg-red-50" }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center space-y-2 group active:scale-95 transition-transform">
                  <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-black/5`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-medium text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Action */}
        <div className="mt-auto pt-8 animate-fade-in delay-500">
          <button
            onClick={onNext}
            data-testid="btn-enjoy-complete"
            className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-lg shadow-black/10 active:scale-[0.98] transition-all flex items-center justify-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
