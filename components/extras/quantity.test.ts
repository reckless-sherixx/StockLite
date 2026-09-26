import { describe, expect, it } from 'vitest'
import { parseQuantityInput } from './quantity'

describe('parseQuantityInput', () => {
  it('accepts whole numbers above zero, ignoring surrounding spaces', () => {
    expect(parseQuantityInput('12')).toEqual({ ok: true, quantity: 12 })
    expect(parseQuantityInput(' 7 ')).toEqual({ ok: true, quantity: 7 })
  })

  it('rejects empty, zero, negative, fractional and non-numeric input', () => {
    for (const text of ['', '   ', '0', '-1', '1.5', 'abc', 'Infinity']) {
      expect(parseQuantityInput(text)).toEqual({
        ok: false,
        error: 'Enter a whole number greater than 0.',
      })
    }
  })

  it('enforces the maximum when one is given', () => {
    expect(parseQuantityInput('10', 10)).toEqual({ ok: true, quantity: 10 })
    expect(parseQuantityInput('11', 10)).toEqual({
      ok: false,
      error: 'Only 10 in stock.',
    })
    expect(parseQuantityInput('1', 0)).toEqual({
      ok: false,
      error: 'Only 0 in stock.',
    })
  })
})
