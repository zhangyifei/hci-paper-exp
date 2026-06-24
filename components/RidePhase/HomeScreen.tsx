import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import { logger } from '@/lib/logger'
import { enterScreen } from '@/lib/screen-tracker'

interface HomeScreenProps {
  onNext: () => void
  service2Tab?: 'courier' | 'eats'
  onService2TabClick?: () => void
}

/** A valid address has at least one number and some letters. */
function isValidAddress(value: string): boolean {
  const v = value.trim()
  return v.length >= 5 && /\d/.test(v) && /[a-zA-Z]/.test(v)
}

interface SavedPlace {
  id: string
  name: string
  detail: string
  tag?: string
  icon: string
}

/** Selectable saved/recent destinations so participants can tap instead of
 *  typing the full address. The task destination is offered as a recent place. */
const SAVED_DESTINATIONS: SavedPlace[] = [
  { id: 'saint-catherine', name: '1000 Saint-Catherine Street West', detail: 'Downtown, Montreal', tag: 'RECENT', icon: '🕒' },
  { id: 'mcgill', name: '3008 Rue McGill', detail: 'Old Montreal', icon: '📍' },
  { id: 'saint-louis', name: '1502 Rue Saint-Louis', detail: 'Home', icon: '🏠' },
]

export default function HomeScreen({ onNext, service2Tab, onService2TabClick }: HomeScreenProps) {
  const [destination, setDestination] = useState('')
  const [focused, setFocused] = useState(false)
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    logger.trackEvent('ride.started', 'ride', 'ride_in_progress')
    const cleanup = enterScreen('home', 'ride')
    return cleanup
  }, [])

  const destinationValid = isValidAddress(destination)

  const query = destination.trim().toLowerCase()
  const suggestions = focused
    ? SAVED_DESTINATIONS.filter(
        (p) =>
          query.length === 0 ||
          p.name.toLowerCase().includes(query) ||
          p.detail.toLowerCase().includes(query),
      )
    : []

  const handleDestinationChange = (value: string) => {
    setDestination(value)
    if (showError && isValidAddress(value)) setShowError(false)
  }

  const handlePickDestination = (place: SavedPlace) => {
    setDestination(place.name)
    setFocused(false)
    setShowError(false)
    logger.trackEvent('ride.destination_selected', 'ride', 'ride_in_progress', {
      payload: { destinationId: place.id, destination: place.name },
    })
  }

  const handleStartRide = () => {
    if (!destinationValid) {
      setShowError(true)
      return
    }
    logger.trackEvent('ride.destination_entered', 'ride', 'ride_in_progress', {
      payload: { destination: destination.trim() },
    })
    onNext()
  }

  return (
    <div className="relative w-full min-h-full bg-[#FDFDFD] flex flex-col animate-fade-in">
      <StatusBar />
      
      {/* Tab Bar */}
      <div className="flex items-center space-x-3 px-4 mt-[59px] mb-6 pt-2 overflow-x-auto no-scrollbar">
        <div className="bg-black text-white px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform duration-200">Rides</div>
        <div
          onClick={service2Tab === 'eats' ? onService2TabClick : undefined}
          className={`bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform duration-200 ${service2Tab === 'eats' ? 'cursor-pointer' : ''}`}
          data-testid="tab-eats"
        >Eats</div>
        <div
          onClick={service2Tab === 'courier' ? onService2TabClick : undefined}
          className={`bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform duration-200 ${service2Tab === 'courier' ? 'cursor-pointer' : ''}`}
          data-testid="tab-courier"
        >Courier</div>
      </div>

      {/* Search Bar — destination input (tap a saved place or type) */}
      <div className="px-4 mb-8">
        <div className="relative">
          <div className={`bg-white rounded-full h-[52px] flex items-center px-4 justify-between shadow-[0_2px_12px_rgba(0,0,0,0.08)] border ${showError ? 'border-red-500' : focused ? 'border-black' : 'border-gray-50'} transition-colors duration-200`}>
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={destination}
                onChange={(e) => handleDestinationChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => { setFocused(false); setShowError(!isValidAddress(destination) && destination.length > 0) }}
                placeholder="Where to?"
                aria-label="Destination address"
                aria-invalid={showError}
                data-testid="input-destination"
                className="flex-1 min-w-0 bg-transparent outline-none text-[17px] font-semibold text-black placeholder:text-black placeholder:font-semibold"
              />
            </div>
            <div className="bg-gray-100 rounded-full px-3 py-1.5 text-xs font-bold flex items-center text-black flex-shrink-0 ml-2">
              <span className="mr-1">🕒</span> Now ▾
            </div>
          </div>

          {suggestions.length > 0 && (
            <ul role="listbox" aria-label="Saved and recent destinations" data-testid="destination-suggestions" className="absolute z-40 left-0 right-0 mt-2 bg-white rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden">
              {suggestions.map((place) => (
                <li key={place.id} role="option" aria-selected={destination === place.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePickDestination(place)}
                    data-testid={`destination-suggestion-${place.id}`}
                    className="w-full flex items-center text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-[15px] flex-shrink-0">{place.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[15px] text-black flex items-center">
                        {place.name}
                        {place.tag && <span className="ml-2 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{place.tag}</span>}
                      </div>
                      <div className="text-[13px] text-gray-500 truncate">{place.detail}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {showError && (
          <p data-testid="destination-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-red-600 pl-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Tap a saved place or enter your destination to continue.
          </p>
        )}
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
          { label: 'Courier', icon: <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/> },
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

      {/* Order Voya Eats Again */}
      <div className="px-4 mb-4 flex justify-between items-center">
        <h2 className="font-bold text-[19px] tracking-tight text-black">Order Voya Eats again</h2>
        <span className="text-gray-400 font-bold text-xl">→</span>
      </div>

      {/* Cards Scroll */}
      <div
        className="flex overflow-x-auto px-4 space-x-4 mb-auto no-scrollbar pb-6"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
      >
        {/* Souvlaki Bar */}
        <div className="min-w-[240px] flex-shrink-0 h-[160px] bg-white rounded-xl border border-gray-100 shadow-ios-card active:scale-[0.98] transition-transform duration-200 relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=480&q=75')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="font-bold text-[15px] mb-0.5 text-white">Souvlaki Bar</div>
            <div className="text-xs text-white/80 font-medium">$0.99 Delivery Fee • 15-25 min</div>
          </div>
        </div>

        {/* Pop-Pop */}
        <div className="min-w-[240px] flex-shrink-0 h-[160px] bg-white rounded-xl border border-gray-100 shadow-ios-card active:scale-[0.98] transition-transform duration-200 relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=480&q=75')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="font-bold text-[15px] mb-0.5 text-white">Pop-Pop</div>
            <div className="text-xs text-green-400 font-bold">Buy 1, Get 1 Free</div>
          </div>
        </div>

        {/* Burger House */}
        <div className="min-w-[240px] flex-shrink-0 h-[160px] bg-white rounded-xl border border-gray-100 shadow-ios-card active:scale-[0.98] transition-transform duration-200 relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=480&q=75')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="font-bold text-[15px] mb-0.5 text-white">Burger House</div>
            <div className="text-xs text-white/80 font-medium">Free Delivery • 20-30 min</div>
          </div>
        </div>
      </div>

      {/* Nearby Promotions */}
      <div className="px-4 mb-4 flex justify-between items-center">
        <h2 className="font-bold text-[19px] tracking-tight text-black">Nearby deals</h2>
        <span className="text-gray-900 text-[15px] font-medium">See all</span>
      </div>
      <div className="px-4 mb-6 space-y-3">
        <div className="flex items-center bg-white rounded-[16px] border border-gray-100 shadow-sm p-3 active:scale-[0.98] transition-transform overflow-hidden relative">
          <div className="w-[72px] h-[72px] rounded-[12px] overflow-hidden flex-shrink-0 mr-3 relative">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=200&q=70')" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[15px] text-black truncate">Pizzeria Napoli</div>
            <div className="text-[12px] text-gray-500 mt-0.5">Italian • $$ • 0.8 km</div>
            <div className="text-[11px] text-green-600 font-bold mt-1">20% off first order</div>
          </div>
          <div className="bg-gray-100 rounded-full px-2 py-0.5 text-[11px] font-bold text-black ml-2">4.7 ★</div>
        </div>
        <div className="flex items-center bg-white rounded-[16px] border border-gray-100 shadow-sm p-3 active:scale-[0.98] transition-transform overflow-hidden relative">
          <div className="w-[72px] h-[72px] rounded-[12px] overflow-hidden flex-shrink-0 mr-3 relative">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=70')" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[15px] text-black truncate">The Bistro</div>
            <div className="text-[12px] text-gray-500 mt-0.5">French • $$$ • 1.2 km</div>
            <div className="text-[11px] text-green-600 font-bold mt-1">Free delivery today</div>
          </div>
          <div className="bg-gray-100 rounded-full px-2 py-0.5 text-[11px] font-bold text-black ml-2">4.9 ★</div>
        </div>
      </div>

      {/* Start Ride Button — hidden after ride is complete (user must pick Service 2 tab) */}
      {!service2Tab && (
        <div className="sticky bottom-[70px] w-full px-4 pb-4 pt-4 bg-gradient-to-t from-white via-white to-transparent z-10">
            <button
              onClick={handleStartRide}
              aria-disabled={!destinationValid}
              data-testid="btn-start-ride"
              className={`w-full h-[56px] bg-black text-white rounded-[16px] font-bold text-[17px] shadow-lg transition-all duration-200 flex items-center justify-center ${destinationValid ? 'active:scale-[0.97] active:bg-gray-900' : 'opacity-40'}`}
            >
              Start a Ride
            </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
