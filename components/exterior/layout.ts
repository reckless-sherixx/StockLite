// World layout shared by the WebGL scene, the descent timeline and the DOM
// anchors (reference: WORLD LAYOUT). 1 world unit ~ 0.33 m. The camera looks
// down +z; the horizon is placed with lens shift (h = fraction from top).
// Only computed in effects (it reads the viewport).

export const SLAB: [number, number] = [600, 900] // cloud layer: base, top

export type WorldLayout = {
  W: number
  H: number
  narrow: boolean
  f: number
  towerZ: number
  towerW: number
  towerD: number
  towerX: number
  heroY: number
  groundZ: number
  groundX: number
  b2Z: number
  b2W: number
  b2X: number
  podW: number
  podD: number
  doorZ: number
  podRect: [number, number, number, number]
  b2Rect: [number, number, number, number]
}

export const clamp = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v))

export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Filled by computeLayout(); the zero values are never rendered.
export const WL: WorldLayout = {
  W: 1,
  H: 1,
  narrow: false,
  f: 1,
  towerZ: 1000,
  towerW: 210,
  towerD: 151,
  towerX: 0,
  heroY: 1400,
  groundZ: 450,
  groundX: 0,
  b2Z: 1350,
  b2W: 280,
  b2X: 0,
  podW: 273,
  podD: 181,
  doorZ: 909,
  podRect: [0, 0, 0, 0],
  b2Rect: [0, 0, 0, 0],
}

export function computeLayout() {
  const W = window.innerWidth
  const H = window.innerHeight
  const aspect = W / H
  const narrow = aspect < 0.85
  WL.W = W
  WL.H = H
  WL.narrow = narrow
  WL.f = H * 1.072 // ~50deg vertical field of view
  WL.towerZ = 1000
  WL.towerW = narrow ? 118 : clamp(210 * Math.min(1, aspect / 1.55), 150, 210)
  WL.towerD = WL.towerW * 0.72
  WL.towerX = ((narrow ? 0.16 : 0.2) - 0.5) * W * WL.towerZ / WL.f
  WL.heroY = 1420 - (0.44 - (narrow ? 0.115 : 0.06)) * H * 1000 / WL.f // spire tip clear of the nav
  WL.groundZ = narrow ? 270 : 450
  WL.groundX = WL.towerX - ((narrow ? 0.3 : 0.22) - 0.5) * W * (WL.towerZ - WL.groundZ) / WL.f
  WL.b2Z = 1350
  WL.b2W = narrow ? 170 : 280
  WL.b2X = WL.groundX + ((narrow ? 0.86 : 0.55) - 0.5) * W * (WL.b2Z - WL.groundZ) / WL.f
  WL.podW = WL.towerW * 1.3
  WL.podD = WL.towerD * 1.2
  WL.doorZ = WL.towerZ - WL.podD / 2
}

// Height (world units) at which each file's floor tag is pinned to the tower.
const FLOOR_Y: Record<string, number> = {
  inventory: 120,
  stock: 270,
  transfer: 420,
  history: 560,
}

export function floorY(id: string, index: number): number {
  return FLOOR_Y[id] ?? 120 + index * 145
}
