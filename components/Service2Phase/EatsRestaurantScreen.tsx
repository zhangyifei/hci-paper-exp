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
    <div className="relative w-full min-h-full bg-white flex flex-col pb-[0px] animate-fade-in">
      <StatusBar />
      
      {/* Header Image */}
      <div className="h-[250px] bg-gray-100 relative w-full overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542528180-a1208c5169a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')] bg-cover bg-center"></div>
         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
         
         <button onClick={onBack} className="absolute top-[62px] left-5 w-10 h-10 bg-white rounded-full shadow-md z-20 flex items-center justify-center active:scale-90 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
         </button>

         <div className="absolute bottom-4 right-4 flex space-x-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </div>
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                </svg>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[20px] -mt-4 bg-white rounded-t-[20px] relative z-10 pt-6 px-5">
          <h1 className="text-[26px] font-bold mb-1 tracking-tight text-black">Souvlaki Bar</h1>
          <div className="flex items-center text-[15px] text-gray-500 mb-4 font-medium">
              <span className="font-bold text-black mr-1 flex items-center bg-gray-100 rounded-full px-1.5 py-0.5 text-[12px]">4.8 ★</span>
              <span className="mr-1 ml-1">Greek</span> • <span className="mx-1">$$</span> • <span className="mx-1 text-green-700 font-bold">Open until 10 PM</span>
          </div>
          
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-[12px] mb-6">
              <div>
                  <div className="text-[13px] font-bold text-black mb-0.5">Delivery: 15-25 min • $0.99</div>
                  <div className="text-[11px] text-gray-500">Latest arrival by 10:40 PM</div>
              </div>
              <div className="text-green-600 font-bold text-[13px]">Change</div>
          </div>
          
          <div className="bg-gray-100 p-1 rounded-full flex w-full mb-8 relative">
              <div className="bg-white rounded-full w-1/2 py-1.5 text-[14px] font-bold shadow-sm text-center transition-all">Delivery</div>
              <div className="w-1/2 py-1.5 text-[14px] font-medium text-gray-500 text-center">Pickup</div>
          </div>

          <h2 className="font-bold text-[20px] mb-4 text-black">Featured Items</h2>
          <div className="flex overflow-x-auto space-x-4 pb-6 no-scrollbar clip-none">
              <div className="min-w-[150px] bg-white border border-gray-100 rounded-[16px] p-3 shadow-sm active:scale-95 transition-transform">
                  <div className="h-[100px] bg-gray-100 rounded-[12px] mb-3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-[50px]">🥗</div>
                  </div>
                  <div className="font-bold text-[15px] leading-tight mb-1 text-black">Greek Salad</div>
                  <div className="text-[13px] text-gray-500">$14.50</div>
              </div>
               <div className="min-w-[150px] bg-white border border-gray-100 rounded-[16px] p-3 shadow-sm active:scale-95 transition-transform">
                  <div className="h-[100px] bg-gray-100 rounded-[12px] mb-3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-red-100"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-[50px]">🥙</div>
                  </div>
                  <div className="font-bold text-[15px] leading-tight mb-1 text-black">Chicken Pita</div>
                  <div className="text-[13px] text-gray-500">$12.00</div>
              </div>
          </div>

          <h2 className="font-bold text-[20px] mb-4 mt-2 text-black">Popular</h2>
          <div className="space-y-6">
              <div className="flex items-start justify-between active:opacity-60 transition-opacity">
                  <div className="flex-1 pr-4">
                      <div className="font-bold text-[17px] mb-1 text-black">Chicken Souvlaki Plate</div>
                      <div className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed mb-2">Served with rice, roasted potatoes, greek salad, tzatziki and pita bread.</div>
                      <div className="font-medium text-[15px] text-black">$22.00</div>
                  </div>
                  <div className="w-[100px] h-[100px] bg-gray-100 rounded-[16px] flex items-center justify-center text-[40px] shadow-sm border border-gray-100">🍗</div>
              </div>
               <div className="flex items-start justify-between active:opacity-60 transition-opacity">
                  <div className="flex-1 pr-4">
                      <div className="font-bold text-[17px] mb-1 text-black">Gyro Pita</div>
                      <div className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed mb-2">Pork or chicken gyro wrapped in pita with tomatoes, onions and tzatziki.</div>
                      <div className="font-medium text-[15px] text-black">$11.50</div>
                  </div>
                  <div className="w-[100px] h-[100px] bg-gray-100 rounded-[16px] flex items-center justify-center text-[40px] shadow-sm border border-gray-100">🌯</div>
              </div>
          </div>
      </div>

      {/* Footer Button - Floating */}
      <div className="sticky bottom-0 w-full p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-50 pb-[34px]">
           <button
            onClick={handleOrder}
            data-testid="btn-order-food"
            className="w-full h-[54px] bg-black text-white rounded-[16px] font-bold text-[17px] hover:bg-gray-900 transition-colors shadow-lg active:scale-[0.98] flex items-center justify-between px-6"
          >
            <span className="bg-white/20 px-2 py-0.5 rounded text-[13px]">1</span>
            <span>View order</span>
            <span>$22.00</span>
          </button>
      </div>

    </div>
  )
}
