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
    <div className="flex justify-between items-end px-6 pb-2 h-[47px] w-full bg-transparent absolute top-0 z-50 text-black font-medium select-none pointer-events-none">
      <div className="text-[16px] tracking-[-0.02em] font-semibold w-[54px] text-center">{time}</div>
      
      {/* Dynamic Island Area (conceptual) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[11px] w-[120px] h-[35px] bg-black rounded-[20px] opacity-0" />

      <div className="flex items-center gap-[6px] w-[54px] justify-end">
        {/* Signal */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <path d="M1.5 7.5C1.5 7.22386 1.72386 7 2 7H3C3.27614 7 3.5 7.22386 3.5 7.5V10.5C3.5 10.7761 3.27614 11 3 11H2C1.72386 11 1.5 10.7761 1.5 10.5V7.5Z" />
          <path d="M6 5C6 4.72386 6.22386 4.5 6.5 4.5H7.5C7.77614 4.5 8 4.72386 8 5V10.5C8 10.7761 7.77614 11 7.5 11H6.5C6.22386 11 6 10.7761 6 10.5V5Z" />
          <path d="M10.5 2.5C10.5 2.22386 10.7239 2 11 2H12C12.2761 2 12.5 2.22386 12.5 2.5V10.5C12.5 10.7761 12.2761 11 12 11H11C10.7239 11 10.5 10.7761 10.5 10.5V2.5Z" />
          <path d="M15 0.5C15 0.223858 15.2239 0 15.5 0H16.5C16.7761 0 17 0.223858 17 0.5V10.5C17 10.7761 16.7761 11 16.5 11H15.5C15.2239 11 15 10.7761 15 10.5V0.5Z" />
        </svg>
        {/* Wifi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M8 1.5C5.43773 1.5 3.08493 2.45428 1.28296 4.02982L8 10.7469L14.717 4.02982C12.9151 2.45428 10.5623 1.5 8 1.5Z" />
        </svg>
        {/* Battery */}
        <svg width="26" height="12" viewBox="0 0 26 12" fill="currentColor">
          <rect x="1" y="0.5" width="21" height="11" rx="2.5" stroke="currentColor" fill="none" strokeWidth="1"/>
          <path d="M23 4C23.5523 4 24 4.44772 24 5V7C24 7.55228 23.5523 8 23 8V4Z" />
          <rect x="3" y="2.5" width="17" height="7" rx="1" />
        </svg>
      </div>
    </div>
  )
}

