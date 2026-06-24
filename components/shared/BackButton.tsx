'use client'

import React from 'react'

interface BackButtonProps {
  onClick: () => void
  /** Optional absolute position override. Defaults to top-left inside the frame. */
  className?: string
  label?: string
}

/**
 * Consistent back control used across Super App screens. Fixed top-left
 * position, touch-friendly hit area, accessible label.
 */
export default function BackButton({
  onClick,
  className = 'absolute top-[68px] left-3 z-[120]',
  label = 'Go back',
}: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid="btn-back"
      className={`${className} w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-md border border-gray-100 flex items-center justify-center active:scale-90 transition`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )
}
