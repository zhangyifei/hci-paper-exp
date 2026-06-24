'use client'

import React from 'react'

interface TaskIndicatorProps {
  /** e.g. "Task 2 of 2: Arrange a courier pickup" */
  label: string
  /** Re-shows the guidance reminder when the participant requests help. */
  onHelp: () => void
}

/**
 * Small persistent task indicator pinned in a fixed position across all
 * Super App screens. Shows the current task and a neutral "Help" affordance
 * that re-surfaces the guidance reminder.
 */
export default function TaskIndicator({ label, onHelp }: TaskIndicatorProps) {
  return (
    <div
      data-testid="task-indicator"
      className="absolute top-[64px] left-1/2 -translate-x-1/2 z-[150] flex items-center gap-2 rounded-full bg-black/85 text-white pl-3.5 pr-1.5 py-1.5 shadow-lg backdrop-blur-md max-w-[72%] pointer-events-none"
    >
      <span className="text-[12px] font-semibold whitespace-nowrap truncate pointer-events-none">{label}</span>
      <button
        type="button"
        onClick={onHelp}
        aria-label="Show task reminder"
        data-testid="task-indicator-help"
        className="pointer-events-auto flex-shrink-0 w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-[12px] font-bold active:scale-90 transition"
      >
        ?
      </button>
    </div>
  )
}
