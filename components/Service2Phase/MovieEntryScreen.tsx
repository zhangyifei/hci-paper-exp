import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import BottomNav from '../shared/BottomNav'
import BackButton from '../shared/BackButton'
import { logger } from '@/lib/logger'
import { markService2Entry } from '@/lib/timing'
import { ConditionConfig } from '@/lib/experiment-config'
import { enterScreen } from '@/lib/screen-tracker'

interface MovieEntryScreenProps {
  config: ConditionConfig
  onNext: (eventId: string, fee: number) => void
  onBack: () => void
}

interface SavedPlace {
  id: string
  name: string
  detail: string
  tag?: string
  icon: string
}

/** Selectable saved/recent locations to find cinemas near (tap instead of typing). */
const SAVED_LOCATIONS: SavedPlace[] = [
  { id: 'saint-catherine', name: '1000 Saint-Catherine Street West', detail: 'Downtown, Montreal', tag: 'RECENT', icon: '🕒' },
]

interface Cinema {
  id: string
  name: string
  area: string
  distance: string
  rating: string
  showtimes: string[]
}

/** Cinemas near the ride destination (distance-anchored). */
const NEARBY_CINEMAS: Cinema[] = [
  { id: 'forum', name: 'Cineplex Forum', area: '2313 Saint-Catherine St W', distance: '0.4 km', rating: '4.6', showtimes: ['7:10 PM', '8:45 PM', '10:00 PM'] },
  { id: 'quartier', name: 'Cinéma Banque Scotia', area: '977 Saint-Catherine St W', distance: '0.7 km', rating: '4.4', showtimes: ['7:30 PM', '9:15 PM'] },
  { id: 'imax', name: 'Cinéma IMAX du Centre', area: '2 Rue de la Commune', distance: '1.2 km', rating: '4.8', showtimes: ['8:00 PM', '9:40 PM'] },
]

/** Popular cinemas citywide (no distance anchoring). */
const CITYWIDE_CINEMAS: Cinema[] = [
  { id: 'imax', name: 'Cinéma IMAX du Centre', area: 'Old Montreal', distance: '', rating: '4.8', showtimes: ['8:00 PM', '9:40 PM'] },
  { id: 'starcite', name: 'Cinéma StarCité', area: 'Hochelaga', distance: '', rating: '4.5', showtimes: ['7:00 PM', '9:20 PM'] },
  { id: 'forum', name: 'Cineplex Forum', area: 'Downtown', distance: '', rating: '4.6', showtimes: ['7:10 PM', '8:45 PM'] },
]

const FILM = { title: 'Skyline Runners', rating: 'PG-13 · 2h 08m', genre: 'Action · Adventure' }

/** A valid location has at least one number and some letters. */
function isValidAddress(value: string): boolean {
  const v = value.trim()
  return v.length >= 5 && /\d/.test(v) && /[a-zA-Z]/.test(v)
}

export default function MovieEntryScreen({ config, onNext, onBack }: MovieEntryScreenProps) {
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')

  const [location, setLocation] = useState<string>(
    config.autoPopulate && config.addressLabel ? config.addressLabel : '',
  )
  const [showAddressError, setShowAddressError] = useState(false)
  const [selectedCinema, setSelectedCinema] = useState<string | null>(config.autoPopulate ? 'forum' : null)
  const [selectedShowtime, setSelectedShowtime] = useState<string | null>(null)

  const cinemas = config.autoPopulate || config.listUI === 'distance-filtered' ? NEARBY_CINEMAS : CITYWIDE_CINEMAS

  useEffect(() => {
    markService2Entry()
    const eventId = logger.trackEvent('service2.entry', 'service2', 'service2_entry')
    setService2EntryEventId(eventId)
    const cleanup = enterScreen('service2_entry_movie', 'service2')
    return cleanup
  }, [])

  const addressValid = config.autoPopulate || isValidAddress(location)

  const handleLocationChange = (value: string) => {
    setLocation(value)
    if (showAddressError && isValidAddress(value)) setShowAddressError(false)
    logger.trackEvent('service2.address_edited', 'service2', 'service2_task_active', {
      payload: { field: 'location' },
    })
  }

  const handlePickLocationSaved = (place: SavedPlace) => {
    setLocation(place.name)
    setShowAddressError(false)
    logger.trackEvent('service2.address_validated', 'service2', 'service2_task_active', {
      payload: { field: 'location', source: 'saved', placeId: place.id },
    })
  }

  const handleSelectCinema = (id: string) => {
    if (!addressValid) {
      setShowAddressError(true)
      return
    }
    setSelectedCinema(id)
    setSelectedShowtime(null)
    logger.trackEvent('service2.recipient_selected', 'service2', 'service2_task_active', {
      payload: { recipientId: id, recipient: id },
    })
  }

  const handleSelectShowtime = (cinemaId: string, time: string) => {
    setSelectedCinema(cinemaId)
    setSelectedShowtime(time)
    logger.trackEvent('service2.option_selected', 'service2', 'service2_task_active', {
      payload: { optionId: `${cinemaId}:${time}`, optionLabel: time },
    })
  }

  const handleContinue = () => {
    if (!addressValid) {
      setShowAddressError(true)
      return
    }
    if (!selectedCinema || !selectedShowtime) return
    logger.trackEvent('service2.address_validated', 'service2', 'service2_task_active', {
      payload: { field: 'location', address: location.trim() },
    })
    onNext(service2EntryEventId, config.service2Options[0]?.price ?? 0)
  }

  const canContinue = addressValid && !!selectedCinema && !!selectedShowtime

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in" data-testid="screen-movie-entry">
      <StatusBar />
      <BackButton onClick={onBack} />

      {/* Tab Bar */}
      <div className="flex items-center space-x-3 px-4 mt-[104px] mb-5 pt-2 overflow-x-auto no-scrollbar">
        <div className="bg-white text-black px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm border border-gray-100 active:scale-95 transition-transform">Rides</div>
        <div className="bg-black text-white px-5 py-2 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform flex items-center">
          <span className="mr-2 text-[18px]">🎬</span> Cinema
        </div>
      </div>

      <div className="px-4 overflow-y-auto pb-4 no-scrollbar">
        {/* Now showing film banner */}
        <div className="rounded-[16px] bg-gray-50 border border-gray-100 p-4 mb-6 flex items-center">
          <div className="w-14 h-20 rounded-[10px] bg-gray-200 flex items-center justify-center text-[28px] mr-4 flex-shrink-0">🎬</div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Now showing</div>
            <div className="font-bold text-[18px] leading-tight text-black">{FILM.title}</div>
            <div className="text-[12px] text-gray-500 mt-0.5">{FILM.rating} · {FILM.genre}</div>
          </div>
        </div>

        {/* Find cinemas near */}
        <div className="mb-6">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-2">Find cinemas near</h2>
          {config.autoPopulate ? (
            <div className="bg-white rounded-[16px] p-4 border border-green-500 shadow-[0_4px_12px_rgba(22,163,74,0.08)] relative" data-testid="movie-location-autofilled">
              <div className="flex items-center mb-1">
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold mr-2 border border-green-200">SUGGESTED</span>
                <div className="font-bold text-[15px] text-black">{config.addressLabel || '1000 Saint-Catherine Street West'}</div>
              </div>
              <div className="text-[13px] text-green-600 font-medium">{config.addressSublabel || 'Downtown, Montreal'}</div>
            </div>
          ) : (
            <>
              <div className={`bg-gray-100 rounded-[16px] h-[52px] flex items-center px-4 border-2 transition-colors ${showAddressError ? 'border-red-500' : 'border-transparent focus-within:border-black'}`} data-testid="movie-location-empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black mr-3 flex-shrink-0" aria-hidden>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <input
                  type="text"
                  autoComplete="off"
                  value={location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onBlur={() => setShowAddressError(!isValidAddress(location) && location.length > 0)}
                  placeholder="Enter a location"
                  aria-label="Cinema search location"
                  aria-invalid={showAddressError}
                  data-testid="input-movie-location"
                  className="flex-1 bg-transparent outline-none text-[15px] font-medium text-black placeholder:text-gray-500"
                />
              </div>
              {showAddressError && (
                <p data-testid="movie-location-error" role="alert" className="mt-1.5 text-[12px] font-semibold text-red-600 pl-1">Enter a location before choosing a cinema.</p>
              )}
              {location.trim().length === 0 && (
                <div className="mt-3 space-y-1" data-testid="movie-saved-places">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 mb-1">Saved &amp; recent</p>
                  {SAVED_LOCATIONS.map((place) => (
                    <button key={place.id} type="button" onClick={() => handlePickLocationSaved(place)} data-testid={`movie-saved-${place.id}`} className="w-full flex items-center text-left active:opacity-60 transition-opacity py-2">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-[14px] flex-shrink-0">{place.icon}</div>
                      <div className="flex-1 border-b border-gray-100 pb-3">
                        <div className="font-bold text-[15px] flex items-center mb-0.5 text-black">{place.name}{place.tag && <span className="ml-2 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{place.tag}</span>}</div>
                        <div className="text-[13px] text-gray-500">{place.detail}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Cinema list */}
        <div className="mb-2">
          <h2 className="text-[13px] font-bold text-black tracking-wide mb-3">
            {config.autoPopulate || config.listUI === 'distance-filtered' ? 'Cinemas near you' : 'Popular cinemas'}
          </h2>
          <div className="space-y-3" data-testid="cinema-list">
            {cinemas.map((cinema) => {
              const on = selectedCinema === cinema.id
              return (
                <div
                  key={cinema.id}
                  data-testid={`cinema-${cinema.id}`}
                  className={`rounded-[16px] border-2 p-4 transition-all ${on ? 'border-black bg-gray-50 shadow-sm' : 'border-gray-100 bg-white'}`}
                >
                  <button type="button" onClick={() => handleSelectCinema(cinema.id)} className="w-full flex items-center justify-between text-left mb-3">
                    <div>
                      <div className="font-bold text-[15px] text-black">{cinema.name}</div>
                      <div className="text-[13px] text-gray-500">{cinema.area}{cinema.distance && ` · ${cinema.distance}`} · ⭐ {cinema.rating}</div>
                    </div>
                    {cinema.distance && <span className="text-[12px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full flex-shrink-0">{cinema.distance}</span>}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {cinema.showtimes.map((time) => {
                      const chosen = on && selectedShowtime === time
                      return (
                        <button
                          key={time}
                          type="button"
                          onClick={() => handleSelectShowtime(cinema.id, time)}
                          data-testid={`showtime-${cinema.id}-${time.replace(/[^0-9]/g, '')}`}
                          aria-pressed={chosen}
                          className={`px-4 py-2 rounded-[10px] text-[13px] font-bold border transition-all active:scale-95 ${chosen ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-200'}`}
                        >
                          {time}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto px-4 pb-3">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          data-testid="btn-select-cinema"
          className={`w-full h-[54px] rounded-[16px] font-bold text-[17px] transition-all active:scale-[0.98] ${canContinue ? 'bg-black text-white' : 'bg-gray-200 text-gray-400'}`}
        >
          Choose seats
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
