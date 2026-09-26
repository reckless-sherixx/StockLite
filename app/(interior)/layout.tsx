import InteriorShell from '@/components/InteriorShell'
import { getCurrentUser } from '@/lib/auth'
import { getSectionCounts } from './section-counts'

// Reads the in-memory store, so it must render per request.
export const dynamic = 'force-dynamic'

// One shell for every interior route; it stays mounted across navigations
// so drawer and folder transitions can animate between pages.
export default function InteriorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = getCurrentUser()
  const initials = user.name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
  return (
    <InteriorShell
      user={{ name: user.name, initials }}
      counts={getSectionCounts()}
    >
      {children}
    </InteriorShell>
  )
}
