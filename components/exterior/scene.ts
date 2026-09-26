import { gsap } from '@/lib/gsap'
import { SLAB, WL, clamp, mulberry32, smooth } from '@/components/exterior/layout'
import {
  BLD_FS,
  BLD_VS,
  ENV_FS,
  ENV_VS,
  PLANE_SVG,
  PLN_FS,
  PLN_VS,
  SPR_FS,
  SPR_VS,
} from '@/components/exterior/shaders'

// The exterior's WebGL2 scene (reference: SCENE): sky, cloud sea, towers,
// airliner. Plain TypeScript; created and destroyed by the Exterior effect.

export type Cam = { x: number; y: number; z: number; h: number }
export type Projected = { x: number; y: number; s: number }
export type Project = (x: number, y: number, z: number) => Projected | null
export type FrameFn = (c: Cam, below: number, fog: number, project: Project) => void

export type Scene = {
  base: Cam
  intro: { y: number }
  par: { x: number; y: number; tx: number; ty: number }
  readonly useOver: boolean
  onFrame: FrameFn | null
  start: () => void
  stop: () => void
  resize: () => void
  project: Project
  flyIn: (extraTargets: gsap.TweenTarget) => Promise<void>
  flyOut: (extraTargets: gsap.TweenTarget) => Promise<void>
  launchPlaneAfter: (ms: number) => void
  destroy: () => void
}

type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }
type Vec3 = [number, number, number]
type Vec2 = [number, number]
type Mats = { front: number; side: number; top: number; bottom?: number }

// value noise for the puff atlas (CPU, runs once)
function hash2(x: number, y: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm2(x: number, y: number) {
  let s = 0
  let a = 0.5
  for (let i = 0; i < 4; i++) {
    s += a * vnoise(x, y)
    x = x * 2.03 + 17.1
    y = y * 2.03 + 9.2
    a *= 0.5
  }
  return s / 0.9375
}

function makePuffAtlas() {
  const C = 256
  const COLS = 4
  const ROWS = 2
  const W = C * COLS
  const H = C * ROWS
  const data = new Uint8Array(W * H * 4)
  const rnd = mulberry32(1337)
  const L0 = 0.36
  const L1 = 0.72
  const L2 = 0.59
  const Ln = Math.hypot(L0, L1, L2)
  for (let cell = 0; cell < COLS * ROWS; cell++) {
    const ox = (cell % COLS) * C
    const oy = Math.floor(cell / COLS) * C
    const blobs: number[] = []
    const nb = 8 + Math.floor(rnd() * 5)
    for (let i = 0; i < nb; i++) {
      const bx = 0.5 + (rnd() - 0.5) * 0.5
      const spread = Math.abs(bx - 0.5)
      const r = 0.085 + rnd() * 0.1 * (1 - spread * 1.2)
      const by = 0.6 - rnd() * 0.14 - (0.26 - spread) * 0.42 * rnd()
      blobs.push(bx, by, r * r)
    }
    const seed = rnd() * 50
    for (let y = 0; y < C; y++) {
      const v = (y + 0.5) / C
      const flat = smooth(0.74, 0.6, v)
      for (let x = 0; x < C; x++) {
        const u = (x + 0.5) / C
        let d = 0
        let gx = 0
        let gy = 0
        for (let i = 0; i < blobs.length; i += 3) {
          const dx = u - blobs[i]
          const dy = v - blobs[i + 1]
          const rr = blobs[i + 2]
          const e = Math.exp(-(dx * dx + dy * dy) / rr)
          d += e
          gx += ((-2 * dx) / rr) * e
          gy += ((-2 * dy) / rr) * e
        }
        const nz = fbm2(u * 6 + seed, v * 6 + seed)
        let a = smooth(0.4, 0.82, d * flat * (0.7 + 0.62 * nz))
        a *= smooth(0.5, 0.38, Math.hypot(u - 0.5, (v - 0.5) * 1.05))
        const k = 0.055
        const nx = -gx * k
        const ny = gy * k
        const lam = Math.max(0, (nx * L0 + ny * L1 + L2) / (Math.hypot(nx, ny, 1) * Ln))
        let lit = 0.18 + 0.82 * lam
        lit *= 1 - 0.34 * smooth(0.38, 0.72, v)
        lit = clamp(lit + (nz - 0.5) * 0.18, 0, 1)
        const idx = ((oy + y) * W + ox + x) * 4
        const L = (lit * 255) | 0
        data[idx] = L
        data[idx + 1] = L
        data[idx + 2] = L
        data[idx + 3] = (a * 255) | 0
      }
    }
  }
  return { data, W, H }
}

function makePuffs() {
  const rnd = mulberry32(2024)
  const list: number[][] = []
  for (let i = 0; i < 2300; i++) {
    // cloud-top sea
    const z = 140 + Math.pow(rnd(), 1.5) * 9500
    const hw = z * 1.2 + 900
    const s = (200 + rnd() * 280) * (1 + (z / 9500) * 1.1)
    list.push([(rnd() * 2 - 1) * hw, 748 + rnd() * 128, z, s * (1.05 + rnd() * 0.5), s, Math.floor(rnd() * 8), hw, 0.85 + rnd() * 0.15, 0])
  }
  for (let i = 0; i < 380; i++) {
    // ragged cloud base, seen from below
    const z = 300 + Math.pow(rnd(), 1.2) * 8500
    const hw = z * 1.2 + 900
    const s = (180 + rnd() * 260) * (1 + (z / 8500) * 0.8)
    list.push([(rnd() * 2 - 1) * hw, 470 + rnd() * 115, z, s * (1.9 + rnd() * 1.4), s, Math.floor(rnd() * 8), hw, 0.45 + rnd() * 0.3, 1])
  }
  list.sort((a, b) => b[2] - a[2]) // painter's order: far to near (camera never rotates)
  return { data: new Float32Array(list.flat()), count: list.length }
}

function projMatrix(W: number, H: number, f: number, prinX: number, prinY: number, near: number, far: number) {
  const A = (far + near) / (far - near)
  const B = (-2 * far * near) / (far - near)
  return new Float32Array([2 * f / W, 0, 0, 0, 0, 2 * f / H, 0, 0, 2 * prinX / W, 2 * prinY / H, A, 1, 0, 0, B, 0])
}

// Returns null when WebGL2 is unavailable or a shader fails (caller shows
// the fallback).
export function createScene(canvas: HTMLCanvasElement, reduced: boolean): Scene | null {
  let ctx: WebGL2RenderingContext | null = null
  try {
    ctx = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' })
  } catch {
    ctx = null
  }
  if (!ctx) return null
  const gl: WebGL2RenderingContext = ctx
  const loseContext = () => gl.getExtension('WEBGL_lose_context')?.loseContext()

  const shaders: WebGLShader[] = []
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)
    if (!s) throw new Error('createShader failed')
    shaders.push(s)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed')
    return s
  }
  const program = (vs: string, fs: string): Program => {
    const p = gl.createProgram()
    if (!p) throw new Error('createProgram failed')
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed')
    const u: Program['u'] = {}
    const n: number = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)
      if (info) u[info.name] = gl.getUniformLocation(p, info.name)
    }
    return { p, u }
  }
  let P: { env: Program; bld: Program; spr: Program; pln: Program }
  try {
    P = { env: program(ENV_VS, ENV_FS), bld: program(BLD_VS, BLD_FS), spr: program(SPR_VS, SPR_FS), pln: program(PLN_VS, PLN_FS) }
  } catch (e) {
    console.warn('[StockLite] WebGL shaders failed, using fallback.', e)
    loseContext()
    return null
  }

  // ---------- camera state (base = scroll timeline, over = enter/exit choreography) ----------
  const base: Cam = { x: 0, y: WL.heroY, z: 0, h: 0.44 }
  const over: Cam = { x: 0, y: 0, z: 0, h: 0.5 }
  const U = { door: 0, glow: 0 }
  const intro = { y: 0 }
  const par = { x: 0, y: 0, tx: 0, ty: 0 }
  const cam: Cam = { x: 0, y: WL.heroY, z: 0, h: 0.44 }
  let useOver = false
  let running = false
  let time = 0
  let lastT = 0
  let frames = 0
  let acc = 0
  let warm = 0
  let scale = Math.min(window.devicePixelRatio || 1, 1.5)
  let onFrame: FrameFn | null = null
  let destroyed = false
  const timelines: gsap.core.Timeline[] = []

  // ---------- geometry ----------
  const face = (o: number[], a: Vec3, b: Vec3, c: Vec3, d: Vec3, n: Vec3, ua: Vec2, ub: Vec2, uc: Vec2, ud: Vec2, mat: number, fw: number) => {
    const verts: [Vec3, Vec2][] = [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]
    for (const [p, uv] of verts) o.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], mat, fw)
  }
  const box = (o: number[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: Mats) => {
    const w = x1 - x0
    const d = z1 - z0
    face(o, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], [0, y0], [w, y0], [w, y1], [0, y1], m.front, w)
    face(o, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], [0, y0], [d, y0], [d, y1], [0, y1], m.side, d)
    face(o, [x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], [0, y0], [d, y0], [d, y1], [0, y1], m.side, d)
    face(o, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], [0, 0], [w, 0], [w, d], [0, d], m.top, w)
    if (m.bottom != null) face(o, [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], [0, d], [w, d], [w, 0], [0, 0], m.bottom, w)
  }
  function buildGeometry() {
    const o: number[] = []
    const tx = WL.towerX, tz = WL.towerZ, tw = WL.towerW, td = WL.towerD, pw = WL.podW, pd = WL.podD, fz = WL.doorZ
    box(o, tx - pw / 2, tx + pw / 2, 0, 70, fz, tz + pd / 2, { front: 1, side: 1, top: 4 })
    box(o, tx - tw / 2, tx + tw / 2, 70, 1180, tz - td / 2, tz + td / 2, { front: 0, side: 0, top: 4 })
    box(o, tx - tw * 0.4, tx + tw * 0.4, 1180, 1252, tz - td * 0.4, tz + td * 0.4, { front: 0, side: 0, top: 4 })
    box(o, tx - tw * 0.27, tx + tw * 0.27, 1252, 1308, tz - td * 0.27, tz + td * 0.27, { front: 7, side: 7, top: 4 })
    box(o, tx - 2.6, tx + 2.6, 1308, 1420, tz - 2.6, tz + 2.6, { front: 4, side: 4, top: 4 })
    box(o, tx - 44, tx + 44, 38, 41.5, fz - 16, fz, { front: 6, side: 6, top: 6, bottom: 6 })
    const dz = fz - 0.35
    face(o, [tx - 30, 0, dz], [tx + 30, 0, dz], [tx + 30, 34, dz], [tx - 30, 34, dz], [0, 0, -1], [0, 0], [60, 0], [60, 34], [0, 34], 5, 60)
    const bx = WL.b2X, bz = WL.b2Z, bw = WL.b2W, bd = bw * 0.7
    box(o, bx - bw / 2, bx + bw / 2, 0, 16, bz - bd / 2, bz + bd / 2, { front: 8, side: 8, top: 4 })
    box(o, bx - bw / 2, bx + bw / 2, 16, 560, bz - bd / 2, bz + bd / 2, { front: 2, side: 2, top: 4 })
    const rnd = mulberry32(99)
    for (let i = 0; i < 190; i++) {
      const z = 2600 + rnd() * 9000
      const hw = z * 1.15 + 600
      const x = (rnd() * 2 - 1) * hw
      const w = 70 + rnd() * 170
      const d = 70 + rnd() * 170
      const h = 90 + Math.pow(rnd(), 1.2) * 470
      box(o, x - w / 2, x + w / 2, 0, h, z, z + d, { front: 3, side: 3, top: 3 })
    }
    WL.podRect = [tx - pw / 2, fz, tx + pw / 2, tz + pd / 2]
    WL.b2Rect = [bx - bw / 2, bz - bd / 2, bx + bw / 2, bz + bd / 2]
    return new Float32Array(o)
  }

  const envVAO = gl.createVertexArray()
  const bldVAO = gl.createVertexArray()
  const bldBuf = gl.createBuffer()
  let bldCount = 0
  function uploadBuildings() {
    const arr = buildGeometry()
    gl.bindVertexArray(bldVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, bldBuf)
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW)
    const st = 40
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, st, 24)
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, st, 32)
    gl.bindVertexArray(null)
    bldCount = arr.length / 10
  }

  const quadBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const puffs = makePuffs()
  const sprVAO = gl.createVertexArray()
  gl.bindVertexArray(sprVAO)
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0)
  const instBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf)
  gl.bufferData(gl.ARRAY_BUFFER, puffs.data, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 0); gl.vertexAttribDivisor(1, 1)
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 12); gl.vertexAttribDivisor(2, 1)
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 36, 20); gl.vertexAttribDivisor(3, 1)
  gl.bindVertexArray(null)

  const plnVAO = gl.createVertexArray()
  gl.bindVertexArray(plnVAO)
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0)
  gl.bindVertexArray(null)

  // ---------- textures ----------
  const atlas = makePuffAtlas()
  const atlasTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, atlasTex)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.W, atlas.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.data)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  let planeTex: WebGLTexture | null = null
  const img = new Image()
  img.onload = () => {
    if (destroyed) return
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 256
    c.getContext('2d')?.drawImage(img, 0, 0, 1024, 256)
    planeTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, planeTex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(PLANE_SVG)

  // ---------- airliner: one pass left to right, then a 3 s pause, forever ----------
  const plane = { x: 0, y: 1760, z: 2600, active: false, nextAt: 0, startX: 0, endX: 0, speed: 0, trailFrom: 0, trailA: 0 }
  function planeLaunch() {
    const half = ((plane.z - cam.z) * (WL.W / 2)) / WL.f
    plane.startX = cam.x - half - 260
    plane.endX = cam.x + half + 260
    plane.x = plane.startX
    plane.trailFrom = plane.x
    plane.speed = (plane.endX - plane.startX) / 12 // 12 s crossing
    plane.y = 1740 + Math.random() * 60
    plane.active = true
    plane.trailA = 1
  }
  function planeUpdate(dt: number, now: number) {
    if (reduced) return
    if (plane.active) {
      plane.x += plane.speed * dt
      plane.y += 2.4 * dt
      if (plane.x > plane.endX) {
        plane.active = false
        plane.nextAt = now + 3000
      }
    } else {
      plane.trailA = Math.max(0, plane.trailA - dt / 2.4)
      if (plane.nextAt && now >= plane.nextAt) planeLaunch()
    }
  }

  // ---------- sizing ----------
  function resizeCanvas() {
    const w = Math.max(1, Math.round(WL.W * scale))
    const h = Math.max(1, Math.round(WL.H * scale))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }
  function resize() {
    resizeCanvas()
    uploadBuildings()
  }
  resize()

  function currentCam() {
    const b = useOver ? over : base
    par.x += (par.tx - par.x) * 0.045
    par.y += (par.ty - par.y) * 0.045
    cam.x = b.x + par.x * 16
    cam.y = b.y + intro.y + par.y * 7
    cam.z = b.z
    cam.h = b.h
    return cam
  }
  const project: Project = (x, y, z) => {
    const rz = z - cam.z
    if (rz < 2) return null
    const s = WL.f / rz
    return { x: WL.W / 2 + (x - cam.x) * s, y: cam.h * WL.H - (y - cam.y) * s, s }
  }

  function render() {
    const now = performance.now()
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016)
    lastT = now
    if (!reduced) time += dt
    if (warm < 90) warm++
    else {
      acc += dt
      frames++
    }
    if (frames >= 50) {
      // adaptive resolution
      const avg = acc / frames
      frames = 0
      acc = 0
      if (avg > 0.024 && scale > 0.6) {
        scale = Math.max(0.6, scale - 0.15)
        resizeCanvas()
      }
    }
    planeUpdate(dt, now)
    const c = currentCam()
    const Wc = WL.W, Hc = WL.H, k = canvas.width / Wc
    const prinY = (0.5 - c.h) * Hc
    const proj = projMatrix(Wc, Hc, WL.f, 0, prinY, 4, 40000)
    const below = smooth(760, 740, c.y)
    const fog = smooth(SLAB[1] + 30, SLAB[1] - 50, c.y) * smooth(SLAB[0] - 30, SLAB[0] + 50, c.y)

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.DEPTH_BUFFER_BIT)

    // sky / cloud floor / ceiling / plaza
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND)
    gl.useProgram(P.env.p)
    gl.uniform2f(P.env.u.uPrin, (Wc / 2) * k, (Hc / 2 + prinY) * k)
    gl.uniform1f(P.env.u.uF, WL.f * k)
    gl.uniform3f(P.env.u.uCam, c.x, c.y, c.z)
    gl.uniform1f(P.env.u.uTime, time)
    gl.uniform2f(P.env.u.uSlab, SLAB[0], SLAB[1])
    gl.uniform1f(P.env.u.uBelow, below)
    gl.uniform1f(P.env.u.uFog, fog)
    gl.uniform4f(P.env.u.uTowerRect, WL.podRect[0], WL.podRect[1], WL.podRect[2], WL.podRect[3])
    gl.uniform4f(P.env.u.uB2Rect, WL.b2Rect[0], WL.b2Rect[1], WL.b2Rect[2], WL.b2Rect[3])
    gl.bindVertexArray(envVAO)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // towers
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true)
    gl.useProgram(P.bld.p)
    gl.uniformMatrix4fv(P.bld.u.uProj, false, proj)
    gl.uniform3f(P.bld.u.uCam, c.x, c.y, c.z)
    gl.uniform2f(P.bld.u.uSlab, SLAB[0], SLAB[1])
    gl.uniform1f(P.bld.u.uBelow, below)
    gl.uniform1f(P.bld.u.uFog, fog)
    gl.uniform1f(P.bld.u.uDoor, U.door)
    gl.uniform1f(P.bld.u.uGlow, U.glow)
    gl.bindVertexArray(bldVAO)
    gl.drawArrays(gl.TRIANGLES, 0, bldCount)

    // airliner + contrail (behind the tower, above the clouds)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false)
    const planeVis = 1 - below
    if (planeTex && planeVis > 0.01 && (plane.active || plane.trailA > 0)) {
      gl.useProgram(P.pln.p)
      gl.uniformMatrix4fv(P.pln.u.uProj, false, proj)
      gl.uniform3f(P.pln.u.uCam, c.x, c.y, c.z)
      gl.bindVertexArray(plnVAO)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, planeTex)
      gl.uniform1i(P.pln.u.uTex, 0)
      const tailEnd = plane.x - 20
      const tailStart = Math.max(plane.trailFrom, tailEnd - 2400)
      if (tailEnd - tailStart > 10) {
        gl.uniform1i(P.pln.u.uMode, 1)
        gl.uniform1f(P.pln.u.uAlpha, plane.trailA * planeVis)
        gl.uniform3f(P.pln.u.uCenter, (tailStart + tailEnd) / 2, plane.y - 12, plane.z + 2)
        gl.uniform2f(P.pln.u.uSize, tailEnd - tailStart, 7)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      if (plane.active) {
        gl.uniform1i(P.pln.u.uMode, 0)
        gl.uniform1f(P.pln.u.uAlpha, planeVis)
        gl.uniform3f(P.pln.u.uCenter, plane.x, plane.y, plane.z)
        gl.uniform2f(P.pln.u.uSize, 300, 75)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
    }

    // cloud puffs
    gl.useProgram(P.spr.p)
    gl.uniformMatrix4fv(P.spr.u.uProj, false, proj)
    gl.uniform3f(P.spr.u.uCam, c.x, c.y, c.z)
    gl.uniform1f(P.spr.u.uTime, time)
    gl.uniform1f(P.spr.u.uBelow, below)
    gl.uniform1f(P.spr.u.uFog, fog)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasTex)
    gl.uniform1i(P.spr.u.uTex, 0)
    gl.bindVertexArray(sprVAO)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, puffs.count)
    gl.bindVertexArray(null)

    if (onFrame) onFrame(c, below, fog, project)
  }

  function start() {
    if (running || destroyed) return
    running = true
    lastT = 0
    warm = 0
    frames = 0
    acc = 0
    gsap.ticker.add(render)
  }
  function stop() {
    if (!running) return
    running = false
    gsap.ticker.remove(render)
  }

  function doorTarget() {
    return { x: WL.towerX, zNear: WL.doorZ - 120, zIn: WL.doorZ - 5 }
  }
  function flyIn(extraTargets: gsap.TweenTarget) {
    Object.assign(over, { x: base.x, y: base.y, z: base.z, h: base.h })
    useOver = true
    par.tx = 0
    par.ty = 0
    const d = doorTarget()
    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve })
        .to(extraTargets, { autoAlpha: 0, duration: 0.6, ease: 'power2.out' }, 0)
        .to(over, { x: d.x, y: 19, z: d.zNear, h: 0.53, duration: 2.2, ease: 'power2.inOut' }, 0)
        .to(U, { door: 1, duration: 1.4, ease: 'power2.inOut' }, 1.0)
        .to(over, { z: d.zIn, y: 17, duration: 1.35, ease: 'power3.in' }, 2.2)
        .to(U, { glow: 1, duration: 1.1, ease: 'power2.in' }, 2.3)
        .to('#glow', { autoAlpha: 1, duration: 0.5, ease: 'power1.in' }, 3.05)
      timelines.push(tl)
    })
  }
  function flyOut(extraTargets: gsap.TweenTarget) {
    const d = doorTarget()
    Object.assign(over, { x: d.x, y: 17, z: d.zIn, h: 0.53 })
    useOver = true
    U.door = 1
    U.glow = 1
    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: () => { useOver = false; resolve() } })
        .to('#glow', { autoAlpha: 0, duration: 0.8, ease: 'power2.out' }, 0.1)
        .to(U, { glow: 0, duration: 0.9, ease: 'power2.out' }, 0)
        .to(over, { z: d.zNear, y: 19, duration: 1.2, ease: 'power3.out' }, 0)
        .to(U, { door: 0, duration: 1.3, ease: 'power2.inOut' }, 0.7)
        .to(over, { x: () => base.x, y: () => base.y, z: () => base.z, h: () => base.h, duration: 1.8, ease: 'power2.inOut' }, 1.0)
        .to(extraTargets, { autoAlpha: 1, duration: 0.7 }, 2.2)
      timelines.push(tl)
    })
  }

  function destroy() {
    if (destroyed) return
    stop()
    destroyed = true
    onFrame = null
    img.onload = null
    for (const tl of timelines) tl.kill()
    timelines.length = 0
    gl.deleteTexture(atlasTex)
    if (planeTex) gl.deleteTexture(planeTex)
    for (const b of [bldBuf, quadBuf, instBuf]) gl.deleteBuffer(b)
    for (const v of [envVAO, bldVAO, sprVAO, plnVAO]) gl.deleteVertexArray(v)
    for (const prog of Object.values(P)) gl.deleteProgram(prog.p)
    for (const s of shaders) gl.deleteShader(s)
    loseContext()
  }

  return {
    base,
    intro,
    par,
    get useOver() {
      return useOver
    },
    get onFrame() {
      return onFrame
    },
    set onFrame(fn: FrameFn | null) {
      onFrame = fn
    },
    start,
    stop,
    resize,
    project,
    flyIn,
    flyOut,
    launchPlaneAfter(ms: number) {
      plane.nextAt = performance.now() + ms
    },
    destroy,
  }
}
