import React, { useEffect } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import { logger } from '@/lib/logger'

interface HomeScreenProps {
  onNext: () => void
}

export default function HomeScreen({ onNext }: HomeScreenProps) {
  useEffect(() => {
    logger.trackEvent('ride.started', 'ride', 'ride_in_progress')
  }, [])

  return (
    <div className="relative w-full min-h-full bg-[#FDFDFD] flex flex-col animate-fade-in">
      <StatusBar />
      
      {/* Tab Bar */}
      <div className="flex items-center space-x-3 px-4 mt-[59px] mb-6 pt-2 overflow-x-auto no-scrollbar">
        <div className="bg-black text-white px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform duration-200">Rides</div>
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform duration-200">Eats</div>
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform duration-200">Courier</div>
      </div>

      {/* Search Bar */}
      <div className="px-4 mb-8">
        <div className="bg-white rounded-full h-[52px] flex items-center px-4 justify-between shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-50 active:scale-[0.98] transition-transform duration-200">
          <div className="flex items-center space-x-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span className="text-[17px] font-semibold text-black">Where to?</span>
          </div>
          <div className="bg-gray-100 rounded-full px-3 py-1.5 text-xs font-bold flex items-center text-black">
            <span className="mr-1">🕒</span> Now ▾
          </div>
        </div>
      </div>

      {/* Suggestions Section */}
      <div className="px-4 mb-5 flex justify-between items-center">
        <h2 className="font-bold text-[19px] tracking-tight text-black">Suggestions</h2>
        <span className="text-gray-900 text-[15px] font-medium active:opacity-50 transition-opacity">See all</span>
      </div>

      {/* Icon Row */}
      <div className="flex justify-between px-5 mb-10">
        {[
          { label: 'Ride', icon: <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-5h14v5z"/> },
          { label: 'Package', icon: <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/> },
          { label: 'Grocery', icon: <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z"/> },
          { label: 'Food', icon: <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/> }
        ].map((item, idx) => (
          <div key={idx} className="flex flex-col items-center space-y-2 group cursor-pointer active:scale-95 transition-transform duration-200">
            <div className="w-[60px] h-[60px] bg-gray-100 rounded-[18px] flex items-center justify-center shadow-sm group-active:bg-gray-200 transition-colors">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="black">
                {item.icon}
              </svg>
            </div>
            <span className="text-[12px] font-medium text-black">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Order Uber Eats Again */}
      <div className="px-4 mb-4 flex justify-between items-center">
        <h2 className="font-bold text-[19px] tracking-tight text-black">Order Uber Eats again</h2>
        <span className="text-gray-400 font-bold text-xl">→</span>
      </div>

      {/* Cards Scroll */}
      <div className="flex overflow-x-auto px-4 space-x-4 mb-auto no-scrollbar pb-6 clip-none">
        <div className="min-w-[240px] h-[160px] bg-white rounded-xl border border-gray-100 p-4 flex flex-col justify-end shadow-ios-card active:scale-[0.98] transition-transform duration-200 relative">
           <div className="absolute top-4 left-4 bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm border border-gray-100">🥙</div>
           <div className="font-bold text-[15px] mb-0.5">Souvlaki Bar</div>
           <div className="text-xs text-gray-500 font-medium">$0.99 Delivery Fee • 15-25 min</div>
        </div>
        <div className="min-w-[240px] h-[160px] bg-white rounded-xl border border-gray-100 p-4 flex flex-col justify-end shadow-ios-card active:scale-[0.98] transition-transform duration-200 relative">
           <div className="absolute top-4 left-4 bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm border border-gray-100">🍿</div>
           <div className="font-bold text-[15px] mb-0.5">Pop-Pop</div>
           <div className="text-xs text-green-600 font-bold">Buy 1, Get 1 Free</div>
        </div>
      </div>

      {/* Start Ride Button */}
      <div className="sticky bottom-[70px] w-full px-4 pb-4 pt-4 bg-gradient-to-t from-white via-white to-transparent z-10">
          <button
            onClick={onNext}
            data-testid="btn-start-ride"
            className="w-full h-[56px] bg-black text-white rounded-[16px] font-bold text-[17px] shadow-lg active:scale-[0.97] active:bg-gray-900 transition-all duration-200 flex items-center justify-center"
          >
            Start a Ride
          </button>
      </div>

      <BottomNav />
    </div>
  )
}
