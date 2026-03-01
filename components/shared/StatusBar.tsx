import React from 'react'

export default function StatusBar() {
  return (
    <div className="flex justify-between items-center px-5 h-[44px] w-full bg-transparent absolute top-0 z-50 text-black">
      <div className="font-semibold text-[15px] tracking-tight ml-2">9:41</div>
      <div className="flex items-center space-x-1.5 mr-2">
        {/* Signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <path d="M1 7.5C1 7.22386 1.22386 7 1.5 7H2.5C2.77614 7 3 7.22386 3 7.5V10.5C3 10.7761 2.77614 11 2.5 11H1.5C1.22386 11 1 10.7761 1 10.5V7.5Z" />
          <path d="M5.5 5C5.22386 5 5 5.22386 5 5.5V10.5C5 10.7761 5.22386 11 5.5 11H6.5C6.77614 11 7 10.7761 7 10.5V5.5C7 5.22386 6.77614 5 6.5 5H5.5Z" />
          <path d="M9.5 2.5C9.22386 2.5 9 2.72386 9 3V10.5C9 10.7761 9.22386 11 9.5 11H10.5C10.7761 11 11 10.7761 11 10.5V3C11 2.72386 10.7761 2.5 10.5 2.5H9.5Z" />
          <path d="M13.5 0.5C13.2239 0.5 13 0.723858 13 1V10.5C13 10.7761 13.2239 11 13.5 11H14.5C14.7761 11 15 10.7761 15 10.5V1C15 0.723858 14.7761 0.5 14.5 0.5H13.5Z" />
        </svg>
        {/* Wifi */}
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M8 1.5C5.43773 1.5 3.08493 2.45428 1.28296 4.02982L8 10.7469L14.717 4.02982C12.9151 2.45428 10.5623 1.5 8 1.5Z" />
        </svg>
        {/* Battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="currentColor">
          <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="currentColor" fill="none"/>
          <path d="M23 4C23.5523 4 24 4.44772 24 5V7C24 7.55228 23.5523 8 23 8V4Z" />
          <rect x="2" y="2" width="18" height="8" rx="1.5" />
        </svg>
      </div>
    </div>
  )
}
