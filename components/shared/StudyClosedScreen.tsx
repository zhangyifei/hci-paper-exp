'use client'

import React from 'react'
import ResearchPage from './ResearchPage'

/**
 * Shown when a participant lands but cannot be placed into the study:
 *   - "full":   every group in the active batch has reached capacity.
 *   - "closed": no batch is currently open for recruitment.
 *
 * Mirrors the calm, single-column look of the completion screen so a turned
 * -away participant still sees a polished, trustworthy page.
 */
interface StudyClosedScreenProps {
  variant: 'full' | 'closed'
}

export default function StudyClosedScreen({ variant }: StudyClosedScreenProps) {
  const isFull = variant === 'full'

  return (
    <ResearchPage maxWidthClassName="max-w-[520px]">
      <div
        className="flex flex-col items-center justify-center text-center py-6 animate-fade-in"
        data-testid={isFull ? 'screen-study-full' : 'screen-study-closed'}
      >
        <div className="relative mb-7">
          <div className="absolute inset-0 rounded-full blur-xl opacity-60 bg-gray-200" />
          <div className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-sm bg-gradient-to-br from-gray-50 to-gray-100 ring-1 ring-gray-200">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b7280"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        <h1 className="text-[28px] font-bold tracking-tight text-black mb-2.5">
          {isFull ? 'Study Full' : 'Study Not Open'}
        </h1>

        <p className="text-gray-500 text-[15px] leading-relaxed max-w-[340px]">
          {isFull
            ? 'Thank you for your interest. This study has already reached the number of participants we need, so no further responses can be collected right now.'
            : 'This study is not currently open for participation. Please return to Prolific — you have not started the task and will not be penalised.'}
        </p>

        <p className="mt-7 text-[13px] text-gray-400 font-medium">
          Please return to Prolific and return your submission.
        </p>
      </div>
    </ResearchPage>
  )
}
