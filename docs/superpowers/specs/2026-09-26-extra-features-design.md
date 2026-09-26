# Extra Features — Design

Date: 2026-09-26 · Status: approved (structure approved in chat; details below)

## Goal

Give warehouse staff four time-saving tools, all reachable from one new
**★ Extra features** sidebar tab, and make every stock transaction visible in
the server terminal.

1. **Stock by product** — cross-warehouse summary table.
2. **Suggested transfers** — rebalance stock between warehouses before reordering.
3. **Quick actions** — searchable, sortable inventory with per-row In / Out / Transfer.
4. **Reason + staff on each movement** — plus an Activity log that shows them.

Plus: **terminal logging** of every recorded transaction and every rejected request.

## Constraints

- Existing pages (`/inventory`, `/stock`, `/transfer`, `/history`) keep their
  current behavior. The only shared-UI change is the new sidebar item.
- In-memory store stays (`lib/seed-data.ts`, kept on `globalThis`).
- Only new dependency: `vitest` (dev) for unit tests.
- Commits have no Claude co-author trailer.

## Architecture

```
app/extras/page.tsx          server, force-dynamic; loads products, warehouses,
                             transactions, current staff; reads ?tab=
components/extras/
  ExtrasWorkspace.tsx        client; owns products + transactions state, tab bar
  StockByProduct.tsx         tab 1
  SuggestedTransfers.tsx     tab 2
  QuickActions.tsx           tab 3
  ActivityLog.tsx            tab 4
  api.ts                     postItems(body) -> typed result / error
components/LocalTime.tsx     hydration-safe timestamp (shared with History)
lib/insights.ts              pure: summarizeByProduct, suggestTransfers
lib/transaction-log.ts       logTransaction, logRejected (console output)
```

- **Tabs:** `stock-by-product` (default), `suggested-transfers`, `quick-actions`,
  `activity`. Active tab is mirrored to the URL with
  `window.history.replaceState` (`/extras?tab=quick-actions`), and the server page
  passes `searchParams.tab` in as the initial tab (unknown values fall back to the
  default).
- **Shared state:** every successful action replaces `products` with the API's
  full list and appends the API's newly recorded transactions, then calls
  `router.refresh()` (drops Next's client router cache, like the existing forms).
  All four tabs derive from this state, so they update together.

## Data changes (feature 4)

`lib/types.ts`:

```ts
export const MOVEMENT_REASONS = [
  'Restock', 'Customer order', 'Customer return', 'Damaged',
  'Count correction', 'Rebalancing', 'Other',
] as const
export type MovementReason = (typeof MOVEMENT_REASONS)[number]
export function isMovementReason(v: unknown): v is MovementReason

Transaction += { reason?: MovementReason; staffId?: string; staffName?: string }
```

`lib/seed-data.ts` (options object replaces the positional `sourceWarehouseId`):

```ts
applyStockMovement(productId, quantity, direction,
  options?: { reason?: MovementReason; staff?: StaffUser })
  : { product: Product; recorded: Transaction[] }
applyTransfer(productId, destWarehouseId, quantity,
  options?: { sourceWarehouseId?: string; reason?: MovementReason; staff?: StaffUser })
  : { source: Product; destination: Product; recorded: Transaction[] }
```

The API route is the only caller of both, so the return/parameter changes stay
contained there.

`POST /api/items`:

- Accepts optional `reason`. Missing / `null` / `""` → no reason. Any other value
  not in `MOVEMENT_REASONS` → `400 { error: 'Unknown reason' }`.
- Staff is **always** taken server-side from `getCurrentUser()`; the body cannot
  set it. So the old Stock/Transfer forms also record staff, just no reason.
- Responses keep every existing field and add `recorded: Transaction[]`
  (1 for stock, 2 for a transfer pair).
- Seed transactions have no reason/staff and display as "—".

## Feature details

### 1. Stock by product

- One row per product **name**. Columns: Product, Category, one column per
  warehouse showing `stock / threshold` + status badge (or "—" when the product
  has no row there), Total stock.
- Order: products low in any warehouse first, then by name.
- Toggle: "Only products needing attention".
- Footer row: total units per warehouse and overall.

### 2. Suggested transfers

For each product that has a row in **both** warehouses, where one row is low
(`stock ≤ threshold`) and the other is not:

```
need      = receiver.threshold − receiver.stock + 1   // lift receiver out of low
available = donor.stock − donor.threshold − 1         // donor must stay out of low
quantity  = min(need, available)                      // suggest only if > 0
fullyCovers = quantity === need
```

- Sorted most urgent first: `receiver.stock / receiver.threshold` ascending
  (threshold 0 → ratio 0).
- Card text, e.g.: *Move 12 × Nitrile Gloves (Box of 100) — North Distribution
  Center → South Fulfillment Hub. South 39 → 51 (threshold 50) · North 110 → 98
  (threshold 50).* Partial suggestions say "partly covers".
- Quantity input prefilled with the suggestion and editable (whole number,
  1..donor.stock); preview updates live. **Transfer** button posts the transfer
  with `reason: 'Rebalancing'`; success message shown; list recomputes.
- **"Needs reordering"** list: low rows that no transfer can fix (other
  warehouse also low, has no spare, or has no row for the product).
- Empty state when nothing needs attention.

### 3. Quick actions

- Table of all product rows: Product, Category, Warehouse, Stock, Threshold,
  Coverage (`stock / threshold` as %, threshold 0 → "—"), Status, Actions.
- Search (name or category, case-insensitive), warehouse filter, click-to-sort
  headers (toggle asc/desc). Default sort: Coverage ascending.
- Row buttons **In**, **Out**, **Transfer** open one inline action panel
  (one open at a time) under that row: quantity, optional reason select,
  destination select for Transfer (defaults to the other warehouse), live
  preview ("After: 400 → 380 · Low stock"), Submit / Cancel.
- Client validation mirrors the server (whole number > 0; ≤ stock for Out and
  Transfer). Server errors are shown in the panel. "Recording as <staff name>".
- Empty state for no matches.

### 4. Activity log

- Table: Time (`<LocalTime>`), Product, Warehouse, Type (with transfer
  counterpart, as on History), Quantity, Reason, Staff. Newest first.
- Filters: reason (incl. "No reason"), staff (names present, incl. "Unknown").
- Empty state.

## Terminal logging

`lib/transaction-log.ts`, called from `recordTransaction` (so every write path is
covered) and from the API route's error branch:

```
[StockLite] t-005 OUT 20 × Corrugated Shipping Box (M) @ North Distribution Center 420 → 400 · by Jordan Ruiz · reason: Customer order
[StockLite] t-006 TRANSFER_OUT 12 × Nitrile Gloves (Box of 100) @ North Distribution Center 110 → 98 · linked t-007 · by Jordan Ruiz · reason: Rebalancing
[StockLite] REJECTED stock OUT p-007 × 4: Cannot stock out 4 — only 3 in stock
```

- Recorded → `console.log`; rejected → `console.warn`.
- `stockAfter` is the product's current stock at record time (writes happen before
  recording); `before = after ∓ quantity` by type.
- Omit the "by …" / "reason: …" parts when absent.

## Error handling

- All validation stays server-side authoritative; clients mirror it for fast
  feedback only.
- Failed actions never change client state; error text comes from the API.
- Network failure → "Could not reach the server. Please try again."

## Testing

- `vitest` unit tests:
  - `lib/insights.test.ts` — grouping/totals, suggestion math (full, partial,
    donor exactly one above threshold, donor at threshold → none, both low →
    reorder list, single-warehouse product → reorder list, threshold 0), ordering.
  - `lib/transaction-log.test.ts` — line format for each type, optional parts,
    rejected line (spy on `console.log` / `console.warn`).
  - `lib/seed-data.test.ts` — reason + staff recorded, invalid reason rejected
    by the route-level validator (`isMovementReason`), `recorded` returned.
- `npx tsc --noEmit`, `npm run build`.
- End-to-end: extended API script + browser pass over all four tabs, sidebar,
  and terminal output.

## Execution (subagents by difficulty)

| Task | Model |
|---|---|
| Vitest setup + terminal logging | Haiku |
| Sidebar tab + `/extras` shell with tabs | Haiku |
| Reason + staff end to end + Activity log | Opus |
| `insights.ts` + Stock by product + Suggested transfers | Opus |
| Quick actions tab | Sonnet |
