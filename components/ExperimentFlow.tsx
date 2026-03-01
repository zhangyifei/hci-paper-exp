import React, { useState, useEffect } from 'react'
import { Condition, ConditionConfig } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'
import HomeScreen from './RidePhase/HomeScreen'
import MapScreen from './RidePhase/MapScreen'
import RideAlmostThereScreen from './RidePhase/RideAlmostThereScreen'
import TripCompleteScreen from './TripCompletePhase/TripCompleteScreen'
import CourierEntryScreen from './Service2Phase/CourierEntryScreen'
import CourierDeliveryScreen from './Service2Phase/CourierDeliveryScreen'
import CourierCompleteScreen from './Service2Phase/CourierCompleteScreen'
import EatsEntryScreen from './Service2Phase/EatsEntryScreen'
import EatsRestaurantScreen from './Service2Phase/EatsRestaurantScreen'
import EatsCompleteScreen from './Service2Phase/EatsCompleteScreen'

interface ExperimentFlowProps {
  condition: Condition
  config: ConditionConfig
}

type Screen = 
  | 'home'
  | 'map'
  | 'ride_almost_there'
  | 'trip_complete'
  | 'service2_entry'
  | 'service2_delivery' // Courier intermediate
  | 'service2_restaurant' // Eats intermediate
  | 'service2_complete'

export default function ExperimentFlow({ condition, config }: ExperimentFlowProps) {
  const [screen, setScreen] = useState<Screen>('home')
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')

  // Redirect logic
  const handleCompletion = async () => {
    await logger.flushAndWait()
    const redirectUrl = typeof sessionStorage !== 'undefined' 
      ? sessionStorage.getItem('prolific_completion_url') 
      : null
    if (typeof window !== 'undefined') {
      window.location.href = redirectUrl ?? 'https://app.prolific.co/submissions/complete?cc=PLACEHOLDER'
    }
  }

  // State transitions
  const goToMap = () => setScreen('map')
  const goToRideAlmostThere = () => setScreen('ride_almost_there')
  const goToTripComplete = () => setScreen('trip_complete')
  const goToService2Entry = () => setScreen('service2_entry')
  
  const handleService2EntryNext = (eventId?: string) => {
    if (eventId) setService2EntryEventId(eventId)
    
    if (config.service2 === 'courier') {
      setScreen('service2_delivery')
    } else {
      setScreen('service2_restaurant')
    }
  }

  const handleService2TaskNext = () => {
      setScreen('service2_complete')
  }

  const handleBackToHome = () => {
    // In the experiment, "Back to Home" advances to Service 2 — there is no real home
    setScreen('service2_entry')
  }

  return (
    <div className="w-full min-h-screen bg-white text-black relative">
      {screen === 'home' && <HomeScreen onNext={goToMap} />}
      
      {screen === 'map' && <MapScreen onNext={goToRideAlmostThere} onBack={handleBackToHome} />}
      
      {screen === 'ride_almost_there' && <RideAlmostThereScreen onNext={goToTripComplete} />}
      
      {screen === 'trip_complete' && (
        <TripCompleteScreen 
          condition={condition} 
          config={config} 
          onNext={goToService2Entry} 
        />
      )}

      {screen === 'service2_entry' && config.service2 === 'courier' && (
        <CourierEntryScreen config={config} onNext={handleService2EntryNext} />
      )}

      {screen === 'service2_entry' && config.service2 === 'eats' && (
        <EatsEntryScreen config={config} onNext={handleService2EntryNext} />
      )}

      {screen === 'service2_delivery' && (
        <CourierDeliveryScreen onNext={handleService2TaskNext} />
      )}

      {screen === 'service2_restaurant' && (
        <EatsRestaurantScreen 
            onNext={handleService2TaskNext} 
            onBack={() => setScreen('service2_entry')}
            parentEventId={service2EntryEventId} 
        />
      )}

      {screen === 'service2_complete' && config.service2 === 'courier' && (
        <CourierCompleteScreen config={config} onNext={handleCompletion} />
      )}

      {screen === 'service2_complete' && config.service2 === 'eats' && (
        <EatsCompleteScreen config={config} onNext={handleCompletion} />
      )}
    </div>
  )
}
