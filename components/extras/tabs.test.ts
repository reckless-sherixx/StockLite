import { describe, expect, it } from 'vitest'
import { DEFAULT_EXTRAS_TAB, EXTRAS_TABS, parseExtrasTab } from './tabs'

describe('parseExtrasTab', () => {
  it('accepts every known tab id', () => {
    for (const tab of EXTRAS_TABS) expect(parseExtrasTab(tab.id)).toBe(tab.id)
  })

  it('falls back to the default for missing or unknown values', () => {
    expect(DEFAULT_EXTRAS_TAB).toBe('stock-by-product')
    expect(parseExtrasTab(undefined)).toBe(DEFAULT_EXTRAS_TAB)
    expect(parseExtrasTab('')).toBe(DEFAULT_EXTRAS_TAB)
    expect(parseExtrasTab('nope')).toBe(DEFAULT_EXTRAS_TAB)
    expect(parseExtrasTab('Activity')).toBe(DEFAULT_EXTRAS_TAB)
  })

  it('uses the first value when the param is repeated', () => {
    expect(parseExtrasTab(['activity', 'quick-actions'])).toBe('activity')
    expect(parseExtrasTab(['nope', 'activity'])).toBe(DEFAULT_EXTRAS_TAB)
  })
})
