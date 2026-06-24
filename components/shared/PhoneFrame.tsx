'use client'

import React from 'react'

interface PhoneFrameProps {
  children: React.ReactNode
  /**
   * Optional overlay rendered above the scrolling screen content but inside
   * the device bezel (e.g. persistent task indicator, guidance banner).
   * Overlay nodes should position themselves (absolute / fixed-within-frame).
   */
  overlay?: React.ReactNode
}

/**
 * Wraps the interactive Super App so it appears inside a realistic mobile
 * phone frame on desktop and full-screen on mobile. Only Super App task
 * screens use this wrapper; research pages render full-browser via
 * <ResearchPage> instead.
 */
export default function PhoneFrame({ children, overlay }: PhoneFrameProps) {
  return (
    <div className="phone-stage">
      <div className="device-frame">
        <div className="device-screen">{children}</div>
        {overlay}
      </div>
    </div>
  )
}
