import type { Metadata, Viewport } from 'next'
import { Big_Shoulders_Display, Public_Sans } from 'next/font/google'
import 'lenis/dist/lenis.css'
import './globals.css'

const display = Big_Shoulders_Display({
  subsets: ['latin'],
  variable: '--font-big-shoulders',
  weight: ['600', '700', '800', '900'],
})
const sans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: {
    default: 'StockLite — Warehouse Inventory',
    template: '%s — StockLite',
  },
  description: 'Warehouse inventory system for the StockLite coding exercise.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#eceef0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        {children}
        {/* Ink texture for the rubber stamps (.stamp uses filter: url(#ink)). */}
        <svg
          width="0"
          height="0"
          style={{ position: 'absolute' }}
          aria-hidden="true"
          focusable="false"
        >
          <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves={2}
              seed={4}
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.9 0 0 0 1.6"
              result="mask"
            />
            <feComposite in="SourceGraphic" in2="mask" operator="in" />
          </filter>
        </svg>
      </body>
    </html>
  )
}
