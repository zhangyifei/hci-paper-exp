import React from 'react'

export default function BottomNav() {
  return (
    <div className="fixed bottom-0 left-0 w-full h-[88px] bg-white border-t border-gray-100 flex justify-around items-start pt-3 pb-8 z-50 max-w-[390px]">
      <div className="flex flex-col items-center text-black">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        <span className="text-[10px] font-medium mt-1">Home</span>
      </div>
      <div className="flex flex-col items-center text-gray-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 10a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm10-10a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 10a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" clipRule="evenodd" />
        </svg>
        <span className="text-[10px] font-medium mt-1">Services</span>
      </div>
      <div className="flex flex-col items-center text-gray-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        <span className="text-[10px] font-medium mt-1">Activity</span>
      </div>
      <div className="flex flex-col items-center text-gray-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
        <span className="text-[10px] font-medium mt-1">Account</span>
      </div>
    </div>
  )
}
