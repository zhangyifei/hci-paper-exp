import React from 'react'

export default function BottomNav() {
  const [activeTab, setActiveTab] = React.useState('home')

  const TabItem = ({ id, label, icon }: { id: string, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-90 ${activeTab === id ? 'text-black' : 'text-gray-400'}`}
    >
      <div className="mb-0.5">{icon}</div>
      <span className="text-[10px] font-medium tracking-tight">{label}</span>
    </button>
  )

  return (
    <div className="sticky bottom-0 w-full bg-white/95 backdrop-blur-xl border-t border-gray-100/80 pb-[20px] mobile-safe-bottom pt-1.5 z-50">
      <div className="flex justify-around items-center h-[44px] px-2">
        <TabItem 
          id="home" 
          label="Home" 
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'home' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeTab === 'home' ? "0" : "1.8"}>
              <path d="M3 9.5L12 2.5L21 9.5V20.5C21 21.0523 20.5523 21.5 20 21.5H15V14.5H9V21.5H4C3.44772 21.5 3 21.0523 3 20.5V9.5Z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          } 
        />
        <TabItem 
          id="services" 
          label="Services" 
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'services' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeTab === 'services' ? "0" : "1.8"}>
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
            </svg>
          } 
        />
        <TabItem 
          id="activity" 
          label="Activity" 
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'activity' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeTab === 'activity' ? "0" : "1.8"}>
              <path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 4.93L16.24 7.76M7.76 16.24L4.93 19.07M19.07 19.07L16.24 16.24M7.76 7.76L4.93 4.93" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          } 
        />
        <TabItem 
          id="account" 
          label="Account" 
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'account' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeTab === 'account' ? "0" : "1.8"}>
              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          } 
        />
      </div>
      {/* Home Indicator */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-[134px] h-[5px] bg-black rounded-full opacity-30"></div>
    </div>
  )
}

