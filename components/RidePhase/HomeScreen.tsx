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
    <div className="relative w-full h-full bg-white flex flex-col pb-[90px]">
      <StatusBar />
      
      {/* Tab Bar */}
      <div className="flex items-center space-x-2 px-4 mt-12 mb-4">
        <div className="bg-black text-white px-4 py-1.5 rounded-full text-sm font-medium">Uber</div>
        <div className="bg-white text-gray-500 px-4 py-1.5 rounded-full text-sm font-medium">Eats</div>
        <div className="bg-white text-gray-500 px-4 py-1.5 rounded-full text-sm font-medium">Courier</div>
      </div>

      {/* Search Bar */}
      <div className="px-4 mb-6">
        <div className="bg-gray-100 rounded-full h-12 flex items-center px-4 justify-between">
          <div className="flex items-center space-x-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span className="text-lg font-semibold text-black">Where to?</span>
          </div>
          <div className="bg-white rounded-full px-3 py-1 text-xs font-semibold shadow-sm flex items-center">
            <span className="mr-1">•</span> Now ▾
          </div>
        </div>
      </div>

      {/* Suggestions Section */}
      <div className="px-4 mb-4 flex justify-between items-center">
        <h2 className="font-bold text-lg">Suggestions</h2>
        <span className="text-gray-400">See all</span>
      </div>

      {/* Icon Row */}
      <div className="flex justify-between px-6 mb-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="black">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-5h14v5z"/>
              <circle cx="7.5" cy="14.5" r="1.5"/>
              <circle cx="16.5" cy="14.5" r="1.5"/>
            </svg>
          </div>
          <span className="text-xs font-medium">Ride</span>
        </div>
        <div className="flex flex-col items-center space-y-2">
          <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
              <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
            </svg>
          </div>
          <span className="text-xs font-medium">Package</span>
        </div>
        <div className="flex flex-col items-center space-y-2">
          <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
              <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z"/>
            </svg>
          </div>
          <span className="text-xs font-medium">Grocery</span>
        </div>
        <div className="flex flex-col items-center space-y-2">
          <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="black">
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
            </svg>
          </div>
          <span className="text-xs font-medium">Food</span>
        </div>
      </div>

      {/* Order Uber Eats Again */}
      <div className="px-4 mb-4 flex justify-between items-center">
        <h2 className="font-bold text-lg">Order Uber Eats again</h2>
        <span className="text-gray-400">→</span>
      </div>

      {/* Cards Scroll */}
      <div className="flex overflow-x-auto px-4 space-x-4 mb-auto no-scrollbar pb-4">
        <div className="min-w-[200px] h-[140px] bg-white rounded-xl border border-gray-100 p-3 flex flex-col justify-end shadow-sm relative">
           <div className="absolute top-3 left-3 bg-gray-200 w-12 h-12 rounded-full flex items-center justify-center text-xl">🥙</div>
           <div className="font-bold text-sm">Souvlaki Bar</div>
           <div className="text-xs text-gray-500">$0.99 Delivery Fee</div>
        </div>
        <div className="min-w-[200px] h-[140px] bg-white rounded-xl border border-gray-100 p-3 flex flex-col justify-end shadow-sm relative">
           <div className="absolute top-3 left-3 bg-gray-200 w-12 h-12 rounded-full flex items-center justify-center text-xl">🍿</div>
           <div className="font-bold text-sm">Pop-Pop</div>
           <div className="text-xs text-green-600 font-semibold">Buy 1, Get 1 Free</div>
        </div>
      </div>

      {/* Start Ride Button */}
      <div className="px-4 pb-4">
        <button
          onClick={onNext}
          data-testid="btn-start-ride"
          className="w-full h-14 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-900 transition-colors"
        >
          Start a Ride
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
