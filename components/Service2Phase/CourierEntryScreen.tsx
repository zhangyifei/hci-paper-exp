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
    <div className="relative w-full min-h-screen bg-white flex flex-col pb-[100px] animate-fade-in">
      <StatusBar />

      {/* Tab Bar */}
      <div className="flex items-center space-x-3 px-4 mt-14 mb-6 pt-2 overflow-x-auto no-scrollbar">
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Rides</div>
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Eats</div>
        <div className="bg-black text-white px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform">Courier</div>
      </div>

      <div className="px-4 overflow-y-auto pb-4 no-scrollbar">
        {/* Sender Address */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
              <h2 className="text-[13px] font-bold text-black tracking-wide">Sender Details</h2>
              {config.autoPopulate && (
                  <span className="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-100">SUGGESTED</span>
              )}
          </div>
          
          {config.autoPopulate ? (
               <div className="bg-white rounded-[16px] p-4 border border-green-500 shadow-[0_4px_12px_rgba(22,163,74,0.08)] relative active:scale-[0.99] transition-transform" data-testid="sender-address-autofilled">
                  <div className="flex items-center mb-1">
                     <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2 text-[10px] text-green-700 font-bold">✓</div>
                     <div className="font-bold text-[15px] text-black">{config.addressLabel || 'Rue Saint-Laurent - spot 01'}</div>
                  </div>
                  <div className="text-[13px] text-gray-500 font-medium pl-8">{config.addressSublabel || 'Near 100 Rue saint-LAURENT'}</div>
                  <div className="absolute top-4 right-4 text-[13px] text-green-600 font-bold cursor-pointer">Edit</div>
               </div>
          ) : (
              <div className="bg-gray-100 rounded-[16px] h-[52px] flex items-center px-4 active:bg-gray-200 transition-colors" data-testid="sender-address-empty">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 mr-3">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <span className="text-gray-500 font-medium text-[15px]">Enter sender address</span>
              </div>
          )}
        </div>

        {/* Recipient Address */}
        <div className="mb-8">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-2">Recipient Details</h2>
          <div className="bg-gray-100 rounded-[16px] h-[52px] flex items-center px-4 mb-4 active:bg-gray-200 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black mr-3">
                   <circle cx="11" cy="11" r="8"></circle>
                   <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span className="text-black font-medium text-[15px]">Enter recipient address</span>
          </div>

          {/* Saved Places */}
          <div className="space-y-4 pl-2">
              <div className="flex items-center active:opacity-60 transition-opacity cursor-pointer">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-[14px]">🕒</div>
                  <div className="flex-1 border-b border-gray-100 pb-3">
                      <div className="font-bold text-[15px] flex items-center mb-0.5">Rue McGill <span className="ml-2 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">RECENT</span></div>
                      <div className="text-[13px] text-gray-500">3008, Rue McGill, Montreal</div>
                  </div>
              </div>
               <div className="flex items-center active:opacity-60 transition-opacity cursor-pointer">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-[14px]">📍</div>
                  <div className="flex-1 border-b border-gray-100 pb-3">
                      <div className="font-bold text-[15px] mb-0.5">Saint-Louis</div>
                      <div className="text-[13px] text-gray-500">1502, Rue Saint-Louis, Montreal</div>
                  </div>
              </div>
          </div>
        </div>

        {/* Pickup Options */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
               <h2 className="text-[13px] font-bold text-black tracking-wide">Select Service</h2>
          </div>
          
          <div className="space-y-3">
              {config.pickupOptions.map((option) => (
                  <div 
                      key={option.id}
                      onClick={() => handleOptionSelect(option.id, option.label)}
                      className={`flex items-center justify-between p-4 rounded-[16px] border-2 cursor-pointer transition-all active:scale-[0.98] ${selectedOption === option.id ? 'border-black bg-gray-50' : 'border-transparent bg-gray-50'}`}
                      data-testid={`pickup-option-${option.id}`}
                  >
                      <div className="flex items-center">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${selectedOption === option.id ? 'border-black' : 'border-gray-300'}`}>
                              {selectedOption === option.id && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                          </div>
                          <span className="font-bold text-[15px]">{option.label}</span>
                      </div>
                      <span className="font-bold text-[15px]">${option.price}</span>
                  </div>
              ))}
          </div>
        </div>

        {/* Item Types */}
        <div className="mb-8">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-3">What are you sending?</h2>
          <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
              <div className="bg-black text-white px-5 py-2.5 rounded-[12px] text-[13px] font-bold flex items-center shadow-md whitespace-nowrap active:scale-95 transition-transform">
                  <span className="mr-2">📦</span> Package
              </div>
               <div className="bg-white border border-gray-200 text-black px-5 py-2.5 rounded-[12px] text-[13px] font-bold flex items-center shadow-sm whitespace-nowrap active:scale-95 transition-transform">
                  <span className="mr-2">🔑</span> Keys
              </div>
               <div className="bg-white border border-gray-200 text-black px-5 py-2.5 rounded-[12px] text-[13px] font-bold flex items-center shadow-sm whitespace-nowrap active:scale-95 transition-transform">
                  <span className="mr-2">📄</span> Documents
              </div>
          </div>
        </div>
      </div>

      {/* Confirm Button - Fixed Bottom */}
      <div className="fixed bottom-[90px] left-0 w-full px-4 z-10 pointer-events-none">
        <div className="pointer-events-auto max-w-[390px] mx-auto">
          <button
            onClick={handleConfirm}
            disabled={!selectedOption}
            data-testid="btn-confirm-pickup"
            className={`w-full h-[54px] rounded-[16px] font-bold text-[17px] shadow-lg transition-all active:scale-[0.97] flex items-center justify-center ${selectedOption ? 'bg-black text-white hover:bg-gray-900' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}
          >
            Confirm Pickup
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
    }
