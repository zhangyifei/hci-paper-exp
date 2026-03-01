import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HCI Experiment',
  description: 'Super-app flow study',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="device-frame">
          <div className="device-screen">
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
