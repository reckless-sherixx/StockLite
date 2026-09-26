export type QuantityCheck =
  | { ok: true; quantity: number }
  | { ok: false; error: string }

// Mirrors the server rule (whole number above 0) so bad input is caught
// before a request. Pass `max` when the action removes stock.
export function parseQuantityInput(text: string, max?: number): QuantityCheck {
  const trimmed = text.trim()
  const quantity = Number(trimmed)
  if (!trimmed || !Number.isSafeInteger(quantity) || quantity <= 0) {
    return { ok: false, error: 'Enter a whole number greater than 0.' }
  }
  if (max !== undefined && quantity > max) {
    return { ok: false, error: `Only ${max} in stock.` }
  }
  return { ok: true, quantity }
}
