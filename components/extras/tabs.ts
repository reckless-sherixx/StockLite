export const EXTRAS_TABS = [
  { id: 'stock-by-product', label: 'Stock by product' },
  { id: 'suggested-transfers', label: 'Suggested transfers' },
  { id: 'quick-actions', label: 'Quick actions' },
  { id: 'activity', label: 'Activity log' },
] as const

export type ExtrasTabId = (typeof EXTRAS_TABS)[number]['id']

export const DEFAULT_EXTRAS_TAB: ExtrasTabId = 'stock-by-product'

// Reads ?tab= from the URL; anything unknown opens the default tab.
export function parseExtrasTab(
  value: string | string[] | undefined,
): ExtrasTabId {
  const candidate = Array.isArray(value) ? value[0] : value
  const match = EXTRAS_TABS.find((tab) => tab.id === candidate)
  return match ? match.id : DEFAULT_EXTRAS_TAB
}
