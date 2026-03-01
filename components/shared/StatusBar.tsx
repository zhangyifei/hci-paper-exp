import React, { useState, useEffect } from 'react'

export default function StatusBar() {
  const [time, setTime] = useState('9:41')

  useEffect(() => {
    // Optional: make time dynamic, though static 9:41 is also classic iOS
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/^0/, ''))
    }
    const interval = setInterval(updateTime, 1000)
    updateTime()
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex justify-between items-center px-5 h-[59px] pt-[28px] w-full bg-transparent absolute top-0 z-50 text-black font-semibold select-none pointer-events-none">
      <div className="text-[15px] tracking-[-0.01em] font-semibold min-w-[54px]">{time}</div>
      <div className="flex items-center gap-[5px]">
        {/* Signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <rect x="0" y="7" width="3" height="4" rx="0.5" opacity="0.35" />
          <rect x="4.5" y="5" width="3" height="6" rx="0.5" opacity="0.55" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" opacity="0.8" />
          <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
        </svg>
        {/* Wifi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
          <path d="M7.5 10.5a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" />
          <path d="M4.7 7.2a4 4 0 015.6 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M2.3 4.8a7.2 7.2 0 0110.4 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {/* Battery */}
        <svg width="25" height="11" viewBox="0 0 25 11" fill="currentColor">
          <rect x="0.5" y="0.5" width="21" height="10" rx="2" stroke="currentColor" fill="none" strokeWidth="1" opacity="0.4" />
          <rect x="2" y="2" width="18" height="7" rx="1" />
          <path d="M23 3.5c.8 0 1.5.6 1.5 1.5v1c0 .9-.7 1.5-1.5 1.5V3.5z" opacity="0.4" />
        </svg>
      </div>
    </div>
  )
}

