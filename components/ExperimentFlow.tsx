import React, { useEffect, useRef, useState } from 'react'
import { Condition, ConditionConfig } from '@/lib/experiment-config'
import {
  EXPERIMENT_TIMEOUT_MS,
  experimentStartedAtStorageKey,
} from '@/lib/experiment-timeout'
import { dataQualityTracker } from '@/lib/data-quality'
import { logger } from '@/lib/logger'
import { getNavigationPath, resetNavigationPath } from '@/lib/screen-tracker'
import PhoneFrame from './shared/PhoneFrame'
import GuidanceBanner from './shared/GuidanceBanner'
import HomeScreen from './RidePhase/HomeScreen'
import MapScreen from './RidePhase/MapScreen'
import RideAlmostThereScreen from './RidePhase/RideAlmostThereScreen'
import TripCompleteScreen from './TripCompletePhase/TripCompleteScreen'
import CourierEntryScreen from './Service2Phase/CourierEntryScreen'
import CourierDetailsScreen from './Service2Phase/CourierDetailsScreen'
import CourierCompleteScreen from './Service2Phase/CourierCompleteScreen'
import MovieEntryScreen from './Service2Phase/MovieEntryScreen'
import MovieSeatsScreen from './Service2Phase/MovieSeatsScreen'
import MovieCompleteScreen from './Service2Phase/MovieCompleteScreen'
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
  | 'service2_detail'
  | 'service2_complete'
  | 'survey'
  | 'finished'
  | 'terminated'
  | 'timed_out'

/** Super App screens belonging to Task 1 (the ride). */
const TASK1_SCREENS: Screen[] = ['home', 'map', 'ride_almost_there', 'trip_complete']
/** Super App screens belonging to Task 2 (the second service). */
const TASK2_SCREENS: Screen[] = [
  'service2_entry',
  'service2_detail',
  'service2_complete',
]

export default function ExperimentFlow({ condition, config }: ExperimentFlowProps) {
  const [screen, setScreen] = useState<Screen>('consent')
  const finalOutcomeLockedRef = useRef(false)
  const [service2EntryEventId, setService2EntryEventId] = useState<string>('')
  const [returnedHomeAfterRide, setReturnedHomeAfterRide] = useState(false)
  // Prices the participant selected, carried to the completion screens (§4).
  const [ridePrice, setRidePrice] = useState<number>(12.59)
  const [service2Fee, setService2Fee] = useState<number>(config.service2Options[0]?.price ?? 0)

  useEffect(() => {
    dataQualityTracker.reset()
  }, [])

  // Apply one shared 30-minute limit to the complete study session. The start
  // time is tied to the experiment session so refreshing cannot restart it.
  useEffect(() => {
    const sessionId = sessionStorage.getItem('exp_session_id')
    if (!sessionId) return

    const storageKey = experimentStartedAtStorageKey(sessionId)
    const now = Date.now()
    const storedStartedAt = Number(sessionStorage.getItem(storageKey))
    const startedAt =
      Number.isFinite(storedStartedAt) && storedStartedAt > 0 && storedStartedAt <= now
        ? storedStartedAt
        : now

    if (startedAt === now) {
      sessionStorage.setItem(storageKey, String(startedAt))
    }

    const endTimedOutSession = async () => {
      if (finalOutcomeLockedRef.current) return
      finalOutcomeLockedRef.current = true

      const elapsedMs = Math.max(0, Date.now() - startedAt)
      logger.trackEvent('experiment.timed_out', 'experiment', 'timed_out', {
        payload: { limitMs: EXPERIMENT_TIMEOUT_MS, elapsedMs },
      })
      logger.trackEvent('experiment.invalidated', 'experiment', 'timed_out', {
        payload: { reason: 'timeout', limitMs: EXPERIMENT_TIMEOUT_MS },
      })

      try {
        await logger.flushAndWait()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        logger.trackEvent('experiment.error', 'experiment', 'timed_out', { error: message })
      }

      setScreen('timed_out')
    }

    const remainingMs = EXPERIMENT_TIMEOUT_MS - (now - startedAt)
    if (remainingMs <= 0) {
      void endTimedOutSession()
      return
    }

    const timeoutId = window.setTimeout(() => {
      void endTimedOutSession()
    }, remainingMs)

    return () => window.clearTimeout(timeoutId)
  }, [])

  // Every screen (and phone-frame screen) must start at the top. Without this,
  // React swaps the screen content while the window keeps the previous page's
  // scroll position, making a new page appear scrolled to the bottom.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0 })
    }
  }, [screen])

  const handleConsentComplete = () => {
    setScreen('scenario_instruction')
  }

  const handleScenarioComplete = () => {
    resetNavigationPath()
    logger.trackEvent('task.started', 'task', 'task_active', {
      payload: { taskNumber: 1, totalTasks: 2, service: config.task1.service },
    })
    setScreen('home')
  }

  const handleSurveyComplete = () => {
    // After the post-task survey, collect background questions (docx order).
    setScreen('questionnaire')
  }

  const handleQuestionnaireComplete = async () => {
    if (finalOutcomeLockedRef.current) return
    finalOutcomeLockedRef.current = true

    try {
      // Include the full navigation path in the completion event
      const navPath = getNavigationPath()
      const dataQuality = dataQualityTracker.assess()
      if (dataQuality.flagged) {
        logger.trackEvent('data_quality.flagged', 'experiment', 'finished', {
          payload: {
            reasons: dataQuality.reasons,
            metrics: dataQuality.metrics,
            paymentDisposition: 'normal_completion',
          },
        })
      }
      logger.trackEvent('experiment.completed', 'experiment', 'finished', {
        payload: {
          navigationPath: navPath,
          totalScreens: navPath.length,
          dataQualityFlagged: dataQuality.flagged,
        },
      })
      await logger.flushAndWait()
      setScreen('finished')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.trackEvent('experiment.error', 'experiment', 'finished', { error: message })
      setScreen('finished')
    }
  }

  // Attention-check handler (AC1 in the post-task survey).
  // A failure ends the test and marks the session invalid.
  const handleAttentionCheckFailure = async (
    code: string,
    expected: string | number,
    actual: string | number | undefined,
  ) => {
    if (finalOutcomeLockedRef.current) return
    finalOutcomeLockedRef.current = true

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
  const goToRideAlmostThere = (price: number) => {
    setRidePrice(price)
    setScreen('ride_almost_there')
  }
  const goToTripComplete = () => setScreen('trip_complete')
  const goToService2Entry = () => {
    logger.trackEvent('task.started', 'task', 'task_active', {
      payload: { taskNumber: 2, totalTasks: 2, service: config.task2.service },
    })
    setScreen('service2_entry')
  }

  const handleTripCompleteBack = () => {
    if (config.tripCompleteBackDestination === 'home') {
      setReturnedHomeAfterRide(true)
      setScreen('home')
      return
    }

    goToService2Entry()
  }

  const handleService2EntryNext = (eventId?: string, fee?: number) => {
    if (eventId) setService2EntryEventId(eventId)
    if (typeof fee === 'number') setService2Fee(fee)
    setScreen('service2_detail')
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
  const isPostRideHome = screen === 'home' && returnedHomeAfterRide
  const activeTask = isTask2 || isPostRideHome ? config.task2 : config.task1
  const guidanceByScreen: Partial<Record<Screen, string | null>> = {
    map: config.rideSelectionGuidanceText,
    ride_almost_there: config.rideWaitingGuidanceText,
    trip_complete: config.tripCompleteGuidanceText,
    service2_entry: config.service2EntryGuidanceText,
    service2_detail: config.service2DetailGuidanceText,
    service2_complete: config.service2CompleteGuidanceText,
  }
  const guidanceText = guidanceByScreen[screen] ?? activeTask.guidanceText

  if (isSuperApp) {
    let inner: React.ReactNode = null
    switch (screen) {
      case 'home':
        inner = (
          <HomeScreen
            onNext={goToMap}
            service2Kind={config.service2}
            service2Tab={returnedHomeAfterRide ? config.service2 : undefined}
            onService2TabClick={returnedHomeAfterRide ? goToService2Entry : undefined}
            requiredDestinationAddress={config.rideRequiredAddress}
          />
        )
        break
      case 'map':
        inner = <MapScreen onNext={goToRideAlmostThere} onBack={() => goBack('map', 'home')} />
        break
      case 'ride_almost_there':
        inner = <RideAlmostThereScreen onNext={goToTripComplete} />
        break
      case 'trip_complete':
        inner = (
          <TripCompleteScreen
            condition={condition}
            config={config}
            ridePrice={ridePrice}
            onNext={goToService2Entry}
            onBackToHome={handleTripCompleteBack}
          />
        )
        break
      case 'service2_entry':
        inner =
          config.service2 === 'courier' ? (
            <CourierEntryScreen
              config={config}
              onNext={handleService2EntryNext}
              onBack={() => goBack('service2_entry', 'trip_complete')}
            />
          ) : (
            <MovieEntryScreen
              config={config}
              onNext={handleService2EntryNext}
              onBack={() => goBack('service2_entry', 'trip_complete')}
            />
          )
        break
      case 'service2_detail':
        inner =
          config.service2 === 'courier' ? (
            <CourierDetailsScreen
              onNext={handleService2TaskNext}
              onBack={() => goBack('service2_detail', 'service2_entry')}
              parentEventId={service2EntryEventId}
            />
          ) : (
            <MovieSeatsScreen
              config={config}
              onNext={handleService2TaskNext}
              onBack={() => goBack('service2_detail', 'service2_entry')}
              parentEventId={service2EntryEventId}
            />
          )
        break
      case 'service2_complete':
        inner =
          config.service2 === 'courier' ? (
            <CourierCompleteScreen courierFee={service2Fee} onNext={handleTaskCompletion} />
          ) : (
            <MovieCompleteScreen onNext={handleTaskCompletion} />
          )
        break
    }

    const taskPhase = isTask2 || isPostRideHome ? 2 : 1
    return (
      <PhoneFrame
        overlay={
          <GuidanceBanner
            key={`${taskPhase}-${screen}`}
            text={guidanceText}
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
        />
      )
    case 'terminated':
      return <CompletionScreen variant="terminated" />
    case 'timed_out':
      return <CompletionScreen variant="timed_out" />
    case 'finished':
      return <CompletionScreen variant="completed" />
    default:
      return null
  }
}
