import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'
import { markService2Complete } from '@/lib/timing'
import { enterScreen } from '@/lib/screen-tracker'

interface EatsRestaurantScreenProps {
  onNext: () => void
  onBack: () => void
  parentEventId?: string
}

const FEATURED = [
  {
    name: 'Greek Salad',
    price: '$14.50',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=75',
  },
  {
    name: 'Chicken Pita',
    price: '$12.00',
    image: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=300&q=75',
  },
  {
    name: 'Lamb Skewer',
    price: '$16.50',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=75',
  },
]

const POPULAR = [
  {
    name: 'Chicken Souvlaki Plate',
    desc: 'Served with rice, roasted potatoes, greek salad, tzatziki and pita bread.',
    price: '$22.00',
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=200&q=70',
  },
  {
    name: 'Gyro Pita',
    desc: 'Pork or chicken gyro wrapped in pita with tomatoes, onions and tzatziki.',
    price: '$11.50',
    image: 'https://images.unsplash.com/photo-1561043433-aaf687c4cf04?auto=format&fit=crop&w=200&q=70',
  },
  {
    name: 'Spanakopita',
    desc: 'Crispy filo pastry filled with spinach, feta cheese and fresh herbs.',
    price: '$9.00',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=200&q=70',
  },
]

export default function EatsRestaurantScreen({ onNext, onBack, parentEventId }: EatsRestaurantScreenProps) {

  useEffect(() => {
    logger.trackEvent('service2.task.started', 'service2', 'service2_task_active')
    const cleanup = enterScreen('service2_restaurant', 'service2')
    return cleanup
  }, [])

  const handleOrder = () => {
    logger.trackEvent('service2.task.submitting', 'service2', 'service2_task_submitting')
    const duration = markService2Complete()
    logger.trackEvent('service2.task.complete', 'service2', 'service2_task_complete', { durationMs: duration ?? 0, parentEventId })
    onNext()
  }

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col pb-[0px] animate-fade-in">
      <StatusBar />
      
      {/* Hero Image */}
      <div className="h-[250px] relative w-full overflow-hidden flex-shrink-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
         
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

        {/* Restaurant name on hero */}
        <div className="absolute bottom-4 left-5">
          <div className="text-white font-bold text-[22px] drop-shadow-md">Souvlaki Bar</div>
          <div className="text-white/80 text-[13px] font-medium">Greek cuisine • Open until 10 PM</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[20px] -mt-4 bg-white rounded-t-[20px] relative z-10 pt-5 px-5">
          {/* Rating row */}
          <div className="flex items-center text-[15px] text-gray-500 mb-4 font-medium">
              <span className="font-bold text-black mr-2 flex items-center bg-gray-100 rounded-full px-2 py-0.5 text-[12px]">4.8 ★</span>
              <span>Greek</span>
              <span className="mx-1.5 text-gray-300">•</span>
              <span>$$</span>
              <span className="mx-1.5 text-gray-300">•</span>
              <span className="text-green-700 font-bold">Open until 10 PM</span>
          </div>
          
          {/* Delivery info bar */}
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-[12px] mb-5 border border-gray-100">
              <div>
                  <div className="text-[13px] font-bold text-black mb-0.5">Delivery: 15-25 min • $0.99</div>
                  <div className="text-[11px] text-gray-500">Latest arrival by 10:40 PM</div>
              </div>
              <div className="text-green-600 font-bold text-[13px]">Change</div>
          </div>
          
          {/* Delivery / Pickup toggle */}
          <div className="bg-gray-100 p-1 rounded-full flex w-full mb-6 relative">
              <div className="bg-white rounded-full w-1/2 py-1.5 text-[14px] font-bold shadow-sm text-center transition-all">Delivery</div>
              <div className="w-1/2 py-1.5 text-[14px] font-medium text-gray-500 text-center">Pickup</div>
          </div>

          {/* Featured Items */}
          <h2 className="font-bold text-[20px] mb-4 text-black">Featured Items</h2>
          <div
            className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar"
            style={{ touchAction: 'pan-x' }}
          >
              {FEATURED.map((item) => (
                <div key={item.name} className="min-w-[150px] flex-shrink-0 bg-white border border-gray-100 rounded-[16px] p-3 shadow-sm active:scale-95 transition-transform">
                  <div className="h-[100px] bg-gray-100 rounded-[12px] mb-3 relative overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${item.image}')` }}
                    />
                  </div>
                  <div className="font-bold text-[15px] leading-tight mb-1 text-black">{item.name}</div>
                  <div className="text-[13px] text-gray-500">{item.price}</div>
                </div>
              ))}
          </div>

          {/* Popular */}
          <h2 className="font-bold text-[20px] mb-4 mt-6 text-black">Popular</h2>
          <div className="space-y-5">
              {POPULAR.map((item) => (
                <div key={item.name} className="flex items-start justify-between active:opacity-60 transition-opacity">
                  <div className="flex-1 pr-4">
                      <div className="font-bold text-[17px] mb-1 text-black">{item.name}</div>
                      <div className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed mb-2">{item.desc}</div>
                      <div className="font-medium text-[15px] text-black">{item.price}</div>
                  </div>
                  <div className="w-[100px] h-[100px] rounded-[16px] overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 relative">
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${item.image}')` }}
                    />
                  </div>
                </div>
              ))}
          </div>
      </div>

      {/* Footer CTA */}
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
