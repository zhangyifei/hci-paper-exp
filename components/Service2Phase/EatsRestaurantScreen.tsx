import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'
import { markService2Complete } from '@/lib/timing'

interface EatsRestaurantScreenProps {
  onNext: () => void
  onBack: () => void
  parentEventId?: string
}

export default function EatsRestaurantScreen({ onNext, onBack, parentEventId }: EatsRestaurantScreenProps) {

  const handleOrder = () => {
    const duration = markService2Complete()
    logger.trackEvent('service2.task.complete', 'service2', 'service2_task_complete', { durationMs: duration, parentEventId })
    onNext()
  }

  return (
    <div className="relative w-full h-full bg-white flex flex-col pb-[90px] overflow-y-auto">
      <StatusBar />
      
      {/* Header Image */}
      <div className="h-48 bg-green-100 relative w-full">
         <div className="absolute inset-0 flex items-center justify-center text-8xl opacity-20">🥙</div>
         <button onClick={onBack} className="absolute top-12 left-4 p-2 bg-white rounded-full shadow-md z-10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
         </button>
      </div>

      {/* Info */}
      <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="text-2xl font-bold mb-1">Souvlaki Bar</h1>
          <div className="flex items-center text-sm text-gray-500 mb-2">
              <span className="font-bold text-black mr-1">★ 4.6 (5,000+)</span>
              <span className="mr-1">•</span> Greek <span className="mr-1">•</span> $$
          </div>
          <div className="text-xs text-gray-500 mb-3">
              $0.99 Delivery Fee • $2.50–$6.50 Service Fee • <span className="text-yellow-600 font-bold">🔶 Uber One</span>
          </div>
          
          <div className="bg-gray-100 rounded-full p-1 flex mb-3">
              <div className="bg-white rounded-full px-6 py-1.5 text-sm font-bold shadow-sm flex-1 text-center">Delivery</div>
              <div className="px-6 py-1.5 text-sm font-medium text-gray-500 flex-1 text-center">Pickup</div>
          </div>
          
          <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                 <div>
                     <div className="font-bold text-sm">37 min</div>
                     <div className="text-xs text-gray-400">Earliest arrival</div>
                 </div>
              </div>
              <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-black">Group order</div>
          </div>
      </div>

      {/* Promo */}
      <div className="px-4 py-4 border-b border-gray-100">
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex justify-between items-center mb-2">
              <div className="text-green-800 font-bold text-sm">$0 Delivery Fee + 5% off with Uber One</div>
              <div className="text-xl">🏷️</div>
          </div>
          <div className="text-xs text-gray-400 text-center">Try free for 5 months</div>
      </div>

      {/* Menu */}
      <div className="px-4 py-6">
          <h2 className="font-bold text-lg mb-4">Order again</h2>
          <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
              <div className="min-w-[140px] bg-white border border-gray-100 rounded-xl p-2 shadow-sm">
                  <div className="h-24 bg-gray-100 rounded-lg mb-2 relative">
                      <div className="absolute inset-0 flex items-center justify-center text-3xl">🥗</div>
                  </div>
                  <div className="font-bold text-sm truncate">Greek Salad</div>
                  <div className="text-xs text-gray-500">$14.50</div>
              </div>
               <div className="min-w-[140px] bg-white border border-gray-100 rounded-xl p-2 shadow-sm">
                  <div className="h-24 bg-gray-100 rounded-lg mb-2 relative">
                      <div className="absolute inset-0 flex items-center justify-center text-3xl">🥙</div>
                  </div>
                  <div className="font-bold text-sm truncate">Chicken Pita</div>
                  <div className="text-xs text-gray-500">$12.00</div>
              </div>
          </div>

          <h2 className="font-bold text-lg mb-4 mt-2">Featured items</h2>
          <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex-1 pr-4">
                      <div className="font-bold text-base mb-1">Chicken Souvlaki Plate</div>
                      <div className="text-xs text-gray-500 line-clamp-2">Served with rice, roasted potatoes, greek salad, tzatziki and pita bread.</div>
                      <div className="font-medium text-sm mt-2">$22.00</div>
                  </div>
                  <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-4xl">🍗</div>
              </div>
               <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex-1 pr-4">
                      <div className="font-bold text-base mb-1">Gyro Pita</div>
                      <div className="text-xs text-gray-500 line-clamp-2">Pork or chicken gyro wrapped in pita with tomatoes, onions and tzatziki.</div>
                      <div className="font-medium text-sm mt-2">$11.50</div>
                  </div>
                  <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-4xl">🌯</div>
              </div>
          </div>
      </div>

      {/* Footer Button */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-100 max-w-[390px] z-50">
           <button
            onClick={handleOrder}
            data-testid="btn-order-food"
            className="w-full h-14 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-900 transition-colors shadow-lg"
          >
            Order Food
          </button>
      </div>

    </div>
  )
}
