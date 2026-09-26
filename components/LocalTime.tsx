'use client'

import { useIsClient } from '@/components/useIsClient'

// Locale-independent, e.g. "2026-09-17 11:20 UTC".
function formatUtc(iso: string) {
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`
}

// The server and the browser can differ in locale and time zone, so
// rendering toLocaleString() on both breaks hydration. Server HTML and the
// hydrating render show a fixed UTC string; after that (and on client-side
// navigations) it is the viewer's local time.
export default function LocalTime({ iso }: { iso: string }) {
  const isClient = useIsClient()
  return (
    <time dateTime={iso}>
      {isClient ? new Date(iso).toLocaleString() : formatUtc(iso)}
    </time>
  )
}
