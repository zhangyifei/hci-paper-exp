import React, { useState } from 'react'
import { Condition, ConditionConfig } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'
import { getNavigationPath, resetNavigationPath } from '@/lib/screen-tracker'
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
import BackgroundQuestionnaire from './Survey/BackgroundQuestionnaire'
import PostTaskSurvey from './Survey/PostTaskSurvey'

interface ExperimentFlowProps {
  condition: Condition
  config: ConditionConfig
}

type Screen = 
  | 'questionnaire'
  | 'home'
  | 'map'
  | 'ride_almost_there'
  | 'trip_complete'
  | 'service2_entry'
  | 'service2_delivery'
  | 'service2_restaurant'
  | 'service2_complete'
  | 'survey'
  | 'finished'

export default function ExperimentFlow({ condition, config }: ExperimentFlowProps) {
  const [screen, setScreen] = useState<Screen>('questionnaire')
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')
  const [rideCompleted, setRideCompleted] = useState(false)

  const handleQuestionnaireComplete = () => {
    resetNavigationPath()
    setScreen('home')
  }

  const handleSurveyComplete = async () => {
    try {
      // Include the full navigation path in the completion event
      const navPath = getNavigationPath()
      logger.trackEvent('experiment.completed', 'experiment', 'finished', {
        payload: { navigationPath: navPath, totalScreens: navPath.length },
      })
      await logger.flushAndWait()
      setScreen('finished')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.trackEvent('experiment.error', 'experiment', 'finished', { error: message })
      setScreen('finished')
    }
  }

  const handleTaskCompletion = () => {
    // After task is done, go to post-task survey instead of finishing
    setScreen('survey')
  }

  // State transitions
  const goToMap = () => setScreen('map')
  const goToRideAlmostThere = () => setScreen('ride_almost_there')
  const goToTripComplete = () => {
    setRideCompleted(true)
    setScreen('trip_complete')
  }
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
    <div className="w-full min-h-full bg-white text-black relative">
      {screen === 'questionnaire' && (
        <BackgroundQuestionnaire onComplete={handleQuestionnaireComplete} />
      )}

      {screen === 'home' && (
        <HomeScreen 
          onNext={goToMap} 
          service2Tab={rideCompleted ? config.service2 : undefined}
          onService2TabClick={rideCompleted ? goToService2Entry : undefined}
        />
      )}
      
      {screen === 'map' && <MapScreen onNext={goToRideAlmostThere} onBack={handleBackToHome} />}
      
      {screen === 'ride_almost_there' && <RideAlmostThereScreen onNext={goToTripComplete} />}
      
      {screen === 'trip_complete' && (
        <TripCompleteScreen 
          condition={condition} 
          config={config} 
          onNext={config.banner ? goToService2Entry : () => setScreen('home')} 
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
        <CourierCompleteScreen config={config} onNext={handleTaskCompletion} />
      )}

      {screen === 'service2_complete' && config.service2 === 'eats' && (
        <EatsCompleteScreen config={config} onNext={handleTaskCompletion} />
      )}

      {screen === 'survey' && (
        <PostTaskSurvey onComplete={handleSurveyComplete} />
      )}

      {screen === 'finished' && (
        <div className="flex flex-col items-center justify-center h-full min-h-[600px] px-8 text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-black mb-2">Test Done</h1>
          <p className="text-gray-500 text-[15px] leading-relaxed">
            Thank you for completing the experiment.
          </p>
          <div className="mt-6 text-[13px] text-gray-400 font-medium">
            Condition: {condition}
          </div>
        </div>
      )}
    </div>
  )
}
