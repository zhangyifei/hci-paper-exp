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
import ConsentScreen from './Survey/ConsentScreen'
import ScenarioInstructionScreen from './Survey/ScenarioInstructionScreen'
import PostTaskSurvey from './Survey/PostTaskSurvey'
import CompletionScreen from './Survey/CompletionScreen'

interface ExperimentFlowProps {
  condition: Condition
  config: ConditionConfig
}

type Screen = 
  | 'consent'
  | 'questionnaire'
  | 'scenario_instruction'
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
  | 'terminated'

export default function ExperimentFlow({ condition, config }: ExperimentFlowProps) {
  const [screen, setScreen] = useState<Screen>('consent')
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')
  const [rideCompleted, setRideCompleted] = useState(false)

  const handleConsentComplete = () => {
    setScreen('scenario_instruction')
  }

  const handleScenarioComplete = () => {
    resetNavigationPath()
    setScreen('home')
  }

  const handleSurveyComplete = () => {
    // After the post-task survey, collect background questions (docx order).
    setScreen('questionnaire')
  }

  const handleQuestionnaireComplete = async () => {
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

  // Shared handler for both attention checks (AC1 in survey, AC2 in
  // questionnaire). A failure ends the test and marks the session invalid.
  const handleAttentionCheckFailure = async (
    code: string,
    expected: string | number,
    actual: string | number | undefined,
  ) => {
    logger.trackEvent('attention_check.failed', 'experiment', 'terminated', {
      payload: { code, expected, actual: actual ?? null },
    })
    logger.trackEvent('experiment.invalidated', 'experiment', 'terminated', {
      payload: { reason: 'attention_check', failedCheck: code },
    })
    try {
      await logger.flushAndWait()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.trackEvent('experiment.error', 'experiment', 'terminated', { error: message })
    }
    setScreen('terminated')
  }

  const handleTaskCompletion = () => {
    // After task is done, go to post-task survey
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
      {screen === 'consent' && (
        <ConsentScreen onConsent={handleConsentComplete} />
      )}

      {screen === 'scenario_instruction' && (
        <ScenarioInstructionScreen config={config} onStart={handleScenarioComplete} />
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
        <PostTaskSurvey
          onComplete={handleSurveyComplete}
          onAttentionCheckFail={handleAttentionCheckFailure}
        />
      )}

      {screen === 'questionnaire' && (
        <BackgroundQuestionnaire
          onComplete={handleQuestionnaireComplete}
          onAttentionCheckFail={handleAttentionCheckFailure}
        />
      )}

      {screen === 'terminated' && <CompletionScreen variant="terminated" />}

      {screen === 'finished' && <CompletionScreen variant="completed" />}
    </div>
  )
}
