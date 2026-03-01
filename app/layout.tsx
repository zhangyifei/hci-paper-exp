import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HCI Experiment',
  description: 'Super-app flow study',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-[390px] min-h-screen bg-white relative overflow-hidden shadow-xl">
          {children}
        </div>
      </body>
    </html>
  )
}
