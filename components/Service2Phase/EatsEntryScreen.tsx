import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import { logger } from '@/lib/logger'
import { markService2Entry } from '@/lib/timing'
import { ConditionConfig } from '@/lib/experiment-config'

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
  }, [])

  const handleRestaurantSelect = (restaurantName: string) => {
    logger.trackEvent('service2.option_selected', 'service2', 'service2_task_active', { payload: { optionId: restaurantName, optionLabel: restaurantName } })
    onNext(service2EntryEventId)
  }

  return (
    <div className="relative w-full h-full bg-white flex flex-col pb-[90px] overflow-y-auto">
      <StatusBar />

      {/* Tab Bar */}
      <div className="flex items-center space-x-2 px-4 mt-12 mb-4">
        <div className="flex items-center space-x-1 bg-black text-white px-4 py-1.5 rounded-full text-sm font-medium">
            <span className="text-xs">🛵</span>
            <span>Eats</span>
        </div>
        <div className="bg-white text-gray-500 px-4 py-1.5 rounded-full text-sm font-medium">Eats</div>
        <div className="bg-white text-gray-500 px-4 py-1.5 rounded-full text-sm font-medium">Courier</div>
      </div>
      
      {/* Delivery Toggle */}
      <div className="px-4 mb-6">
          <div className="bg-gray-100 p-1 rounded-full flex w-fit">
              <div className="bg-white shadow-sm rounded-full px-4 py-1 text-sm font-bold text-black">Delivery</div>
              <div className="px-4 py-1 text-sm font-medium text-gray-500">Pickup</div>
          </div>
      </div>

      {/* Deliver To Section */}
      <div className="px-4 mb-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deliver to</h2>
          </div>
          
          {config.autoPopulate ? (
             <div className="bg-gray-50 rounded-xl p-3 border border-green-100 relative" data-testid="deliver-address-autofilled">
                <div className="flex items-center mb-1">
                     <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold mr-2">from trip</span>
                     <div className="font-bold text-sm text-black">Rue Saint-Laurent - spot 01</div>
                </div>
                <div className="text-xs text-green-600 font-medium pl-14">Near 100 Rue saint-LAURENT</div>
                <div className="absolute top-3 right-3 text-xs text-gray-400 underline cursor-pointer">[Edit]</div>
             </div>
          ) : (
            <div className="bg-gray-100 rounded-xl h-12 flex items-center px-4" data-testid="deliver-address-empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black mr-3">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span className="text-gray-400">Enter Address</span>
            </div>
          )}
      </div>

      {/* Restaurant List Section */}
      <div className="px-4 mb-6">
         <div className="flex justify-between items-center mb-4">
             <h2 className="font-bold text-lg flex items-center">
                 {config.listUI === 'distance-filtered' ? 'Nearby Popular' : 'Top Rate in Uber'} 
                 <span className="ml-2 text-gray-400 font-normal text-sm">see all →</span>
             </h2>
             {config.listUI === 'distance-filtered' && (
                 <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Popular</span>
             )}
         </div>

         <div className="space-y-4">
             {/* Card 1 */}
             <div onClick={() => handleRestaurantSelect('Souvlaki Bar')} className="cursor-pointer">
                 <div className="relative w-full h-40 bg-gray-200 rounded-xl mb-2 overflow-hidden">
                     <div className="absolute inset-0 flex items-center justify-center text-6xl">🥙</div>
                     <div className="absolute top-3 right-3 bg-white rounded-full p-1.5 shadow-sm">
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                             <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                         </svg>
                     </div>
                 </div>
                 <div className="flex justify-between items-start">
                     <div>
                         <div className="font-bold text-base">Souvlaki Bar</div>
                         <div className="text-sm text-gray-500 flex items-center">
                             <span className="text-black font-medium mr-1">★ 4.8</span>
                             <span className="mr-1">•</span> Greek <span className="mr-1">•</span> $$
                             {config.listUI === 'distance-filtered' && <span className="ml-2 text-xs bg-gray-100 px-1 rounded">0.9km</span>}
                         </div>
                     </div>
                     <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-500">→</div>
                 </div>
             </div>

             {/* Card 2 */}
             <div onClick={() => handleRestaurantSelect('Pop-Pop')} className="cursor-pointer">
                 <div className="relative w-full h-40 bg-gray-200 rounded-xl mb-2 overflow-hidden">
                     <div className="absolute inset-0 flex items-center justify-center text-6xl">🍿</div>
                     <div className="absolute top-3 right-3 bg-white rounded-full p-1.5 shadow-sm">
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                             <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                         </svg>
                     </div>
                 </div>
                 <div className="flex justify-between items-start">
                     <div>
                         <div className="font-bold text-base">Pop-Pop</div>
                         <div className="text-sm text-gray-500 flex items-center">
                             <span className="text-black font-medium mr-1">★ 4.2</span>
                             <span className="mr-1">•</span> Snacks <span className="mr-1">•</span> $
                             {config.listUI === 'distance-filtered' && <span className="ml-2 text-xs bg-gray-100 px-1 rounded">0.5km</span>}
                         </div>
                     </div>
                     <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-500">→</div>
                 </div>
             </div>
         </div>
         
         {/* Cuisine Filters */}
         <div className="mt-4 flex space-x-2 overflow-x-auto no-scrollbar pb-2">
             {['French', 'Chinese', 'Carribean', 'Fast Food'].map((cuisine) => (
                 <div key={cuisine} className="bg-gray-100 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap text-gray-600">
                     {cuisine}
                 </div>
             ))}
         </div>
      </div>

      <BottomNav />
    </div>
  )
}
