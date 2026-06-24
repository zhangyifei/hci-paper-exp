import React, { useState } from 'react'
import { Condition, ConditionConfig } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'
import { getNavigationPath, resetNavigationPath } from '@/lib/screen-tracker'
import PhoneFrame from './shared/PhoneFrame'
import GuidanceBanner from './shared/GuidanceBanner'
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
import TaskInstructionScreen from './Survey/TaskInstructionScreen'
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
  | 'task1_instruction'
  | 'home'
  | 'map'
  | 'ride_almost_there'
  | 'trip_complete'
  | 'task2_instruction'
  | 'service2_entry'
  | 'service2_delivery'
  | 'service2_restaurant'
  | 'service2_complete'
  | 'survey'
  | 'finished'
  | 'terminated'

/** Super App screens belonging to Task 1 (the ride). */
const TASK1_SCREENS: Screen[] = ['home', 'map', 'ride_almost_there', 'trip_complete']
/** Super App screens belonging to Task 2 (the second service). */
const TASK2_SCREENS: Screen[] = [
  'service2_entry',
  'service2_delivery',
  'service2_restaurant',
  'service2_complete',
]

export default function ExperimentFlow({ condition, config }: ExperimentFlowProps) {
  const [screen, setScreen] = useState<Screen>('consent')
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')

  const handleConsentComplete = () => {
    setScreen('scenario_instruction')
  }

  const handleScenarioComplete = () => {
    resetNavigationPath()
    setScreen('task1_instruction')
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
  const goToTripComplete = () => setScreen('trip_complete')
  const goToTask2Instruction = () => setScreen('task2_instruction')

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

  const goBack = (from: Screen, to: Screen) => {
    logger.trackEvent('screen.back', 'screen', from, { payload: { from, to } })
    setScreen(to)
  }

  // ── Render ────────────────────────────────────────────────────────────
  const isTask2 = TASK2_SCREENS.includes(screen)
  const isSuperApp = TASK1_SCREENS.includes(screen) || isTask2
  const activeTask = isTask2 ? config.task2 : config.task1

  if (isSuperApp) {
    let inner: React.ReactNode = null
    switch (screen) {
      case 'home':
        inner = <HomeScreen onNext={goToMap} />
        break
      case 'map':
        inner = <MapScreen onNext={goToRideAlmostThere} onBack={() => goBack('map', 'home')} />
        break
      case 'ride_almost_there':
        inner = <RideAlmostThereScreen onNext={goToTripComplete} />
        break
      case 'trip_complete':
        inner = (
          <TripCompleteScreen condition={condition} config={config} onNext={goToTask2Instruction} />
        )
        break
      case 'service2_entry':
        inner =
          config.service2 === 'courier' ? (
            <CourierEntryScreen
              config={config}
              onNext={handleService2EntryNext}
              onBack={() => goBack('service2_entry', 'task2_instruction')}
            />
          ) : (
            <EatsEntryScreen
              config={config}
              onNext={handleService2EntryNext}
              onBack={() => goBack('service2_entry', 'task2_instruction')}
            />
          )
        break
      case 'service2_delivery':
        inner = <CourierDeliveryScreen onNext={handleService2TaskNext} />
        break
      case 'service2_restaurant':
        inner = (
          <EatsRestaurantScreen
            onNext={handleService2TaskNext}
            onBack={() => goBack('service2_restaurant', 'service2_entry')}
            parentEventId={service2EntryEventId}
          />
        )
        break
      case 'service2_complete':
        inner =
          config.service2 === 'courier' ? (
            <CourierCompleteScreen config={config} onNext={handleTaskCompletion} />
          ) : (
            <EatsCompleteScreen config={config} onNext={handleTaskCompletion} />
          )
        break
    }

    const taskPhase = isTask2 ? 2 : 1
    return (
      <PhoneFrame
        overlay={
          <GuidanceBanner
            key={taskPhase}
            text={activeTask.guidanceText}
            thresholdMs={config.guidanceThresholdMs}
          />
        }
      >
        {inner}
      </PhoneFrame>
    )
  }

  // Research pages (full-browser, no phone frame).
  switch (screen) {
    case 'consent':
      return <ConsentScreen onConsent={handleConsentComplete} />
    case 'scenario_instruction':
      return <ScenarioInstructionScreen config={config} onStart={handleScenarioComplete} />
    case 'task1_instruction':
      return (
        <TaskInstructionScreen
          task={config.task1}
          taskNumber={1}
          totalTasks={2}
          onStart={() => setScreen('home')}
        />
      )
    case 'task2_instruction':
      return (
        <TaskInstructionScreen
          task={config.task2}
          taskNumber={2}
          totalTasks={2}
          onStart={() => setScreen('service2_entry')}
        />
      )
    case 'survey':
      return (
        <PostTaskSurvey
          onComplete={handleSurveyComplete}
          onAttentionCheckFail={handleAttentionCheckFailure}
        />
      )
    case 'questionnaire':
      return (
        <BackgroundQuestionnaire
          onComplete={handleQuestionnaireComplete}
          onAttentionCheckFail={handleAttentionCheckFailure}
        />
      )
    case 'terminated':
      return <CompletionScreen variant="terminated" />
    case 'finished':
      return <CompletionScreen variant="completed" />
    default:
      return null
  }
}
