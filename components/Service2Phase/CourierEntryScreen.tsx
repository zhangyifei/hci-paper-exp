import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import { logger } from '@/lib/logger'
import { markService2Entry, markService2Complete } from '@/lib/timing'
import { ConditionConfig } from '@/lib/experiment-config'

interface CourierEntryScreenProps {
  config: ConditionConfig
  onNext: () => void
}

export default function CourierEntryScreen({ config, onNext }: CourierEntryScreenProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')

  useEffect(() => {
    markService2Entry()
    const eventId = logger.trackEvent('service2.entry', 'service2', 'service2_entry')
    setService2EntryEventId(eventId)
    
    // Set default option
    if (config.pickupOptions.length > 0) {
        setSelectedOption(config.pickupOptions[0].id)
    }
  }, [config.pickupOptions])

  const handleOptionSelect = (id: string, label: string) => {
    setSelectedOption(id)
    logger.trackEvent('service2.option_selected', 'service2', 'service2_task_active', { payload: { optionId: id, optionLabel: label } })
  }

  const handleConfirm = () => {
    if (!selectedOption) return
    const duration = markService2Complete()
    logger.trackEvent('service2.task.complete', 'service2', 'service2_task_complete', { durationMs: duration, parentEventId: service2EntryEventId })
    onNext()
  }

  return (
    <div className="relative w-full h-full bg-white flex flex-col pb-[90px] overflow-y-auto">
      <StatusBar />

      {/* Tab Bar */}
      <div className="flex items-center space-x-2 px-4 mt-12 mb-6">
        <div className="bg-white text-gray-500 px-4 py-1.5 rounded-full text-sm font-medium">Uber</div>
        <div className="bg-white text-gray-500 px-4 py-1.5 rounded-full text-sm font-medium">Eats</div>
        <div className="bg-black text-white px-4 py-1.5 rounded-full text-sm font-medium">Courier</div>
      </div>

      {/* Sender Address */}
      <div className="px-4 mb-6">
        <div className="flex justify-between items-center mb-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sender Address</h2>
            {config.autoPopulate && (
                <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">from trip</span>
            )}
        </div>
        
        {config.autoPopulate ? (
             <div className="bg-gray-50 rounded-xl p-3 border border-green-100 relative" data-testid="sender-address-autofilled">
                <div className="font-bold text-sm text-black mb-1">{config.addressLabel || 'Rue Saint-Laurent - spot 01'}</div>
                <div className="text-xs text-green-600 font-medium">{config.addressSublabel || 'Near 100 Rue saint-LAURENT'}</div>
                <div className="absolute top-3 right-3 text-xs text-gray-400 underline cursor-pointer">[Edit]</div>
             </div>
        ) : (
            <div className="bg-gray-100 rounded-xl h-12 flex items-center px-4" data-testid="sender-address-empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 mr-3">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span className="text-gray-400">From where?</span>
            </div>
        )}
      </div>

      {/* Recipient Address */}
      <div className="px-4 mb-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recipient Address</h2>
        <div className="bg-gray-100 rounded-xl h-12 flex items-center px-4 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black mr-3">
                 <circle cx="11" cy="11" r="8"></circle>
                 <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span className="text-black font-medium">To where?</span>
        </div>

        {/* Saved Places */}
        <div className="space-y-3 pl-2">
            <div className="flex items-start border-b border-gray-100 pb-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3 mt-1 text-xs">🕒</div>
                <div>
                    <div className="font-bold text-sm flex items-center">Rue McGill <span className="ml-2 bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full">Recent</span></div>
                    <div className="text-xs text-gray-500">3008, Rue McGill, Montreal, Canada, H4E 2R0</div>
                </div>
            </div>
             <div className="flex items-start pb-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3 mt-1 text-xs">📍</div>
                <div>
                    <div className="font-bold text-sm">Saint-Louis</div>
                    <div className="text-xs text-gray-500">1502, Rue Saint-Louis, Montreal, Canada, H5E 2R0</div>
                </div>
            </div>
        </div>
      </div>

      {/* Pickup Options */}
      <div className="px-4 mb-6">
        <div className="flex justify-between items-center mb-3">
             <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pickup Prices</h2>
             {config.autoPopulate && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Nearby</span>}
        </div>
        
        <div className="space-y-3">
            {config.pickupOptions.map((option) => (
                <div 
                    key={option.id}
                    onClick={() => handleOptionSelect(option.id, option.label)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedOption === option.id ? 'border-black bg-gray-50 shadow-sm' : 'border-gray-200 bg-white'}`}
                    data-testid={`pickup-option-${option.id}`}
                >
                    <div className="flex items-center">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${selectedOption === option.id ? 'border-black' : 'border-gray-300'}`}>
                            {selectedOption === option.id && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                        </div>
                        <span className="font-medium">{option.label}</span>
                    </div>
                    <span className="font-bold">${option.price}</span>
                </div>
            ))}
        </div>
      </div>

      {/* Item Types */}
      <div className="px-4 mb-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Item Types</h2>
        <div className="flex space-x-3">
            <div className="bg-black text-white px-4 py-2 rounded-full text-sm font-medium flex items-center shadow-md">
                <span className="mr-2">📦</span> Package
            </div>
             <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded-full text-sm font-medium flex items-center">
                <span className="mr-2">🍔</span> Food
            </div>
             <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded-full text-sm font-medium flex items-center">
                <span className="mr-2">⚙️</span> other
            </div>
        </div>
      </div>

      {/* Confirm Button */}
      <div className="px-4 mt-auto">
        <button
          onClick={handleConfirm}
          disabled={!selectedOption}
          data-testid="btn-confirm-pickup"
          className={`w-full h-14 rounded-full font-bold text-lg transition-colors ${selectedOption ? 'bg-black text-white hover:bg-gray-900' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
        >
          Confirm pickup
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
