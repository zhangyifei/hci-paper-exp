'use client'

import React, { useEffect } from 'react'
import ResearchPage from '../shared/ResearchPage'
import type { ConditionConfig } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'

/**
 * Scenario instruction screen shown after the background questionnaire and
 * before the prototype task. Explains the fictional "Voya X" scenario and the
 * two task instructions.
 *
 * The ride and second-service instructions are condition-specific and come
 * exclusively from the experiment config contract (no hardcoded condition
 * logic here). Source wording:
 *   docs/0613/Appendix_D_SuperApp_Questionnaire_HEC_06102026.docx (section A).
 */

interface ScenarioInstructionScreenProps {
  config: ConditionConfig
  onStart: () => void
}

export default function ScenarioInstructionScreen({
  config,
  onStart,
}: ScenarioInstructionScreenProps) {
  useEffect(() => {
    logger.trackEvent('scenario.viewed', 'onboarding', 'scenario_active')
  }, [])

  const handleStart = () => {
    logger.trackEvent('scenario.started', 'onboarding', 'scenario_complete')
    onStart()
  }

  return (
    <ResearchPage
      data-testid="screen-scenario"
      footer={
        <button
          onClick={handleStart}
          data-testid="btn-scenario-start"
          className="w-full h-[54px] rounded-[14px] font-bold text-[16px] transition-all active:scale-[0.98] bg-black text-white hover:bg-gray-900"
        >
          Continue
        </button>
      }
    >
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-bold tracking-tight text-black mb-2">
            Your Scenario
          </h1>
          <p className="text-[14px] text-gray-500 leading-relaxed">
            You will now complete two short tasks in a fictional web-based super app prototype
            called &ldquo;Voya X.&rdquo;
          </p>
        </div>

        {/* Fictional-prototype note */}
        <div className="mb-6 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[13px] text-amber-800 leading-relaxed">
            The super app and all tasks are simulated. No real ride, delivery, food order, payment,
            or commercial transaction will take place.
          </p>
        </div>

        {/* Task list */}
        <div className="space-y-4">
          <div className="rounded-[14px] border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-black text-white text-[12px] font-bold flex items-center justify-center">
                1
              </span>
              <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">
                Ride task
              </span>
            </div>
            <p
              className="text-[15px] font-semibold text-black leading-snug"
              data-testid="scenario-ride-instruction"
            >
              {config.rideTaskInstruction}
            </p>
          </div>

          <div className="rounded-[14px] border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-black text-white text-[12px] font-bold flex items-center justify-center">
                2
              </span>
              <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">
                {config.service2 === 'courier' ? 'Courier task' : 'Eats task'}
              </span>
            </div>
            <p
              className="text-[15px] font-semibold text-black leading-snug"
              data-testid="scenario-service2-instruction"
            >
              {config.service2TaskInstruction}
            </p>
          </div>
        </div>

        <p className="mt-6 text-[13px] text-gray-500 leading-relaxed">
          When both tasks are complete, you will return to the questionnaire and answer the questions
          based on your experience.
        </p>
      </div>
    </ResearchPage>
  )
}
