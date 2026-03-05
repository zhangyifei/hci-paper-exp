import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import { logger } from '@/lib/logger'
import { markService2Entry } from '@/lib/timing'
import { ConditionConfig } from '@/lib/experiment-config'
import { enterScreen } from '@/lib/screen-tracker'

interface EatsEntryScreenProps {
  config: ConditionConfig
  onNext: (eventId: string) => void
}

export default function EatsEntryScreen({ config, onNext }: EatsEntryScreenProps) {
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')

  useEffect(() => {
    markService2Entry()
    const eventId = logger.trackEvent('service2.entry', 'service2', 'service2_entry')
    setService2EntryEventId(eventId)
    const cleanup = enterScreen('service2_entry_eats', 'service2')
    return cleanup
  }, [])

  const handleAddressEdit = () => {
    logger.trackEvent('service2.address_edited', 'service2', 'service2_task_active')
  }

  const handleRestaurantSelect = (restaurantName: string) => {
    logger.trackEvent('service2.option_selected', 'service2', 'service2_task_active', { payload: { optionId: restaurantName, optionLabel: restaurantName } })
    onNext(service2EntryEventId)
  }

  const restaurants = [
    {
      id: 'souvlaki-bar',
      name: 'Souvlaki Bar',
      image: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=600&q=80',
      rating: '4.8',
      tags: 'Greek • $$',
      time: '15-25 min',
      promo: '$0 Delivery Fee',
      promoColor: 'bg-green-600',
      distance: '0.9 km',
    },
    {
      id: 'pop-pop',
      name: 'Pop-Pop',
      image: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=600&q=80',
      rating: '4.2',
      tags: 'Snacks • $',
      time: '10-20 min',
      promo: 'Buy 1 Get 1 Free',
      promoColor: 'bg-yellow-500',
      distance: '0.5 km',
    },
    {
      id: 'burger-house',
      name: 'Burger House',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      rating: '4.5',
      tags: 'Burgers • $$',
      time: '20-30 min',
      promo: 'Free Delivery',
      promoColor: 'bg-blue-500',
      distance: '1.3 km',
    },
  ]

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in">
      <StatusBar />

      {/* Tab Bar */}
      <div className="flex items-center space-x-3 px-4 mt-[59px] mb-6 pt-2 overflow-x-auto no-scrollbar">
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Rides</div>
        <div className="bg-black text-white px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform flex items-center">
            <span className="mr-2 text-[18px]">🛵</span> Eats
        </div>
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Courier</div>
      </div>
      
      {/* Delivery Toggle */}
      <div className="px-4 mb-6 flex justify-center">
          <div className="bg-gray-100 p-1 rounded-full flex w-fit relative">
              <div className="bg-white shadow-sm rounded-full px-6 py-1.5 text-[14px] font-bold text-black z-10 transition-all" data-testid="toggle-delivery">Delivery</div>
              <div className="px-6 py-1.5 text-[14px] font-medium text-gray-500 z-10" data-testid="toggle-pickup">Pickup</div>
          </div>
      </div>

      <div className="px-4 overflow-y-auto pb-4 no-scrollbar">
          {/* Deliver To Section */}
          <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-[13px] font-bold text-black tracking-wide">Deliver to</h2>
              </div>
              
              {config.autoPopulate ? (
                 <div className="bg-white rounded-[16px] p-4 border border-green-500 shadow-[0_4px_12px_rgba(22,163,74,0.08)] relative active:scale-[0.99] transition-transform" data-testid="deliver-address-autofilled">
                    <div className="flex items-center mb-1">
                         <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold mr-2 border border-green-200">SUGGESTED</span>
                         <div className="font-bold text-[15px] text-black">{config.addressLabel || 'Rue Saint-Laurent - spot 01'}</div>
                    </div>
                    <div className="text-[13px] text-green-600 font-medium pl-20">{config.addressSublabel || 'Near 100 Rue saint-LAURENT'}</div>
                    <div className="absolute top-4 right-4 text-[13px] text-gray-400 font-bold cursor-pointer" onClick={handleAddressEdit}>Edit</div>
                 </div>
              ) : (
                <div className="bg-gray-100 rounded-[16px] h-[52px] flex items-center px-4 active:bg-gray-200 transition-colors" data-testid="deliver-address-empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black mr-3">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span className="text-gray-500 font-medium text-[15px]">Enter delivery address</span>
                </div>
              )}
          </div>

          {/* Restaurant List Section */}
          <div className="mb-6">
             <div className="flex justify-between items-center mb-4">
                 <h2 className="font-bold text-[20px] tracking-tight flex items-center text-black">
                     {config.listUI === 'distance-filtered' ? 'Nearby Popular' : 'Top Rated'} 
                 </h2>
                 <span className="text-gray-500 font-medium text-[15px]">See all</span>
             </div>

             <div className="space-y-6">
                 {restaurants.map((r) => (
                   <div
                     key={r.id}
                     onClick={() => handleRestaurantSelect(r.name)}
                     className="cursor-pointer group active:scale-[0.98] transition-transform duration-200"
                     data-testid={`restaurant-option-${r.id}`}
                   >
                     {/* Card Image */}
                     <div className="relative w-full h-[180px] bg-gray-100 rounded-[16px] mb-3 overflow-hidden shadow-sm">
                       <div
                         className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-active:scale-105"
                         style={{ backgroundImage: `url('${r.image}')` }}
                       />
                       <div className="absolute inset-0 bg-black/10" />

                       {/* Favourite */}
                       <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-sm">
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
                               <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                           </svg>
                       </div>

                       {/* Promo Tag */}
                       <div className={`absolute top-3 left-3 ${r.promoColor} text-white text-[11px] font-bold px-2 py-1 rounded-[6px] shadow-sm`}>
                          {r.promo}
                       </div>
                     </div>

                     {/* Card Meta */}
                     <div className="flex justify-between items-start px-1">
                         <div>
                             <div className="font-bold text-[17px] text-black mb-0.5">{r.name}</div>
                             <div className="text-[13px] text-gray-500 flex items-center font-medium">
                                 <div className="bg-gray-100 rounded-full px-1.5 py-0.5 text-black text-[11px] font-bold mr-2">{r.rating} ★</div>
                                 <span>{r.tags}</span>
                                 <span className="mx-1">•</span>
                                 <span>{r.time}</span>
                             </div>
                         </div>
                         {config.listUI === 'distance-filtered' && (
                           <div className="text-[12px] font-bold bg-gray-100 px-2 py-1 rounded-full text-black">{r.distance}</div>
                         )}
                     </div>
                   </div>
                 ))}
             </div>
             
             {/* Cuisine Filters — no clip-none, use touchAction for horizontal scroll */}
             <div
               className="mt-8 flex space-x-3 overflow-x-auto no-scrollbar pb-4"
               style={{ touchAction: 'pan-x' }}
             >
                 {['Fast Food', 'Asian', 'Grocery', 'Dessert', 'Healthy', 'Pizza', 'Sushi'].map((cuisine) => (
                     <div key={cuisine} className="bg-white border border-gray-200 px-4 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap text-black shadow-sm active:scale-95 transition-transform">
                         {cuisine}
                     </div>
                 ))}
             </div>
          </div>
      </div>

      <BottomNav />
    </div>
  )
}
