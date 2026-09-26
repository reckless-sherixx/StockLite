import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Icon from '@/components/Icon'
import InteriorLink from '@/components/InteriorLink'
import { ARCHIVE, SECTIONS } from '@/components/sections'
import { getSectionCounts } from '../section-counts'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: ARCHIVE.title }

// Each folder leans a little in its compartment until hovered.
const TILT = [-1.4, 1.1, -0.8, 1.5]

// The lobby: every file as a compartment in one cabinet front. Choosing one
// Flips the compartments into the drawer rail (see InteriorShell).
export default function ArchivePage() {
  const counts = getSectionCounts()
  return (
    <section className="lobby">
      <h1 className="lobby-title" tabIndex={-1}>
        Jump into StockLite
      </h1>
      <ul className="cabinet-front">
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <InteriorLink
              href={s.href}
              className="cubby"
              data-flip-id={`drawer-${s.id}`}
              data-id={s.id}
              style={{ '--tilt': `${TILT[i % TILT.length]}deg` } as CSSProperties}
            >
              <span className="cubby-back" aria-hidden="true" />
              <span className="cubby-folder">
                <span className="cubby-tab">
                  <span className="dymo">{s.label}</span>
                </span>
                <span className="cubby-icon">
                  <Icon name={s.icon} className="ic ic-lg" />
                </span>
                <span className="cubby-title">{s.title}</span>
                <span className="cubby-desc">{s.desc}</span>
                <span className="cubby-stat">
                  <span>{s.stat(counts)}</span>
                  <Icon name="arrow" className="ic ic-sm" strokeWidth={2.6} />
                </span>
              </span>
            </InteriorLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
