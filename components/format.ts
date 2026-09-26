// A fixed locale so the server and every browser print the same digits
// (a locale-dependent separator would break hydration).
export function fmt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString('en-US') : String(n)
}
