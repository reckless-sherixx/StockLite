# Extra Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ★ Extra features sidebar tab holding four tools — Stock by product, Suggested transfers, Quick actions, Activity log — record a reason and staff member on every stock movement, and log every transaction to the server terminal.

**Architecture:** A server page `/extras` passes the in-memory store's data to one client component (`ExtrasWorkspace`) that owns shared `products`/`transactions` state and renders four tabs; every tab posts through one typed helper (`postItems`) and feeds the result back so all tabs update together. Calculations live in pure, unit-tested modules (`lib/insights.ts`, `components/extras/*.ts`); the store gains optional `reason`/`staff` on transactions, stamped server-side, and a logger called from the single `recordTransaction` write path.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript 5 (strict), plain CSS in `app/globals.css`, Vitest (new dev dependency) for unit tests.

**Spec:** `docs/superpowers/specs/2026-09-26-extra-features-design.md`

## Global Constraints

- Repo root: `C:\Users\KIIT\OneDrive\Documents\Code\StockLite`, branch `extra-features`. Shell is Git Bash on Windows; run every command from the repo root.
- Next.js `14.2.5`, React 18, TypeScript strict. **No new runtime dependencies.** Only new dev dependency: `vitest`.
- Code style (match existing files): 2-space indent, **no semicolons**, single quotes, trailing commas, `@/` imports in app/components code, relative imports inside `lib/`. Comments are sparse and explain *why*.
- Colors only via CSS custom properties in `app/globals.css` (`--ink`, `--moss`, `--rust`, `--steel`, …). No inline hex in TSX.
- Existing pages `/inventory`, `/stock`, `/transfer`, `/history` must behave exactly as before. Allowed shared changes: the new sidebar item, `components/TransactionTable.tsx` switching to the shared `<LocalTime>` and shared type labels (identical output).
- Staff is **always** taken server-side from `getCurrentUser()` (`lib/auth.ts`); request bodies can never set it.
- Allowed reasons, exactly: `'Restock', 'Customer order', 'Customer return', 'Damaged', 'Count correction', 'Rebalancing', 'Other'`.
- Low stock rule everywhere: `currentStock <= reorderThreshold` (use `isLowStock` from `lib/types.ts`).
- Commit messages: imperative subject, **no `Co-Authored-By` or any Claude attribution trailer**.
- Do **not** start a dev server or run `npm run build` (the controller does integration checks). Verify with `npx vitest run …` and `npx tsc --noEmit`.
- Vitest can only run `.ts` test files here (tsconfig uses `jsx: preserve`). Keep testable logic in `.ts` modules; `.tsx` components stay thin.

## Review Focus

- **Double-clicking Transfer / Submit** must send one request: buttons are `disabled` while a request is pending (Tasks 5, 6; checked in the controller's browser pass).
- **Stale numbers** (stock changed in another tab or on the old pages) — the server rejects; the card/panel shows the server's message and client state is unchanged (Task 1 route test for insufficient stock; Task 3 `postItems` error test).
- **Hand-edited quantities** (empty, `0`, `-1`, `1.5`, `abc`, more than in stock) must show an inline error and send no request (Task 3 `parseQuantityInput` tests).
- **Bad deep links** (`/extras?tab=nope`, `?tab=a&tab=b`) must open the default tab (Task 3 `parseExtrasTab` tests).
- **Malformed reasons** in API bodies (`5`, `{}`, `'damaged'`) → `400 Unknown reason` with nothing written (Task 1 route tests).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `vitest.config.mts` | Vitest config (`@/` alias, node env) | 1 |
| `lib/types.ts` | + `MOVEMENT_REASONS`, `MovementReason`, `isMovementReason`, Transaction fields (1); + `TRANSACTION_TYPE_LABELS` (4) | 1, 4 |
| `lib/seed-data.ts` | Store: reason/staff options, `recorded` returns (1); logging hook (2) | 1, 2 |
| `app/api/items/route.ts` | Reason parsing, server-side staff, `recorded` (1); rejection logging (2) | 1, 2 |
| `lib/transaction-log.ts` | Terminal line formatting + `console.log`/`console.warn` | 2 |
| `components/Sidebar.tsx`, `components/DashboardShell.tsx` | ★ Extra features nav item + title | 3 |
| `app/extras/page.tsx` | Server page, loads data, reads `?tab=` | 3 |
| `components/extras/tabs.ts` | Tab ids/labels, `parseExtrasTab` | 3 |
| `components/extras/types.ts` | `ExtrasContext` passed to every tab | 3 |
| `components/extras/api.ts` | `postItems` typed client for `POST /api/items` | 3 |
| `components/extras/quantity.ts` | `parseQuantityInput` shared client validation | 3 |
| `components/extras/ExtrasWorkspace.tsx` | Shared state + tab bar | 3 |
| `components/LocalTime.tsx` | Hydration-safe timestamp (moved out of TransactionTable) | 3 |
| `components/extras/ActivityLog.tsx` + `activity.ts` | Tab 4 + its pure helpers | 3 (placeholder), 4 |
| `lib/insights.ts` | `summarizeByProduct`, `suggestTransfers` (pure) | 5 |
| `components/extras/StockByProduct.tsx` | Tab 1 | 3 (placeholder), 5 |
| `components/extras/SuggestedTransfers.tsx` | Tab 2 | 3 (placeholder), 5 |
| `components/extras/QuickActions.tsx` + `quick-actions.ts` | Tab 3 + its pure helpers | 3 (placeholder), 6 |
| `app/globals.css` | Styles appended per task | 3, 5, 6 |

Model per task (subagent-driven): **1 Opus · 2 Haiku · 3 Haiku · 4 Sonnet · 5 Opus · 6 Sonnet.**

---

### Task 1: Reason + staff on every movement (data model, store, API) — Opus

**Files:**
- Create: `vitest.config.mts`, `lib/seed-data.test.ts`, `app/api/items/route.test.ts`
- Modify: `package.json` (devDependency + `test` script), `.gitignore`, `lib/types.ts`, `lib/seed-data.ts`, `app/api/items/route.ts`

**Interfaces:**
- Consumes: existing `applyStockMovement`, `applyTransfer`, `recordTransaction` in `lib/seed-data.ts`; `getCurrentUser()` from `lib/auth.ts`.
- Produces:
  - `lib/types.ts`: `MOVEMENT_REASONS` (readonly tuple), `type MovementReason`, `isMovementReason(value: unknown): value is MovementReason`, and `Transaction` gains `reason?: MovementReason; staffId?: string; staffName?: string`.
  - `lib/seed-data.ts`:
    - `applyStockMovement(productId: string, quantity: number, direction: 'IN' | 'OUT', options?: { reason?: MovementReason; staff?: StaffUser }): { product: Product; recorded: Transaction[] }`
    - `applyTransfer(productId: string, destWarehouseId: string, quantity: number, options?: { sourceWarehouseId?: string; reason?: MovementReason; staff?: StaffUser }): { source: Product; destination: Product; recorded: Transaction[] }` (`recorded` is `[TRANSFER_OUT, TRANSFER_IN]`)
  - `POST /api/items` accepts optional `reason`; responses keep all existing fields and add `recorded: Transaction[]`.

- [ ] **Step 1: Install Vitest and add the test script**

Run: `npm install --save-dev vitest`

Then in `package.json` add to `"scripts"` (keep the others):

```json
    "test": "vitest run"
```

Append this line to `.gitignore` (the file uses CRLF line endings; keep them):

```
*.tsbuildinfo
```

- [ ] **Step 2: Create `vitest.config.mts`**

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': root },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
})
```

- [ ] **Step 3: Write the failing store tests** — create `lib/seed-data.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { applyStockMovement, applyTransfer, transactions } from './seed-data'
import { isMovementReason, type StaffUser } from './types'

const staff: StaffUser = { id: 'staff-01', name: 'Jordan Ruiz', role: 'staff' }

describe('applyStockMovement', () => {
  it('records reason and staff and returns the new transaction', () => {
    const { product, recorded } = applyStockMovement('p-001', 5, 'IN', {
      reason: 'Restock',
      staff,
    })
    expect(product.id).toBe('p-001')
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({
      productId: 'p-001',
      type: 'IN',
      quantity: 5,
      reason: 'Restock',
      staffId: 'staff-01',
      staffName: 'Jordan Ruiz',
    })
    expect(transactions).toContain(recorded[0])
  })

  it('works without options', () => {
    const { recorded } = applyStockMovement('p-001', 1, 'OUT')
    expect(recorded[0].reason).toBeUndefined()
    expect(recorded[0].staffName).toBeUndefined()
  })

  it('records nothing when the movement is rejected', () => {
    const before = transactions.length
    expect(() =>
      applyStockMovement('p-007', 999, 'OUT', { reason: 'Damaged', staff }),
    ).toThrow(/Cannot stock out/)
    expect(transactions.length).toBe(before)
  })
})

describe('applyTransfer', () => {
  it('stamps reason and staff on both linked transactions', () => {
    const { source, destination, recorded } = applyTransfer('p-011', 'wh-south', 3, {
      sourceWarehouseId: 'wh-north',
      reason: 'Rebalancing',
      staff,
    })
    expect(source.id).toBe('p-011')
    expect(destination.id).toBe('p-012')
    expect(recorded.map((t) => t.type)).toEqual(['TRANSFER_OUT', 'TRANSFER_IN'])
    for (const t of recorded) {
      expect(t).toMatchObject({ quantity: 3, reason: 'Rebalancing', staffName: 'Jordan Ruiz' })
    }
    expect(recorded[0].linkedTransactionId).toBe(recorded[1].id)
    expect(recorded[1].linkedTransactionId).toBe(recorded[0].id)
  })

  it('still checks the source warehouse passed in options', () => {
    expect(() =>
      applyTransfer('p-011', 'wh-south', 1, { sourceWarehouseId: 'wh-south' }),
    ).toThrow(/not stocked at the selected source/)
  })
})

describe('isMovementReason', () => {
  it('accepts listed reasons only, exactly as written', () => {
    expect(isMovementReason('Damaged')).toBe(true)
    expect(isMovementReason('Count correction')).toBe(true)
    expect(isMovementReason('damaged')).toBe(false)
    expect(isMovementReason('')).toBe(false)
    expect(isMovementReason(undefined)).toBe(false)
    expect(isMovementReason(5)).toBe(false)
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run lib/seed-data.test.ts`
Expected: FAIL — `isMovementReason` is not exported / `recorded` is undefined.

- [ ] **Step 5: Add reasons and transaction fields to `lib/types.ts`**

In the `Transaction` type, after `linkedTransactionId?: string // pairs TRANSFER_OUT with TRANSFER_IN` add:

```ts
  reason?: MovementReason
  // Who recorded it. Always set server-side from the signed-in staff user.
  staffId?: string
  staffName?: string
```

After the `StaffUser` type add:

```ts
// Why stock moved. Optional on every movement; the list is fixed so reports
// can group by it.
export const MOVEMENT_REASONS = [
  'Restock',
  'Customer order',
  'Customer return',
  'Damaged',
  'Count correction',
  'Rebalancing',
  'Other',
] as const

export type MovementReason = (typeof MOVEMENT_REASONS)[number]

export function isMovementReason(value: unknown): value is MovementReason {
  return (
    typeof value === 'string' &&
    (MOVEMENT_REASONS as readonly string[]).includes(value)
  )
}
```

- [ ] **Step 6: Thread reason/staff through `lib/seed-data.ts`**

Change the import on line 1 to:

```ts
import {
  MovementReason,
  Product,
  StaffUser,
  Transaction,
  TransactionType,
  Warehouse,
} from './types'
```

Below the `assertValidQuantity` function add:

```ts
type MovementOptions = {
  reason?: MovementReason
  staff?: StaffUser
}
```

In `recordTransaction`, add to the `input` type:

```ts
  reason?: MovementReason
  staff?: StaffUser
```

and add to the `tx` object literal, after `linkedTransactionId: input.linkedTransactionId,`:

```ts
    reason: input.reason,
    staffId: input.staff?.id,
    staffName: input.staff?.name,
```

Replace the whole `applyStockMovement` function with:

```ts
// Applies a stock in/out movement to a single product row (one warehouse)
// and logs it. Validates everything before writing, so a rejected movement
// leaves stock and history untouched.
export function applyStockMovement(
  productId: string,
  quantity: number,
  direction: 'IN' | 'OUT',
  options: MovementOptions = {},
): { product: Product; recorded: Transaction[] } {
  const product = findProduct(productId)
  if (!product) throw new Error('Product not found')

  assertValidQuantity(quantity)
  if (direction === 'OUT' && quantity > product.currentStock) {
    throw new Error(
      `Cannot stock out ${quantity} — only ${product.currentStock} in stock`,
    )
  }

  product.currentStock += direction === 'IN' ? quantity : -quantity

  const tx = recordTransaction({
    productId: product.id,
    productName: product.name,
    warehouseId: product.warehouseId,
    type: direction,
    quantity,
    reason: options.reason,
    staff: options.staff,
  })

  return { product, recorded: [tx] }
}
```

In `applyTransfer`:
1. Replace the signature with:

```ts
export function applyTransfer(
  productId: string,
  destWarehouseId: string,
  quantity: number,
  options: MovementOptions & { sourceWarehouseId?: string } = {},
): { source: Product; destination: Product; recorded: Transaction[] } {
  const { sourceWarehouseId } = options
```

(keep the rest of the body; the existing `sourceWarehouseId` checks now read this local.)

2. Add `reason: options.reason,` and `staff: options.staff,` to **both** `recordTransaction({ ... })` calls.
3. Replace the final `return { source, destination }` with:

```ts
  return { source, destination, recorded: [transferOut, transferIn] }
```

- [ ] **Step 7: Run the store tests to verify they pass**

Run: `npx vitest run lib/seed-data.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Write the failing route tests** — create `app/api/items/route.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { transactions, findProduct } from '@/lib/seed-data'
import { POST } from './route'

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

describe('POST /api/items — reason and staff', () => {
  it('records the reason and the server-side staff user', async () => {
    const res = await post({
      action: 'stock',
      productId: 'p-001',
      quantity: 2,
      direction: 'IN',
      reason: 'Restock',
      staffName: 'Mallory', // must be ignored
      staffId: 'staff-99', // must be ignored
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.product.id).toBe('p-001')
    expect(Array.isArray(data.products)).toBe(true)
    expect(data.recorded).toHaveLength(1)
    expect(data.recorded[0]).toMatchObject({
      reason: 'Restock',
      staffId: 'staff-01',
      staffName: 'Jordan Ruiz',
    })
  })

  it('treats a missing, null or empty reason as no reason', async () => {
    for (const reason of [undefined, null, '']) {
      const res = await post({
        action: 'stock',
        productId: 'p-001',
        quantity: 1,
        direction: 'IN',
        reason,
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.recorded[0].reason).toBeUndefined()
      expect(data.recorded[0].staffName).toBe('Jordan Ruiz')
    }
  })

  it('rejects unknown or malformed reasons without writing anything', async () => {
    const before = transactions.length
    const stock = findProduct('p-001')!.currentStock
    for (const reason of ['Because', 'damaged', 5, {}, ['Restock']]) {
      const res = await post({
        action: 'stock',
        productId: 'p-001',
        quantity: 1,
        direction: 'IN',
        reason,
      })
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('Unknown reason')
    }
    expect(transactions.length).toBe(before)
    expect(findProduct('p-001')!.currentStock).toBe(stock)
  })

  it('returns both linked transactions for a transfer', async () => {
    const res = await post({
      action: 'transfer',
      productId: 'p-011',
      sourceWarehouseId: 'wh-north',
      destWarehouseId: 'wh-south',
      quantity: 2,
      reason: 'Rebalancing',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.source.id).toBe('p-011')
    expect(data.destination.id).toBe('p-012')
    expect(data.recorded.map((t: { type: string }) => t.type)).toEqual([
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ])
    expect(data.recorded[1].reason).toBe('Rebalancing')
  })

  it('rejects an unknown reason on a transfer before moving stock', async () => {
    const source = findProduct('p-011')!.currentStock
    const res = await post({
      action: 'transfer',
      productId: 'p-011',
      destWarehouseId: 'wh-south',
      quantity: 1,
      reason: 'Nope',
    })
    expect(res.status).toBe(400)
    expect(findProduct('p-011')!.currentStock).toBe(source)
  })

  it('rejects a transfer larger than the source stock and records nothing', async () => {
    const before = transactions.length
    const res = await post({
      action: 'transfer',
      productId: 'p-015',
      destWarehouseId: 'wh-north',
      quantity: 999,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Cannot transfer 999/)
    expect(transactions.length).toBe(before)
  })
})
```

- [ ] **Step 9: Run it to verify it fails**

Run: `npx vitest run app/api/items/route.test.ts`
Expected: FAIL — `recorded` undefined / unknown reason accepted.

- [ ] **Step 10: Update `app/api/items/route.ts`**

Replace the imports at the top with:

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { applyStockMovement, applyTransfer, products } from '@/lib/seed-data'
import { isMovementReason, MovementReason } from '@/lib/types'
```

Below `toQuantity` add:

```ts
// Optional. Anything other than a listed reason is rejected rather than
// silently dropped, so a typo in a client can't lose the reason.
function toReason(value: unknown): MovementReason | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (isMovementReason(value)) return value
  throw new Error('Unknown reason')
}
```

In the `action === 'stock'` branch, replace the `applyStockMovement(...)` call and its `return` with:

```ts
      const { product, recorded } = applyStockMovement(
        productId,
        toQuantity(body.quantity),
        direction,
        { reason: toReason(body.reason), staff: getCurrentUser() },
      )
      return NextResponse.json({ product, products, recorded })
```

In the `action === 'transfer'` branch, replace the `applyTransfer(...)` call and its `return` with:

```ts
      const { source, destination, recorded } = applyTransfer(
        productId,
        destWarehouseId,
        toQuantity(body.quantity),
        {
          sourceWarehouseId,
          reason: toReason(body.reason),
          staff: getCurrentUser(),
        },
      )
      return NextResponse.json({ source, destination, products, recorded })
```

(`toReason` throws inside the existing `try`, so the existing `catch` turns it into a 400 before any write — arguments are evaluated before the store function runs.)

- [ ] **Step 11: Run all tests and the type-check**

Run: `npx vitest run`
Expected: PASS (both files).
Run: `npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 12: Commit**

```bash
git add package.json .gitignore vitest.config.mts lib/types.ts lib/seed-data.ts lib/seed-data.test.ts app/api/items/route.ts app/api/items/route.test.ts
git commit -m "Record reason and staff on every stock movement"
```

---

### Task 2: Terminal logging for every transaction — Haiku

**Files:**
- Create: `lib/transaction-log.ts`, `lib/transaction-log.test.ts`
- Modify: `lib/seed-data.ts` (`recordTransaction`), `app/api/items/route.ts` (all 400 responses), `app/api/items/route.test.ts` (add one test)

**Interfaces:**
- Consumes: `Transaction` (with `reason?`, `staffName?`, `linkedTransactionId?`) from Task 1.
- Produces: `formatTransaction(tx: Transaction, stockAfter: number): string`, `logTransaction(tx: Transaction, stockAfter: number): void`, `formatRejected(action: string, message: string): string`, `logRejected(action: string, message: string): void`.

Line format (exact):

```
[StockLite] t-005 OUT 20 × Corrugated Shipping Box (M) @ North Distribution Center 420 → 400 · by Jordan Ruiz · reason: Customer order
[StockLite] t-007 TRANSFER_IN 12 × Nitrile Gloves (Box of 100) @ South Fulfillment Hub 39 → 51 · linked t-006 · by Jordan Ruiz · reason: Rebalancing
[StockLite] REJECTED stock OUT p-007 × 4: Cannot stock out 4 — only 3 in stock
```

(The `TRANSFER_OUT` line has no `linked …` part: it is logged before its partner exists. The `TRANSFER_IN` line carries the link.)

- [ ] **Step 1: Write the failing tests** — create `lib/transaction-log.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatRejected,
  formatTransaction,
  logRejected,
  logTransaction,
} from './transaction-log'
import type { Transaction } from './types'

const base: Transaction = {
  id: 't-005',
  productId: 'p-001',
  productName: 'Corrugated Shipping Box (M)',
  warehouseId: 'wh-north',
  warehouseName: 'North Distribution Center',
  type: 'OUT',
  quantity: 20,
  timestamp: '2026-09-26T10:00:00.000Z',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('formatTransaction', () => {
  it('shows before → after for a stock out, with staff and reason', () => {
    expect(
      formatTransaction(
        { ...base, staffName: 'Jordan Ruiz', reason: 'Customer order' },
        400,
      ),
    ).toBe(
      '[StockLite] t-005 OUT 20 × Corrugated Shipping Box (M) @ North Distribution Center 420 → 400 · by Jordan Ruiz · reason: Customer order',
    )
  })

  it('counts stock in upwards and omits missing staff and reason', () => {
    expect(formatTransaction({ ...base, type: 'IN', quantity: 5 }, 425)).toBe(
      '[StockLite] t-005 IN 5 × Corrugated Shipping Box (M) @ North Distribution Center 420 → 425',
    )
  })

  it('shows transfers, with the link on the inbound half', () => {
    expect(
      formatTransaction({ ...base, type: 'TRANSFER_OUT', quantity: 12 }, 98),
    ).toBe(
      '[StockLite] t-005 TRANSFER_OUT 12 × Corrugated Shipping Box (M) @ North Distribution Center 110 → 98',
    )
    expect(
      formatTransaction(
        {
          ...base,
          id: 't-007',
          type: 'TRANSFER_IN',
          quantity: 12,
          warehouseName: 'South Fulfillment Hub',
          linkedTransactionId: 't-006',
          staffName: 'Jordan Ruiz',
          reason: 'Rebalancing',
        },
        51,
      ),
    ).toBe(
      '[StockLite] t-007 TRANSFER_IN 12 × Corrugated Shipping Box (M) @ South Fulfillment Hub 39 → 51 · linked t-006 · by Jordan Ruiz · reason: Rebalancing',
    )
  })
})

describe('console output', () => {
  it('logTransaction writes exactly one console.log line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    logTransaction(base, 400)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(formatTransaction(base, 400))
  })

  it('logRejected writes a console.warn line', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logRejected('stock OUT p-007 × 4', 'Cannot stock out 4 — only 3 in stock')
    expect(formatRejected('a', 'b')).toBe('[StockLite] REJECTED a: b')
    expect(warn).toHaveBeenCalledWith(
      '[StockLite] REJECTED stock OUT p-007 × 4: Cannot stock out 4 — only 3 in stock',
    )
  })
})

describe('store integration', () => {
  it('logs every recorded transaction with the new stock level', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { applyStockMovement, applyTransfer, findProduct } = await import(
      './seed-data'
    )
    const before = findProduct('p-018')!.currentStock
    applyStockMovement('p-018', 10, 'OUT')
    expect(log).toHaveBeenLastCalledWith(
      expect.stringContaining(
        `OUT 10 × Wooden Pallet, Standard @ North Distribution Center ${before} → ${before - 10}`,
      ),
    )

    log.mockClear()
    applyTransfer('p-018', 'wh-south', 5)
    expect(log).toHaveBeenCalledTimes(2)
    expect(log.mock.calls[0][0]).toContain('TRANSFER_OUT 5 × Wooden Pallet')
    expect(log.mock.calls[1][0]).toMatch(
      /TRANSFER_IN 5 × Wooden Pallet, Standard @ South Fulfillment Hub \d+ → \d+ · linked t-\d+/,
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/transaction-log.test.ts`
Expected: FAIL — cannot resolve `./transaction-log`.

- [ ] **Step 3: Create `lib/transaction-log.ts`**

```ts
import type { Transaction } from './types'

const PREFIX = '[StockLite]'

// One line per recorded transaction for the server terminal, e.g.
// [StockLite] t-005 OUT 20 × Box @ North 420 → 400 · by Jordan Ruiz · reason: Restock
export function formatTransaction(tx: Transaction, stockAfter: number): string {
  const delta =
    tx.type === 'IN' || tx.type === 'TRANSFER_IN' ? tx.quantity : -tx.quantity
  const parts = [
    `${PREFIX} ${tx.id} ${tx.type} ${tx.quantity} × ${tx.productName} @ ${tx.warehouseName} ${stockAfter - delta} → ${stockAfter}`,
  ]
  if (tx.linkedTransactionId) parts.push(`linked ${tx.linkedTransactionId}`)
  if (tx.staffName) parts.push(`by ${tx.staffName}`)
  if (tx.reason) parts.push(`reason: ${tx.reason}`)
  return parts.join(' · ')
}

export function logTransaction(tx: Transaction, stockAfter: number) {
  console.log(formatTransaction(tx, stockAfter))
}

export function formatRejected(action: string, message: string): string {
  return `${PREFIX} REJECTED ${action}: ${message}`
}

export function logRejected(action: string, message: string) {
  console.warn(formatRejected(action, message))
}
```

- [ ] **Step 4: Hook it into `recordTransaction`** in `lib/seed-data.ts`

Add below the `./types` import:

```ts
import { logTransaction } from './transaction-log'
```

In `recordTransaction`, replace `transactions.push(tx)` / `return tx` with:

```ts
  transactions.push(tx)
  // Every write path records through here, so this logs all movements.
  // Callers update stock before recording, so this is the new level.
  logTransaction(tx, findProduct(tx.productId)?.currentStock ?? 0)
  return tx
```

- [ ] **Step 5: Run the logger tests to verify they pass**

Run: `npx vitest run lib/transaction-log.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing rejection-logging test** — append to `app/api/items/route.test.ts`

Change its first import line to `import { afterEach, describe, expect, it, vi } from 'vitest'`, then append:

```ts
describe('POST /api/items — terminal logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs rejected movements as warnings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await post({
      action: 'stock',
      productId: 'p-007',
      quantity: 999,
      direction: 'OUT',
    })
    expect(res.status).toBe(400)
    expect(warn).toHaveBeenCalledWith(
      '[StockLite] REJECTED stock OUT p-007 × 999: Cannot stock out 999 — only 3 in stock',
    )
  })

  it('logs validation rejections too', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await post({ action: 'stock', productId: 'p-001', quantity: 1, direction: 'UP' })
    expect(warn).toHaveBeenCalledWith(
      '[StockLite] REJECTED stock UP p-001 × 1: direction must be IN or OUT',
    )
    await post({ action: 'launch' })
    expect(warn).toHaveBeenLastCalledWith(
      '[StockLite] REJECTED action launch: Unknown action',
    )
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run app/api/items/route.test.ts`
Expected: FAIL — `console.warn` never called.

- [ ] **Step 8: Route every 400 through one helper** in `app/api/items/route.ts`

Add to the imports:

```ts
import { logRejected } from '@/lib/transaction-log'
```

Add below `toReason`:

```ts
// Short label for a request in the terminal, e.g. "stock OUT p-007 × 4".
function describeRequest(body: Record<string, unknown> | null): string {
  if (!body) return 'request'
  if (body.action === 'stock') {
    return `stock ${String(body.direction)} ${String(body.productId)} × ${String(body.quantity)}`
  }
  if (body.action === 'transfer') {
    return `transfer ${String(body.productId)} → ${String(body.destWarehouseId)} × ${String(body.quantity)}`
  }
  return `action ${String(body.action)}`
}

// Every rejected request is logged, then answered with a 400.
function reject(body: Record<string, unknown> | null, message: string) {
  logRejected(describeRequest(body), message)
  return NextResponse.json({ error: message }, { status: 400 })
}
```

Then replace **every** `return NextResponse.json({ error: X }, { status: 400 })` in `POST` with `return reject(body, X)` — using `reject(null, 'Invalid JSON body')` for the two invalid-body returns (JSON parse failure and non-object body). The `catch` becomes:

```ts
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return reject(body, message)
  }
```

(The parse-failure branch runs before `body` is assigned, so it must pass `null`.)

- [ ] **Step 9: Run all tests and the type-check**

Run: `npx vitest run`
Expected: PASS (all files).
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add lib/transaction-log.ts lib/transaction-log.test.ts lib/seed-data.ts app/api/items/route.ts app/api/items/route.test.ts
git commit -m "Log every transaction and rejected request to the server terminal"
```

---

### Task 3: ★ Extra features tab and workspace shell — Haiku

**Files:**
- Create: `app/extras/page.tsx`, `components/extras/tabs.ts`, `components/extras/tabs.test.ts`, `components/extras/types.ts`, `components/extras/api.ts`, `components/extras/api.test.ts`, `components/extras/quantity.ts`, `components/extras/quantity.test.ts`, `components/extras/ExtrasWorkspace.tsx`, `components/extras/StockByProduct.tsx`, `components/extras/SuggestedTransfers.tsx`, `components/extras/QuickActions.tsx`, `components/extras/ActivityLog.tsx`, `components/LocalTime.tsx`
- Modify: `components/Sidebar.tsx`, `components/DashboardShell.tsx`, `components/TransactionTable.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `MovementReason`, `Transaction.recorded` API field (Task 1).
- Produces (later tasks rely on these exact names):
  - `components/extras/types.ts`: `type ExtrasContext = { products: Product[]; warehouses: Warehouse[]; transactions: Transaction[]; staff: StaffUser; onResult: (result: ItemsResult) => void }`
  - `components/extras/api.ts`: `type ItemsRequest`, `type ItemsResult = { products: Product[]; recorded: Transaction[] }`, `postItems(request: ItemsRequest): Promise<ItemsResult>` (throws `Error` with the server's message)
  - `components/extras/quantity.ts`: `type QuantityCheck = { ok: true; quantity: number } | { ok: false; error: string }`, `parseQuantityInput(text: string, max?: number): QuantityCheck`
  - `components/extras/tabs.ts`: `EXTRAS_TABS`, `type ExtrasTabId`, `DEFAULT_EXTRAS_TAB`, `parseExtrasTab(value: string | string[] | undefined): ExtrasTabId`
  - `components/LocalTime.tsx`: default export `LocalTime({ iso }: { iso: string })`
  - Each tab file default-exports a component taking `ExtrasContext` (placeholders here; Tasks 4–6 replace the bodies).
  - CSS classes: `.extras-tabs`, `.extras-tab`, `.btn-small`, `.form-success`, `.form-warning`, `.muted`, `.section-title`; token `--brass-dark`.

- [ ] **Step 1: Write the failing tests for the pure modules**

Create `components/extras/tabs.test.ts`:

```ts
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
```

Create `components/extras/quantity.test.ts`:

```ts
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
```

Create `components/extras/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { postItems } from './api'

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('postItems', () => {
  it('posts JSON and returns products and recorded transactions', async () => {
    const fetchMock = respond(200, { products: [{ id: 'p-1' }], recorded: [{ id: 't-9' }], product: {} })
    vi.stubGlobal('fetch', fetchMock)
    const result = await postItems({
      action: 'stock',
      productId: 'p-1',
      quantity: 3,
      direction: 'IN',
      reason: 'Restock',
    })
    expect(result).toEqual({ products: [{ id: 'p-1' }], recorded: [{ id: 't-9' }] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/items')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      action: 'stock',
      productId: 'p-1',
      quantity: 3,
      direction: 'IN',
      reason: 'Restock',
    })
  })

  it("throws the server's error message on a failed request", async () => {
    vi.stubGlobal('fetch', respond(400, { error: 'Cannot stock out 9 — only 3 in stock' }))
    await expect(
      postItems({ action: 'stock', productId: 'p-1', quantity: 9, direction: 'OUT' }),
    ).rejects.toThrow('Cannot stock out 9 — only 3 in stock')
  })

  it('throws a generic message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })))
    await expect(
      postItems({ action: 'stock', productId: 'p-1', quantity: 1, direction: 'IN' }),
    ).rejects.toThrow('Something went wrong.')
  })

  it('throws a connection message when the request never reaches the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(
      postItems({ action: 'stock', productId: 'p-1', quantity: 1, direction: 'IN' }),
    ).rejects.toThrow('Could not reach the server. Please try again.')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run components/extras`
Expected: FAIL — modules `./tabs`, `./quantity`, `./api` not found.

- [ ] **Step 3: Create the pure modules**

`components/extras/tabs.ts`:

```ts
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
```

`components/extras/quantity.ts`:

```ts
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
```

`components/extras/api.ts`:

```ts
import type { MovementReason, Product, Transaction } from '@/lib/types'

export type ItemsRequest =
  | {
      action: 'stock'
      productId: string
      quantity: number
      direction: 'IN' | 'OUT'
      reason?: MovementReason
    }
  | {
      action: 'transfer'
      productId: string
      sourceWarehouseId: string
      destWarehouseId: string
      quantity: number
      reason?: MovementReason
    }

export type ItemsResult = { products: Product[]; recorded: Transaction[] }

// Posts a stock movement or transfer. Resolves with the full product list and
// the transactions it recorded; throws an Error carrying the server's message.
export async function postItems(request: ItemsRequest): Promise<ItemsResult> {
  let res: Response
  try {
    res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
  return { products: data.products, recorded: data.recorded }
}
```

`components/extras/types.ts`:

```ts
import type { Product, StaffUser, Transaction, Warehouse } from '@/lib/types'
import type { ItemsResult } from './api'

// What every Extra features tab receives from ExtrasWorkspace.
export type ExtrasContext = {
  products: Product[]
  warehouses: Warehouse[]
  transactions: Transaction[]
  staff: StaffUser
  // Call with a successful postItems() result; updates every tab at once.
  onResult: (result: ItemsResult) => void
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/extras`
Expected: PASS (3 files).

- [ ] **Step 5: Move the timestamp component out of `TransactionTable`**

Create `components/LocalTime.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

// Locale-independent, e.g. "2026-09-17 11:20 UTC".
function formatUtc(iso: string) {
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`
}

// The server and the browser can differ in locale and time zone, so
// rendering toLocaleString() on both breaks hydration. Render a fixed UTC
// string first, then switch to the viewer's local time once mounted.
export default function LocalTime({ iso }: { iso: string }) {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])
  return (
    <time dateTime={iso}>
      {isMounted ? new Date(iso).toLocaleString() : formatUtc(iso)}
    </time>
  )
}
```

In `components/TransactionTable.tsx`:
- Change the React import to `import { useMemo, useState } from 'react'` and add `import LocalTime from '@/components/LocalTime'`.
- Delete the `formatUtc` function and its comment, and delete the `isMounted` comment + `useState` + `useEffect` lines at the top of the component.
- Replace the timestamp cell's `<time …>…</time>` block with `<LocalTime iso={t.timestamp} />` (keep the surrounding `<td>`).

- [ ] **Step 6: Add the sidebar item and page title**

In `components/Sidebar.tsx`, after `IconHistory` add:

```tsx
export function IconExtras() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z" />
    </svg>
  )
}
```

and append to `NAV_ITEMS`:

```tsx
  { href: '/extras', label: 'Extra features', icon: <IconExtras /> },
```

In `components/DashboardShell.tsx` add to `TITLES`:

```ts
  '/extras': 'Extra features',
```

- [ ] **Step 7: Create the placeholder tabs**

Create each of these four files with the component name and heading shown (Tasks 4–6 replace them):

`components/extras/StockByProduct.tsx`:

```tsx
import type { ExtrasContext } from './types'

export default function StockByProduct(_props: ExtrasContext) {
  return (
    <div className="panel empty-state">
      <h3>Stock by product</h3>
      <p>Coming soon.</p>
    </div>
  )
}
```

`components/extras/SuggestedTransfers.tsx`:

```tsx
import type { ExtrasContext } from './types'

export default function SuggestedTransfers(_props: ExtrasContext) {
  return (
    <div className="panel empty-state">
      <h3>Suggested transfers</h3>
      <p>Coming soon.</p>
    </div>
  )
}
```

`components/extras/QuickActions.tsx`:

```tsx
import type { ExtrasContext } from './types'

export default function QuickActions(_props: ExtrasContext) {
  return (
    <div className="panel empty-state">
      <h3>Quick actions</h3>
      <p>Coming soon.</p>
    </div>
  )
}
```

`components/extras/ActivityLog.tsx`:

```tsx
import type { ExtrasContext } from './types'

export default function ActivityLog(_props: ExtrasContext) {
  return (
    <div className="panel empty-state">
      <h3>Activity log</h3>
      <p>Coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 8: Create the workspace** — `components/extras/ExtrasWorkspace.tsx`

```tsx
'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product, StaffUser, Transaction, Warehouse } from '@/lib/types'
import ActivityLog from './ActivityLog'
import QuickActions from './QuickActions'
import StockByProduct from './StockByProduct'
import SuggestedTransfers from './SuggestedTransfers'
import type { ItemsResult } from './api'
import { EXTRAS_TABS, type ExtrasTabId } from './tabs'
import type { ExtrasContext } from './types'

export default function ExtrasWorkspace({
  products: initialProducts,
  warehouses,
  transactions: initialTransactions,
  staff,
  initialTab,
}: {
  products: Product[]
  warehouses: Warehouse[]
  transactions: Transaction[]
  staff: StaffUser
  initialTab: ExtrasTabId
}) {
  const router = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [tab, setTab] = useState<ExtrasTabId>(initialTab)

  const onResult = useCallback(
    (result: ItemsResult) => {
      setProducts(result.products)
      setTransactions((prev) => [...prev, ...result.recorded])
      // Drop Next's client-side cache so other pages show the new levels.
      router.refresh()
    },
    [router],
  )

  function selectTab(id: ExtrasTabId) {
    setTab(id)
    // Keep the tab in the URL (shareable, survives reload) without a
    // server round trip.
    window.history.replaceState(null, '', `?tab=${id}`)
  }

  const context: ExtrasContext = {
    products,
    warehouses,
    transactions,
    staff,
    onResult,
  }

  return (
    <>
      <div className="extras-tabs" role="tablist" aria-label="Extra features">
        {EXTRAS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`extras-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`extras-panel-${t.id}`}
            className={`extras-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`extras-panel-${tab}`}
        aria-labelledby={`extras-tab-${tab}`}
      >
        {tab === 'stock-by-product' && <StockByProduct {...context} />}
        {tab === 'suggested-transfers' && <SuggestedTransfers {...context} />}
        {tab === 'quick-actions' && <QuickActions {...context} />}
        {tab === 'activity' && <ActivityLog {...context} />}
      </div>
    </>
  )
}
```

- [ ] **Step 9: Create the page** — `app/extras/page.tsx`

```tsx
import DashboardShell from '@/components/DashboardShell'
import ExtrasWorkspace from '@/components/extras/ExtrasWorkspace'
import { parseExtrasTab } from '@/components/extras/tabs'
import { getCurrentUser } from '@/lib/auth'
import { products, transactions, warehouses } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default function ExtrasPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  return (
    <DashboardShell>
      <div className="page-header">
        <div>
          <h1>Extra features</h1>
          <p>
            Cross-warehouse summaries, rebalancing suggestions, quick actions
            and a full activity log.
          </p>
        </div>
      </div>
      <ExtrasWorkspace
        products={products}
        warehouses={warehouses}
        transactions={transactions}
        staff={getCurrentUser()}
        initialTab={parseExtrasTab(searchParams.tab)}
      />
    </DashboardShell>
  )
}
```

- [ ] **Step 10: Add the shared styles** to `app/globals.css`

Inside the top `:root { … }` block, after `--rust: …;` add:

```css
  --brass-dark: #6e5326; /* brass text that stays readable on light fills */
```

Just before the `/* Login page */` comment add:

```css
/* ---- Extra features ---------------------------------------------------- */
.extras-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--steel-light);
  margin-bottom: 22px;
}

.extras-tab {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--steel);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 10px 12px;
  cursor: pointer;
}

.extras-tab:hover {
  color: var(--ink-soft);
}

.extras-tab.active {
  color: var(--ink);
  border-bottom-color: var(--moss);
}

.btn-small {
  min-height: 32px;
  padding: 6px 12px;
  font-size: 12.5px;
}

.form-success {
  font-size: 12.5px;
  color: var(--moss-dark);
  margin: 0 0 14px;
}

.form-warning {
  font-size: 12.5px;
  color: var(--brass-dark);
  margin: 0 0 10px;
}

.muted {
  font-size: 12.5px;
  color: var(--steel);
}

.section-title {
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-soft);
  margin: 0 0 12px;
}
```

And inside the existing `@media (max-width: 560px) { … }` block add:

```css
  .extras-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .extras-tab {
    white-space: nowrap;
  }
```

- [ ] **Step 11: Run all tests and the type-check**

Run: `npx vitest run`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 12: Commit**

```bash
git add app/extras components/extras components/LocalTime.tsx components/Sidebar.tsx components/DashboardShell.tsx components/TransactionTable.tsx app/globals.css
git commit -m "Add Extra features tab with shared workspace shell"
```

---

### Task 4: Activity log tab — Sonnet

**Files:**
- Create: `components/extras/activity.ts`, `components/extras/activity.test.ts`
- Modify (replace placeholder): `components/extras/ActivityLog.tsx`
- Modify: `lib/types.ts` (add `TRANSACTION_TYPE_LABELS`), `components/TransactionTable.tsx` (use it)

**Interfaces:**
- Consumes: `ExtrasContext` (Task 3), `LocalTime` (Task 3), `MOVEMENT_REASONS`, `Transaction.reason/staffName` (Task 1).
- Produces: `TRANSACTION_TYPE_LABELS: Record<TransactionType, string>` in `lib/types.ts`; `activity.ts` exports `ALL`, `NO_REASON`, `UNKNOWN_STAFF`, `newestFirst`, `filterActivity`, `staffNames`.

- [ ] **Step 1: Write the failing tests** — `components/extras/activity.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import type { Transaction } from '@/lib/types'
import {
  ALL,
  NO_REASON,
  UNKNOWN_STAFF,
  filterActivity,
  newestFirst,
  staffNames,
} from './activity'

function tx(id: string, timestamp: string, extra: Partial<Transaction> = {}): Transaction {
  return {
    id,
    productId: 'p-1',
    productName: 'Gloves',
    warehouseId: 'wh-north',
    warehouseName: 'North',
    type: 'IN',
    quantity: 1,
    timestamp,
    ...extra,
  }
}

const a = tx('t-1', '2026-09-15T10:00:00Z')
const b = tx('t-2', '2026-09-26T10:00:00Z', { reason: 'Damaged', staffName: 'Jordan Ruiz' })
const c = tx('t-3', '2026-09-26T10:00:00Z', { reason: 'Restock', staffName: 'Sam Lee' })
const d = tx('t-4', '2026-09-20T10:00:00Z', { staffName: 'Jordan Ruiz' })

describe('newestFirst', () => {
  it('sorts by timestamp descending, keeping recorded order on ties, without mutating', () => {
    const input = [a, b, c, d]
    expect(newestFirst(input).map((t) => t.id)).toEqual(['t-2', 't-3', 't-4', 't-1'])
    expect(input.map((t) => t.id)).toEqual(['t-1', 't-2', 't-3', 't-4'])
  })
})

describe('filterActivity', () => {
  const all = [a, b, c, d]

  it('returns everything for ALL/ALL', () => {
    expect(filterActivity(all, { reason: ALL, staff: ALL })).toEqual(all)
  })

  it('filters by reason, including "no reason"', () => {
    expect(filterActivity(all, { reason: 'Damaged', staff: ALL })).toEqual([b])
    expect(filterActivity(all, { reason: NO_REASON, staff: ALL })).toEqual([a, d])
  })

  it('filters by staff, including "not recorded"', () => {
    expect(filterActivity(all, { reason: ALL, staff: 'Jordan Ruiz' })).toEqual([b, d])
    expect(filterActivity(all, { reason: ALL, staff: UNKNOWN_STAFF })).toEqual([a])
  })

  it('combines both filters', () => {
    expect(filterActivity(all, { reason: NO_REASON, staff: 'Jordan Ruiz' })).toEqual([d])
    expect(filterActivity(all, { reason: 'Restock', staff: 'Jordan Ruiz' })).toEqual([])
  })
})

describe('staffNames', () => {
  it('lists distinct recorded names alphabetically', () => {
    expect(staffNames([a, b, c, d])).toEqual(['Jordan Ruiz', 'Sam Lee'])
    expect(staffNames([a])).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/extras/activity.test.ts`
Expected: FAIL — cannot resolve `./activity`.

- [ ] **Step 3: Create `components/extras/activity.ts`**

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run components/extras/activity.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Share the type labels**

In `lib/types.ts`, after the `TransactionType` line add:

```ts
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
}
```

In `components/TransactionTable.tsx`, delete the local `TYPE_LABELS` constant, change the types import to `import { TRANSACTION_TYPE_LABELS, Transaction } from '@/lib/types'`, and change `{TYPE_LABELS[t.type] ?? t.type}` to `{TRANSACTION_TYPE_LABELS[t.type]}`.

- [ ] **Step 6: Replace `components/extras/ActivityLog.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import LocalTime from '@/components/LocalTime'
import { MOVEMENT_REASONS, TRANSACTION_TYPE_LABELS } from '@/lib/types'
import {
  ALL,
  NO_REASON,
  UNKNOWN_STAFF,
  filterActivity,
  newestFirst,
  staffNames,
} from './activity'
import type { ExtrasContext } from './types'

export default function ActivityLog({ transactions }: ExtrasContext) {
  const [reason, setReason] = useState(ALL)
  const [staff, setStaff] = useState(ALL)

  // Across all transactions so a filtered transfer still names its partner.
  const byId = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions],
  )
  const names = useMemo(() => staffNames(transactions), [transactions])
  const rows = useMemo(
    () => filterActivity(newestFirst(transactions), { reason, staff }),
    [transactions, reason, staff],
  )

  return (
    <>
      <div className="filter-bar">
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-label="Filter by reason"
        >
          <option value={ALL}>All reasons</option>
          <option value={NO_REASON}>No reason given</option>
          {MOVEMENT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          aria-label="Filter by staff"
        >
          <option value={ALL}>All staff</option>
          <option value={UNKNOWN_STAFF}>Not recorded</option>
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="muted">
          {rows.length} of {transactions.length} movements
        </span>
      </div>

      <div className="panel table-panel">
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>No movements match these filters</h3>
            <p>Try a different reason or staff member.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="Activity log table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Reason</th>
                  <th>Staff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const linked = t.linkedTransactionId
                    ? byId.get(t.linkedTransactionId)
                    : undefined
                  return (
                    <tr key={t.id}>
                      <td>
                        <LocalTime iso={t.timestamp} />
                      </td>
                      <td>{t.productName}</td>
                      <td>{t.warehouseName}</td>
                      <td>
                        {TRANSACTION_TYPE_LABELS[t.type]}
                        {linked && (
                          <span className="linked-transfer">
                            {t.type === 'TRANSFER_OUT' ? 'to' : 'from'}{' '}
                            {linked.warehouseName}
                          </span>
                        )}
                      </td>
                      <td>{t.quantity}</td>
                      <td>{t.reason ?? '—'}</td>
                      <td>{t.staffName ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 7: Run all tests and the type-check**

Run: `npx vitest run`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add components/extras/activity.ts components/extras/activity.test.ts components/extras/ActivityLog.tsx lib/types.ts components/TransactionTable.tsx
git commit -m "Add activity log with reason and staff filters"
```

---

### Task 5: Stock by product + Suggested transfers — Opus

**Files:**
- Create: `lib/insights.ts`, `lib/insights.test.ts`
- Modify (replace placeholders): `components/extras/StockByProduct.tsx`, `components/extras/SuggestedTransfers.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `isLowStock`, `getStockStatus`, `getStockStatusLabel` (`lib/types.ts`); `ExtrasContext`, `postItems`, `parseQuantityInput` (Task 3); `StatusBadge` (`components/StatusBadge.tsx`, props `{ status, label }`).
- Produces (`lib/insights.ts`): `ProductSummaryRow`, `ProductSummary`, `summarizeByProduct(products, warehouses): ProductSummary`, `TransferSuggestion`, `ReorderReason`, `ReorderItem`, `suggestTransfers(products): { suggestions: TransferSuggestion[]; reorder: ReorderItem[] }`.

- [ ] **Step 1: Write the failing tests** — `lib/insights.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { suggestTransfers, summarizeByProduct } from './insights'
import type { Product, Warehouse } from './types'

let seq = 0
function row(
  name: string,
  warehouseId: string,
  currentStock: number,
  reorderThreshold: number,
  category = 'Safety',
): Product {
  seq += 1
  return { id: `p-${seq}`, name, category, warehouseId, currentStock, reorderThreshold }
}

const warehouses: Warehouse[] = [
  { id: 'wh-north', name: 'North', location: 'MD' },
  { id: 'wh-south', name: 'South', location: 'TX' },
]

describe('summarizeByProduct', () => {
  it('groups rows by product name with per-warehouse cells and totals', () => {
    const gN = row('Gloves', 'wh-north', 110, 50)
    const gS = row('Gloves', 'wh-south', 39, 50)
    const kit = row('First Aid Kit', 'wh-south', 20, 8)
    const s = summarizeByProduct([gN, gS, kit], warehouses)

    expect(s.rows.map((r) => r.name)).toEqual(['Gloves', 'First Aid Kit'])
    expect(s.rows[0]).toMatchObject({ category: 'Safety', total: 149, needsAttention: true })
    expect(s.rows[0].cells['wh-north']).toBe(gN)
    expect(s.rows[0].cells['wh-south']).toBe(gS)
    expect(s.rows[1].cells['wh-north']).toBeUndefined()
    expect(s.rows[1].needsAttention).toBe(false)
    expect(s.totalsByWarehouse).toEqual({ 'wh-north': 110, 'wh-south': 59 })
    expect(s.grandTotal).toBe(169)
  })

  it('puts products needing attention first (at threshold counts), then by name', () => {
    const s = summarizeByProduct(
      [
        row('Alpha', 'wh-north', 10, 5),
        row('Zeta', 'wh-north', 5, 5),
        row('Beta', 'wh-north', 1, 5),
      ],
      warehouses,
    )
    expect(s.rows.map((r) => r.name)).toEqual(['Beta', 'Zeta', 'Alpha'])
  })

  it('reports zero totals when there are no products', () => {
    expect(summarizeByProduct([], warehouses)).toEqual({
      rows: [],
      totalsByWarehouse: { 'wh-north': 0, 'wh-south': 0 },
      grandTotal: 0,
    })
  })
})

describe('suggestTransfers', () => {
  it('suggests lifting the low warehouse just above its threshold', () => {
    const north = row('Gloves', 'wh-north', 110, 50)
    const south = row('Gloves', 'wh-south', 39, 50)
    expect(suggestTransfers([north, south])).toEqual({
      suggestions: [
        { productName: 'Gloves', from: north, to: south, quantity: 12, need: 12, fullyCovers: true },
      ],
      reorder: [],
    })
  })

  it('caps the move so the donor stays above its own threshold', () => {
    const donor = row('Wrap', 'wh-north', 60, 50)
    const receiver = row('Wrap', 'wh-south', 10, 50)
    const { suggestions } = suggestTransfers([donor, receiver])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({ quantity: 9, need: 41, fullyCovers: false })
  })

  it('sends a low row to reordering when the donor has nothing to spare', () => {
    const donor = row('Jack', 'wh-south', 51, 50)
    const receiver = row('Jack', 'wh-north', 49, 50)
    expect(suggestTransfers([donor, receiver])).toEqual({
      suggestions: [],
      reorder: [{ product: receiver, reason: 'no-spare-stock' }],
    })
  })

  it('never takes stock from a warehouse that is itself at its threshold', () => {
    const atThreshold = row('Vest', 'wh-south', 50, 50)
    const receiver = row('Vest', 'wh-north', 10, 50)
    const { suggestions, reorder } = suggestTransfers([atThreshold, receiver])
    expect(suggestions).toEqual([])
    expect(reorder).toEqual([
      { product: receiver, reason: 'other-warehouse-low' },
      { product: atThreshold, reason: 'other-warehouse-low' },
    ])
  })

  it('sends products stocked in only one warehouse to reordering', () => {
    const kit = row('Kit', 'wh-south', 8, 8)
    expect(suggestTransfers([kit]).reorder).toEqual([
      { product: kit, reason: 'not-stocked-elsewhere' },
    ])
  })

  it('handles a zero threshold', () => {
    const receiver = row('Tag', 'wh-north', 0, 0)
    const donor = row('Tag', 'wh-south', 5, 0)
    expect(suggestTransfers([receiver, donor]).suggestions).toEqual([
      { productName: 'Tag', from: donor, to: receiver, quantity: 1, need: 1, fullyCovers: true },
    ])
  })

  it('picks the donor with the most to spare when several could give', () => {
    const receiver = row('Tape', 'wh-north', 0, 10)
    const small = row('Tape', 'wh-south', 15, 10)
    const big = row('Tape', 'wh-west', 90, 10)
    expect(suggestTransfers([receiver, small, big]).suggestions[0].from).toBe(big)
  })

  it('orders suggestions and reorder items most urgent first', () => {
    const mild = row('Mild', 'wh-north', 45, 50)
    const mildDonor = row('Mild', 'wh-south', 200, 50)
    const severe = row('Severe', 'wh-north', 5, 50)
    const severeDonor = row('Severe', 'wh-south', 200, 50)
    const onlyA = row('OnlyA', 'wh-north', 4, 10)
    const onlyB = row('OnlyB', 'wh-north', 1, 10)
    const { suggestions, reorder } = suggestTransfers([
      mild, mildDonor, severe, severeDonor, onlyA, onlyB,
    ])
    expect(suggestions.map((s) => s.productName)).toEqual(['Severe', 'Mild'])
    expect(reorder.map((r) => r.product.name)).toEqual(['OnlyB', 'OnlyA'])
  })

  it('returns nothing when no row is low', () => {
    expect(
      suggestTransfers([row('Ok', 'wh-north', 20, 5), row('Ok', 'wh-south', 30, 5)]),
    ).toEqual({ suggestions: [], reorder: [] })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/insights.test.ts`
Expected: FAIL — cannot resolve `./insights`.

- [ ] **Step 3: Create `lib/insights.ts`**

```ts
import { isLowStock, Product, Warehouse } from './types'

// ---- Stock by product ------------------------------------------------------

export type ProductSummaryRow = {
  name: string
  category: string
  // The product's row in each warehouse, keyed by warehouse id; missing when
  // the product isn't stocked there.
  cells: Record<string, Product | undefined>
  total: number
  needsAttention: boolean // at or below threshold in any warehouse
}

export type ProductSummary = {
  rows: ProductSummaryRow[]
  totalsByWarehouse: Record<string, number>
  grandTotal: number
}

// One row per product name — the same product in two warehouses is two
// Product rows sharing a name. Rows needing attention come first.
export function summarizeByProduct(
  products: Product[],
  warehouses: Warehouse[],
): ProductSummary {
  const rowsByName = new Map<string, ProductSummaryRow>()
  const totalsByWarehouse: Record<string, number> = {}
  for (const w of warehouses) totalsByWarehouse[w.id] = 0
  let grandTotal = 0

  for (const p of products) {
    let row = rowsByName.get(p.name)
    if (!row) {
      row = {
        name: p.name,
        category: p.category,
        cells: {},
        total: 0,
        needsAttention: false,
      }
      rowsByName.set(p.name, row)
    }
    row.cells[p.warehouseId] = p
    row.total += p.currentStock
    if (isLowStock(p)) row.needsAttention = true
    totalsByWarehouse[p.warehouseId] =
      (totalsByWarehouse[p.warehouseId] ?? 0) + p.currentStock
    grandTotal += p.currentStock
  }

  const rows = Array.from(rowsByName.values()).sort(
    (a, b) =>
      Number(b.needsAttention) - Number(a.needsAttention) ||
      a.name.localeCompare(b.name),
  )
  return { rows, totalsByWarehouse, grandTotal }
}

// ---- Suggested transfers ---------------------------------------------------

export type TransferSuggestion = {
  productName: string
  from: Product // donor row; stays above its threshold after the move
  to: Product // receiver row; currently at or below its threshold
  quantity: number // suggested units to move
  need: number // units that would lift the receiver just above its threshold
  fullyCovers: boolean // quantity === need
}

export type ReorderReason =
  | 'other-warehouse-low'
  | 'no-spare-stock'
  | 'not-stocked-elsewhere'

export type ReorderItem = { product: Product; reason: ReorderReason }

// Low means stock <= threshold, so threshold + 1 is the first healthy level.
function unitsNeeded(p: Product) {
  return p.reorderThreshold - p.currentStock + 1
}

// What a row can give while staying above its own threshold.
function unitsSpare(p: Product) {
  return p.currentStock - p.reorderThreshold - 1
}

// Lower is more urgent. A zero threshold has no meaningful ratio.
function urgency(p: Product) {
  return p.reorderThreshold > 0 ? p.currentStock / p.reorderThreshold : 0
}

function byUrgency(a: Product, b: Product) {
  return urgency(a) - urgency(b) || a.name.localeCompare(b.name)
}

// For every low row, suggest moving stock from the same product's healthiest
// other warehouse — never so much that the donor becomes low. Low rows no
// transfer can fix are listed for reordering instead.
export function suggestTransfers(products: Product[]): {
  suggestions: TransferSuggestion[]
  reorder: ReorderItem[]
} {
  const suggestions: TransferSuggestion[] = []
  const reorder: ReorderItem[] = []

  for (const to of products) {
    if (!isLowStock(to)) continue

    const others = products.filter(
      (p) => p.name === to.name && p.warehouseId !== to.warehouseId,
    )
    if (others.length === 0) {
      reorder.push({ product: to, reason: 'not-stocked-elsewhere' })
      continue
    }
    const donors = others.filter((p) => !isLowStock(p))
    if (donors.length === 0) {
      reorder.push({ product: to, reason: 'other-warehouse-low' })
      continue
    }

    const from = donors.reduce((best, p) =>
      unitsSpare(p) > unitsSpare(best) ? p : best,
    )
    const need = unitsNeeded(to)
    const quantity = Math.min(need, unitsSpare(from))
    if (quantity <= 0) {
      reorder.push({ product: to, reason: 'no-spare-stock' })
      continue
    }
    suggestions.push({
      productName: to.name,
      from,
      to,
      quantity,
      need,
      fullyCovers: quantity === need,
    })
  }

  suggestions.sort((a, b) => byUrgency(a.to, b.to))
  reorder.sort((a, b) => byUrgency(a.product, b.product))
  return { suggestions, reorder }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/insights.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Replace `components/extras/StockByProduct.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { summarizeByProduct } from '@/lib/insights'
import { getStockStatus, getStockStatusLabel } from '@/lib/types'
import type { ExtrasContext } from './types'

export default function StockByProduct({ products, warehouses }: ExtrasContext) {
  const [attentionOnly, setAttentionOnly] = useState(false)
  const summary = useMemo(
    () => summarizeByProduct(products, warehouses),
    [products, warehouses],
  )
  const needing = summary.rows.filter((r) => r.needsAttention).length
  const rows = attentionOnly
    ? summary.rows.filter((r) => r.needsAttention)
    : summary.rows

  return (
    <>
      <div className="filter-bar">
        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(e) => setAttentionOnly(e.target.checked)}
          />
          Only products needing attention
        </label>
        <span className="muted">
          {needing} of {summary.rows.length} products need attention
        </span>
      </div>

      <div className="panel table-panel">
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing needs attention</h3>
            <p>Every product is above its reorder threshold in every warehouse.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="Stock by product table">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  {warehouses.map((w) => (
                    <th key={w.id}>{w.name}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name}>
                    <td>
                      <div>{row.name}</div>
                      <div className="muted">{row.category}</div>
                    </td>
                    {warehouses.map((w) => {
                      const p = row.cells[w.id]
                      if (!p) {
                        return (
                          <td key={w.id} className="muted">
                            Not stocked
                          </td>
                        )
                      }
                      const status = getStockStatus(p)
                      return (
                        <td key={w.id}>
                          <div className="cell-stock">
                            <span>
                              {p.currentStock}{' '}
                              <span className="muted">/ {p.reorderThreshold}</span>
                            </span>
                            <StatusBadge
                              status={status}
                              label={getStockStatusLabel(status)}
                            />
                          </div>
                        </td>
                      )
                    })}
                    <td>
                      <strong>{row.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>All products</td>
                  {warehouses.map((w) => (
                    <td key={w.id}>{summary.totalsByWarehouse[w.id] ?? 0}</td>
                  ))}
                  <td>{summary.grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 6: Replace `components/extras/SuggestedTransfers.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import {
  suggestTransfers,
  type ReorderReason,
  type TransferSuggestion,
} from '@/lib/insights'
import { postItems } from './api'
import { parseQuantityInput } from './quantity'
import type { ExtrasContext } from './types'

const REORDER_REASON_TEXT: Record<ReorderReason, string> = {
  'other-warehouse-low': 'Every other warehouse is also at or below its threshold',
  'no-spare-stock': 'No other warehouse has stock to spare',
  'not-stocked-elsewhere': 'Not stocked in any other warehouse',
}

function suggestionKey(s: TransferSuggestion) {
  return `${s.from.id}->${s.to.id}`
}

export default function SuggestedTransfers({
  products,
  warehouses,
  onResult,
}: ExtrasContext) {
  const { suggestions, reorder } = useMemo(
    () => suggestTransfers(products),
    [products],
  )
  // Edited quantities by suggestion; absent means "use the suggested amount".
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [success, setSuccess] = useState('')

  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? id

  async function transfer(s: TransferSuggestion) {
    const key = suggestionKey(s)
    const check = parseQuantityInput(
      quantities[key] ?? String(s.quantity),
      s.from.currentStock,
    )
    setSuccess('')
    if (!check.ok) {
      setErrors((e) => ({ ...e, [key]: check.error }))
      return
    }
    setErrors((e) => ({ ...e, [key]: '' }))
    setPendingKey(key)
    try {
      const result = await postItems({
        action: 'transfer',
        productId: s.from.id,
        sourceWarehouseId: s.from.warehouseId,
        destWarehouseId: s.to.warehouseId,
        quantity: check.quantity,
        reason: 'Rebalancing',
      })
      onResult(result)
      setQuantities((q) => {
        const next = { ...q }
        delete next[key]
        return next
      })
      setSuccess(
        `Moved ${check.quantity} × ${s.productName} to ${warehouseName(s.to.warehouseId)}.`,
      )
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [key]: err instanceof Error ? err.message : 'Something went wrong.',
      }))
    } finally {
      setPendingKey(null)
    }
  }

  if (suggestions.length === 0 && reorder.length === 0) {
    return (
      <>
        {success && (
          <p className="form-success" role="status">
            {success}
          </p>
        )}
        <div className="panel empty-state">
          <h3>Nothing needs attention</h3>
          <p>Every product is above its reorder threshold in every warehouse.</p>
        </div>
      </>
    )
  }

  return (
    <>
      {success && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}

      <h2 className="section-title">Suggested transfers</h2>
      {suggestions.length === 0 ? (
        <p className="muted suggestion-none">
          No transfers to suggest — no warehouse has stock to spare for a low one.
        </p>
      ) : (
        <div className="suggestion-list">
          {suggestions.map((s) => {
            const key = suggestionKey(s)
            const text = quantities[key] ?? String(s.quantity)
            const check = parseQuantityInput(text, s.from.currentStock)
            const qty = check.ok ? check.quantity : 0
            const fromName = warehouseName(s.from.warehouseId)
            const toName = warehouseName(s.to.warehouseId)
            const donorGoesLow =
              check.ok && s.from.currentStock - qty <= s.from.reorderThreshold
            return (
              <article
                key={key}
                className={`suggestion-card${s.fullyCovers ? '' : ' partial'}`}
              >
                <h3>{s.productName}</h3>
                <p className="suggestion-route">
                  Move {s.quantity} from {fromName} → {toName}
                  {s.fullyCovers ? '' : ' (partly covers the shortfall)'}
                </p>
                <p className="suggestion-preview">
                  {check.ok
                    ? `${toName}: ${s.to.currentStock} → ${s.to.currentStock + qty} (threshold ${s.to.reorderThreshold}) · ${fromName}: ${s.from.currentStock} → ${s.from.currentStock - qty} (threshold ${s.from.reorderThreshold})`
                    : 'Enter a quantity to preview the result.'}
                </p>
                {donorGoesLow && (
                  <p className="form-warning">
                    This would leave {fromName} at or below its reorder threshold.
                  </p>
                )}
                <form
                  className="suggestion-actions"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    void transfer(s)
                  }}
                >
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={text}
                    aria-label={`Quantity of ${s.productName} to move`}
                    onChange={(e) =>
                      setQuantities((q) => ({ ...q, [key]: e.target.value }))
                    }
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-small"
                    disabled={pendingKey !== null}
                  >
                    {pendingKey === key ? 'Moving…' : 'Transfer'}
                  </button>
                </form>
                {errors[key] && (
                  <p className="form-error" role="alert">
                    {errors[key]}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}

      <h2 className="section-title">Needs reordering</h2>
      {reorder.length === 0 ? (
        <p className="muted">Nothing needs reordering — transfers cover every shortfall.</p>
      ) : (
        <div className="panel table-panel">
          <div className="table-scroll" tabIndex={0} aria-label="Needs reordering table">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Stock / threshold</th>
                  <th>Why a transfer can't fix it</th>
                </tr>
              </thead>
              <tbody>
                {reorder.map(({ product, reason }) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{warehouseName(product.warehouseId)}</td>
                    <td>
                      {product.currentStock} / {product.reorderThreshold}
                    </td>
                    <td>{REORDER_REASON_TEXT[reason]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 7: Add the styles** — append just before the `/* Login page */` comment in `app/globals.css`

```css
/* Extra features: stock by product */
.cell-stock {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

tfoot td {
  padding: 12px 16px;
  font-weight: 600;
  border-top: 1px solid var(--steel-light);
}

/* Extra features: suggested transfers */
.suggestion-list {
  display: grid;
  gap: 12px;
  margin-bottom: 28px;
}

.suggestion-none {
  margin: 0 0 28px;
}

.suggestion-card {
  background: var(--white);
  border: 1px solid var(--steel-light);
  border-left: 3px solid var(--moss);
  border-radius: var(--radius-md);
  padding: 16px 18px;
}

.suggestion-card.partial {
  border-left-color: var(--brass);
}

.suggestion-card h3 {
  font-family: var(--font-body);
  font-size: 14.5px;
  font-weight: 600;
  margin-bottom: 4px;
}

.suggestion-route {
  font-size: 13.5px;
  color: var(--ink-soft);
  margin: 0 0 6px;
}

.suggestion-preview {
  font-size: 12.5px;
  color: var(--steel);
  margin: 0 0 12px;
}

.suggestion-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.suggestion-actions input {
  width: 96px;
}
```

- [ ] **Step 8: Run all tests and the type-check**

Run: `npx vitest run`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add lib/insights.ts lib/insights.test.ts components/extras/StockByProduct.tsx components/extras/SuggestedTransfers.tsx app/globals.css
git commit -m "Add stock-by-product summary and suggested transfers"
```

---

### Task 6: Quick actions tab — Sonnet

**Files:**
- Create: `components/extras/quick-actions.ts`, `components/extras/quick-actions.test.ts`
- Modify (replace placeholder): `components/extras/QuickActions.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `ExtrasContext`, `postItems`, `parseQuantityInput` (Task 3); `MOVEMENT_REASONS`, `isMovementReason`, `getStockStatus`, `getStockStatusLabel` (`lib/types.ts`); `StatusBadge`.
- Produces (`quick-actions.ts`): `SortKey`, `SortDir`, `QuickAction`, `coverage(product): number | null`, `filterAndSortProducts(products, warehouses, options): Product[]`, `stockAfter(product, action, quantity): number`, `statusLabelAt(product, stock): string`.

- [ ] **Step 1: Write the failing tests** — `components/extras/quick-actions.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import type { Product, Warehouse } from '@/lib/types'
import {
  coverage,
  filterAndSortProducts,
  statusLabelAt,
  stockAfter,
} from './quick-actions'

const warehouses: Warehouse[] = [
  { id: 'wh-north', name: 'North Distribution Center', location: 'MD' },
  { id: 'wh-south', name: 'South Fulfillment Hub', location: 'TX' },
]

function p(
  id: string,
  name: string,
  warehouseId: string,
  currentStock: number,
  reorderThreshold: number,
  category = 'Packaging',
): Product {
  return { id, name, category, warehouseId, currentStock, reorderThreshold }
}

const box = p('p-1', 'Corrugated Shipping Box (M)', 'wh-north', 420, 100)
const boxS = p('p-2', 'Corrugated Shipping Box (M)', 'wh-south', 38, 100)
const gloves = p('p-3', 'Nitrile Gloves', 'wh-north', 140, 50, 'Safety')
const scanner = p('p-4', 'Barcode Scanner', 'wh-south', 4, 6, 'Electronics')
const tag = p('p-5', 'Asset Tag', 'wh-north', 3, 0, 'Electronics')
const all = [box, boxS, gloves, scanner, tag]

const base = { query: '', warehouseId: 'all', sortKey: 'name' as const, sortDir: 'asc' as const }

describe('coverage', () => {
  it('is stock as a share of the threshold, or null for a zero threshold', () => {
    expect(coverage(boxS)).toBeCloseTo(0.38)
    expect(coverage(tag)).toBeNull()
  })
})

describe('filterAndSortProducts', () => {
  it('searches name and category, trimmed and case-insensitive', () => {
    const ids = (query: string) =>
      filterAndSortProducts(all, warehouses, { ...base, query }).map((x) => x.id)
    expect(ids('  GLOVES ')).toEqual(['p-3'])
    expect(ids('electronics')).toEqual(['p-5', 'p-4'])
    expect(ids('(m)')).toEqual(['p-1', 'p-2'])
    expect(ids('nothing like this')).toEqual([])
  })

  it('filters by warehouse', () => {
    expect(
      filterAndSortProducts(all, warehouses, { ...base, warehouseId: 'wh-south' }).map(
        (x) => x.id,
      ),
    ).toEqual(['p-4', 'p-2'])
  })

  it('sorts by stock in both directions', () => {
    const sorted = (sortDir: 'asc' | 'desc') =>
      filterAndSortProducts(all, warehouses, { ...base, sortKey: 'stock', sortDir }).map(
        (x) => x.currentStock,
      )
    expect(sorted('asc')).toEqual([3, 4, 38, 140, 420])
    expect(sorted('desc')).toEqual([420, 140, 38, 4, 3])
  })

  it('sorts by coverage with zero-threshold rows last in either direction', () => {
    const ids = (sortDir: 'asc' | 'desc') =>
      filterAndSortProducts(all, warehouses, { ...base, sortKey: 'coverage', sortDir }).map(
        (x) => x.id,
      )
    expect(ids('asc')).toEqual(['p-2', 'p-4', 'p-3', 'p-1', 'p-5'])
    expect(ids('desc')).toEqual(['p-1', 'p-3', 'p-4', 'p-2', 'p-5'])
  })

  it('sorts by warehouse name, breaking ties by product name', () => {
    expect(
      filterAndSortProducts(all, warehouses, { ...base, sortKey: 'warehouse' }).map(
        (x) => x.id,
      ),
    ).toEqual(['p-5', 'p-1', 'p-3', 'p-4', 'p-2'])
  })

  it('does not mutate its input', () => {
    const input = [...all]
    filterAndSortProducts(input, warehouses, { ...base, sortKey: 'stock' })
    expect(input).toEqual(all)
  })
})

describe('stockAfter / statusLabelAt', () => {
  it('adds for IN and subtracts for OUT and TRANSFER', () => {
    expect(stockAfter(box, 'IN', 10)).toBe(430)
    expect(stockAfter(box, 'OUT', 10)).toBe(410)
    expect(stockAfter(box, 'TRANSFER', 20)).toBe(400)
  })

  it('labels the status at a hypothetical stock level', () => {
    expect(statusLabelAt(box, 100)).toBe('At threshold')
    expect(statusLabelAt(box, 99)).toBe('Below threshold')
    expect(statusLabelAt(box, 101)).toBe('In stock')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/extras/quick-actions.test.ts`
Expected: FAIL — cannot resolve `./quick-actions`.

- [ ] **Step 3: Create `components/extras/quick-actions.ts`**

```ts
import {
  getStockStatus,
  getStockStatusLabel,
  type Product,
  type Warehouse,
} from '@/lib/types'

export type SortKey = 'name' | 'warehouse' | 'stock' | 'threshold' | 'coverage'
export type SortDir = 'asc' | 'desc'
export type QuickAction = 'IN' | 'OUT' | 'TRANSFER'

// Stock as a share of the reorder threshold (1 = exactly at threshold);
// null when the threshold is 0, where a ratio means nothing.
export function coverage(product: Product): number | null {
  return product.reorderThreshold > 0
    ? product.currentStock / product.reorderThreshold
    : null
}

export function filterAndSortProducts(
  products: Product[],
  warehouses: Warehouse[],
  options: { query: string; warehouseId: string; sortKey: SortKey; sortDir: SortDir },
): Product[] {
  const query = options.query.trim().toLowerCase()
  const direction = options.sortDir === 'asc' ? 1 : -1
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? id

  const valueOf = (p: Product): string | number | null => {
    switch (options.sortKey) {
      case 'name':
        return p.name.toLowerCase()
      case 'warehouse':
        return warehouseName(p.warehouseId).toLowerCase()
      case 'stock':
        return p.currentStock
      case 'threshold':
        return p.reorderThreshold
      case 'coverage':
        return coverage(p)
    }
  }
  const tieBreak = (a: Product, b: Product) =>
    a.name.localeCompare(b.name) ||
    warehouseName(a.warehouseId).localeCompare(warehouseName(b.warehouseId))

  return products
    .filter(
      (p) => options.warehouseId === 'all' || p.warehouseId === options.warehouseId,
    )
    .filter(
      (p) =>
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query),
    )
    .sort((a, b) => {
      const va = valueOf(a)
      const vb = valueOf(b)
      // Rows with no value (coverage at a zero threshold) always go last.
      if (va === null || vb === null) {
        if (va === vb) return tieBreak(a, b)
        return va === null ? 1 : -1
      }
      const compared =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb))
      return compared * direction || tieBreak(a, b)
    })
}

// Stock at the product's own warehouse after the action.
export function stockAfter(
  product: Product,
  action: QuickAction,
  quantity: number,
): number {
  return action === 'IN'
    ? product.currentStock + quantity
    : product.currentStock - quantity
}

export function statusLabelAt(product: Product, stock: number): string {
  return getStockStatusLabel(getStockStatus({ ...product, currentStock: stock }))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run components/extras/quick-actions.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Replace `components/extras/QuickActions.tsx`**

```tsx
'use client'

import { Fragment, useMemo, useState } from 'react'
import StatusBadge from '@/components/StatusBadge'
import {
  MOVEMENT_REASONS,
  getStockStatus,
  getStockStatusLabel,
  isMovementReason,
  type Product,
} from '@/lib/types'
import { postItems } from './api'
import { parseQuantityInput } from './quantity'
import {
  coverage,
  filterAndSortProducts,
  statusLabelAt,
  stockAfter,
  type QuickAction,
  type SortDir,
  type SortKey,
} from './quick-actions'
import type { ExtrasContext } from './types'

const ACTION_LABELS: Record<QuickAction, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
  TRANSFER: 'Transfer',
}

const BUTTON_LABELS: Record<QuickAction, string> = {
  IN: 'In',
  OUT: 'Out',
  TRANSFER: 'Transfer',
}

const COLUMNS: { sortKey: SortKey | null; label: string }[] = [
  { sortKey: 'name', label: 'Product' },
  { sortKey: null, label: 'Category' },
  { sortKey: 'warehouse', label: 'Warehouse' },
  { sortKey: 'stock', label: 'Stock' },
  { sortKey: 'threshold', label: 'Threshold' },
  { sortKey: 'coverage', label: 'Coverage' },
  { sortKey: null, label: 'Status' },
  { sortKey: null, label: 'Actions' },
]

type OpenAction = { productId: string; action: QuickAction }

export default function QuickActions({
  products,
  warehouses,
  staff,
  onResult,
}: ExtrasContext) {
  const [query, setQuery] = useState('')
  const [warehouseId, setWarehouseId] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('coverage')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [open, setOpen] = useState<OpenAction | null>(null)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [destId, setDestId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState('')

  const rows = useMemo(
    () =>
      filterAndSortProducts(products, warehouses, {
        query,
        warehouseId,
        sortKey,
        sortDir,
      }),
    [products, warehouses, query, warehouseId, sortKey, sortDir],
  )

  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? id

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function openAction(product: Product, action: QuickAction) {
    setOpen({ productId: product.id, action })
    setQuantity('')
    setReason('')
    setError('')
    setSuccess('')
    setDestId(warehouses.find((w) => w.id !== product.warehouseId)?.id ?? '')
  }

  async function submit(product: Product, action: QuickAction) {
    const check = parseQuantityInput(
      quantity,
      action === 'IN' ? undefined : product.currentStock,
    )
    if (!check.ok) {
      setError(check.error)
      return
    }
    if (action === 'TRANSFER' && (!destId || destId === product.warehouseId)) {
      setError('Choose a destination warehouse.')
      return
    }
    setError('')
    setPending(true)
    try {
      const reasonValue = isMovementReason(reason) ? reason : undefined
      const result = await postItems(
        action === 'TRANSFER'
          ? {
              action: 'transfer',
              productId: product.id,
              sourceWarehouseId: product.warehouseId,
              destWarehouseId: destId,
              quantity: check.quantity,
              reason: reasonValue,
            }
          : {
              action: 'stock',
              productId: product.id,
              quantity: check.quantity,
              direction: action,
              reason: reasonValue,
            },
      )
      onResult(result)
      setOpen(null)
      setSuccess(
        action === 'TRANSFER'
          ? `Transferred ${check.quantity} × ${product.name} to ${warehouseName(destId)}.`
          : `${ACTION_LABELS[action]}: ${check.quantity} × ${product.name} at ${warehouseName(product.warehouseId)}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  function preview(product: Product, action: QuickAction): string {
    if (!quantity.trim()) return 'Enter a quantity to see the result.'
    const check = parseQuantityInput(
      quantity,
      action === 'IN' ? undefined : product.currentStock,
    )
    if (!check.ok) return check.error
    const after = stockAfter(product, action, check.quantity)
    if (action !== 'TRANSFER') {
      return `After: ${product.currentStock} → ${after} · ${statusLabelAt(product, after)}`
    }
    const dest = products.find(
      (p) => p.name === product.name && p.warehouseId === destId,
    )
    const destBefore = dest?.currentStock ?? 0
    return `${warehouseName(product.warehouseId)}: ${product.currentStock} → ${after} · ${warehouseName(destId)}: ${destBefore} → ${destBefore + check.quantity}${dest ? '' : ' (new row)'}`
  }

  return (
    <>
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product or category"
          aria-label="Search products"
        />
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          aria-label="Filter by warehouse"
        >
          <option value="all">All warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <span className="muted">
          {rows.length} of {products.length} rows
        </span>
      </div>

      {success && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}

      <div className="panel table-panel">
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>No products match your search</h3>
            <p>Try a different name, category or warehouse.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="Quick actions table">
            <table>
              <thead>
                <tr>
                  {COLUMNS.map(({ sortKey: key, label }) =>
                    key === null ? (
                      <th key={label}>{label}</th>
                    ) : (
                      <th
                        key={label}
                        aria-sort={
                          sortKey === key
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleSort(key)}
                        >
                          {label}
                          {sortKey === key && (
                            <span aria-hidden="true">
                              {sortDir === 'asc' ? ' ▲' : ' ▼'}
                            </span>
                          )}
                        </button>
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const status = getStockStatus(product)
                  const cov = coverage(product)
                  const openHere = open?.productId === product.id ? open : null
                  return (
                    <Fragment key={product.id}>
                      <tr>
                        <td>{product.name}</td>
                        <td>{product.category}</td>
                        <td>{warehouseName(product.warehouseId)}</td>
                        <td>{product.currentStock}</td>
                        <td>{product.reorderThreshold}</td>
                        <td>{cov === null ? '—' : `${Math.round(cov * 100)}%`}</td>
                        <td>
                          <StatusBadge
                            status={status}
                            label={getStockStatusLabel(status)}
                          />
                        </td>
                        <td>
                          <div className="row-actions">
                            {(['IN', 'OUT', 'TRANSFER'] as const).map((action) => {
                              const active = openHere?.action === action
                              return (
                                <button
                                  key={action}
                                  type="button"
                                  className={`btn btn-small ${active ? 'btn-primary' : 'btn-secondary'}`}
                                  aria-expanded={active}
                                  disabled={
                                    pending ||
                                    (action !== 'IN' && product.currentStock === 0)
                                  }
                                  onClick={() =>
                                    active ? setOpen(null) : openAction(product, action)
                                  }
                                >
                                  {BUTTON_LABELS[action]}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                      {openHere && (
                        <tr className="action-row">
                          <td colSpan={COLUMNS.length}>
                            <form
                              className="action-panel"
                              noValidate
                              onSubmit={(e) => {
                                e.preventDefault()
                                void submit(product, openHere.action)
                              }}
                            >
                              <p className="action-panel-title">
                                <strong>{ACTION_LABELS[openHere.action]}</strong> —{' '}
                                {product.name} @ {warehouseName(product.warehouseId)}
                              </p>
                              <div className="action-panel-fields">
                                <div className="form-field">
                                  <label htmlFor="qa-quantity">Quantity</label>
                                  <input
                                    id="qa-quantity"
                                    type="number"
                                    min={1}
                                    step={1}
                                    autoFocus
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                  />
                                </div>
                                {openHere.action === 'TRANSFER' && (
                                  <div className="form-field">
                                    <label htmlFor="qa-dest">To warehouse</label>
                                    <select
                                      id="qa-dest"
                                      value={destId}
                                      onChange={(e) => setDestId(e.target.value)}
                                    >
                                      {warehouses
                                        .filter((w) => w.id !== product.warehouseId)
                                        .map((w) => (
                                          <option key={w.id} value={w.id}>
                                            {w.name}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                )}
                                <div className="form-field">
                                  <label htmlFor="qa-reason">Reason (optional)</label>
                                  <select
                                    id="qa-reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                  >
                                    <option value="">No reason</option>
                                    {MOVEMENT_REASONS.map((r) => (
                                      <option key={r} value={r}>
                                        {r}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <p className="muted">{preview(product, openHere.action)}</p>
                              <p className="muted">Recording as {staff.name}</p>
                              {error && (
                                <p className="form-error" role="alert">
                                  {error}
                                </p>
                              )}
                              <div className="form-actions">
                                <button
                                  type="submit"
                                  className="btn btn-primary btn-small"
                                  disabled={pending}
                                >
                                  {pending ? 'Saving…' : ACTION_LABELS[openHere.action]}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-small"
                                  disabled={pending}
                                  onClick={() => setOpen(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 6: Add the styles** — append just before the `/* Login page */` comment in `app/globals.css`

```css
/* Extra features: quick actions */
.search-input {
  flex: 1 1 220px;
  min-width: 0;
}

.sort-button {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.sort-button:hover {
  color: var(--ink);
}

.row-actions {
  display: flex;
  gap: 6px;
}

tbody tr.action-row,
tbody tr.action-row:hover {
  background: var(--paper-dim);
}

.action-panel-title {
  font-size: 13.5px;
  margin: 0 0 12px;
}

.action-panel-fields {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-panel-fields .form-field {
  flex: 1 1 160px;
  margin-bottom: 12px;
}

.action-panel .muted {
  margin: 0 0 6px;
}
```

- [ ] **Step 7: Run all tests and the type-check**

Run: `npx vitest run`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add components/extras/quick-actions.ts components/extras/quick-actions.test.ts components/extras/QuickActions.tsx app/globals.css
git commit -m "Add quick actions tab with search, sort and inline stock actions"
```

---

### Final verification (controller, after all tasks)

- [ ] `npx vitest run` — all pass; `npx tsc --noEmit` — clean; `npm run build` — succeeds, `/extras` listed as ƒ.
- [ ] Start the dev server; confirm terminal shows `[StockLite] …` lines for a stock in, a stock out, a transfer (two lines, inbound one linked), and a `REJECTED` warning for an over-large stock out.
- [ ] Browser: sidebar shows ★ Extra features and highlights it on `/extras`; `/extras?tab=nope` opens Stock by product; each tab renders; a suggested transfer executes and disappears from the list, updating Stock by product and Activity log without reload; quick action In/Out/Transfer with a reason shows in Activity log with staff "Jordan Ruiz"; double-clicking a submit sends one request; old `/stock` and `/history` pages still work and show no console errors.
- [ ] Existing API regression script (scratchpad `verify-api.mjs`) still passes on a fresh server.
