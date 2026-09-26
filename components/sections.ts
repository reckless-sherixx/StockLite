import type { IconName } from '@/components/Icon'

// Live totals the drawers and lobby compartments print ("20 SKUs").
// Computed on the server from lib/seed-data.ts and passed down as plain data.
export type SectionCounts = {
  products: number
  warehouses: number
  transactions: number
}

// One entry per file in the cabinet: drives the lobby compartments, the
// drawer rail, the floor indicator and page titles. Add a drawer here.
export type Section = {
  id: string
  href: string
  label: string // dymo tape on the drawer, cubby and folder tab
  title: string // compartment heading in the lobby
  floor: string // floor indicator and document title
  desc: string
  icon: IconName
  stat: (counts: SectionCounts) => string
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export const SECTIONS: Section[] = [
  {
    id: 'inventory',
    href: '/inventory',
    label: 'Inventory',
    title: 'Inventory',
    floor: 'Inventory',
    desc: 'Every SKU, every warehouse, with stock status at a glance.',
    icon: 'inventory',
    stat: (c) => plural(c.products, 'SKU'),
  },
  {
    id: 'stock',
    href: '/stock',
    label: 'Stock In / Out',
    title: 'Stock In / Out',
    floor: 'Stock In / Out',
    desc: 'Record incoming or outgoing stock for a single warehouse.',
    icon: 'stock',
    stat: (c) => plural(c.products, 'product'),
  },
  {
    id: 'transfer',
    href: '/transfer',
    label: 'Transfer',
    title: 'Transfer',
    floor: 'Transfer',
    desc: 'Move stock between warehouses without risking a partial write.',
    icon: 'transfer',
    stat: (c) => plural(c.warehouses, 'warehouse'),
  },
  {
    id: 'history',
    href: '/history',
    label: 'History',
    title: 'Transaction History',
    floor: 'History',
    desc: 'Every stock in, out, and transfer logged with a timestamp.',
    icon: 'history',
    stat: (c) => plural(c.transactions, 'entry', 'entries'),
  },
  {
    id: 'extras',
    href: '/extras',
    label: 'Extra features',
    title: 'Extra features',
    floor: 'Extra features',
    desc: 'Stock by product, suggested transfers, quick actions and an activity log.',
    icon: 'extras',
    stat: () => '4 tools',
  },
]

export const ARCHIVE = { href: '/archive', title: 'Archive' }
export const LOGIN = { href: '/login', title: 'Sign in' }

// Where a pathname sits in the building: the lobby, the badge desk, one of
// the files, or outside the interior (null).
export type InteriorRoute =
  | { kind: 'archive'; title: string }
  | { kind: 'login'; title: string }
  | { kind: 'file'; title: string; section: Section }

export function interiorRoute(pathname: string): InteriorRoute | null {
  if (pathname === ARCHIVE.href) return { kind: 'archive', title: ARCHIVE.title }
  if (pathname === LOGIN.href) return { kind: 'login', title: LOGIN.title }
  const section = SECTIONS.find((s) => s.href === pathname)
  return section ? { kind: 'file', title: section.floor, section } : null
}

export function sectionById(id: string): Section {
  const section = SECTIONS.find((s) => s.id === id)
  if (!section) throw new Error(`Unknown section: ${id}`)
  return section
}
