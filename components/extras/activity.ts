import type { Transaction } from '@/lib/types'

// Filter values. Sentinels can't collide with a listed reason or a name.
export const ALL = '__all__'
export const NO_REASON = '__none__'
export const UNKNOWN_STAFF = '__unknown__'

export type ActivityFilters = { reason: string; staff: string }

// Newest first; entries sharing a timestamp (a transfer pair) keep the order
// they were recorded in.
export function newestFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  )
}

export function filterActivity(
  transactions: Transaction[],
  filters: ActivityFilters,
): Transaction[] {
  return transactions.filter((t) => {
    if (filters.reason !== ALL && (t.reason ?? NO_REASON) !== filters.reason) {
      return false
    }
    if (filters.staff !== ALL && (t.staffName ?? UNKNOWN_STAFF) !== filters.staff) {
      return false
    }
    return true
  })
}

export function staffNames(transactions: Transaction[]): string[] {
  const names = new Set<string>()
  for (const t of transactions) if (t.staffName) names.add(t.staffName)
  return Array.from(names).sort()
}
