'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import Icon from '@/components/Icon'
import Veil from '@/components/Veil'
import { fmt } from '@/components/format'
import { ARCHIVE, LOGIN, SECTIONS } from '@/components/sections'
import { useIsClient } from '@/components/useIsClient'
import { handoff } from '@/components/exterior/handoff'
import { SLAB, WL, clamp, computeLayout, floorY, smooth } from '@/components/exterior/layout'
import { createScene, type Cam, type FrameFn, type Scene } from '@/components/exterior/scene'
import {
  ScrollTrigger,
  SplitText,
  createSmoothScroll,
  gsap,
  prefersReducedMotion,
} from '@/lib/gsap'

export type ExteriorNotice = {
  warehouse: string
  units: number
  productCount: number
  lowCount: number
  lastTransferTo: string | null
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

// Floor tags run top floor first, as in the reference.
const TAGS = SECTIONS.map((s, i) => ({ section: s, y: floorY(s.id, i) })).reverse()

// The landing page (reference: #exterior, EXTERIOR and APP sections): the
// WebGL descent from above the clouds to the tower's door, then ENTER flies
// through the door into the interior. Every link into the interior plays
// that fly-in before router.push; plain navigation still works without JS.
export default function Exterior({ notice }: { notice: ExteriorNotice }) {
  const router = useRouter()
  const isClient = useIsClient()
  // Only a page painted from server HTML shows the veil (fresh full load).
  const [veiled, setVeiled] = useState(!isClient)

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fallbackRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const enterRef = useRef<((href: string) => void) | null>(null)
  const skipRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const cursor = cursorRef.current
    if (!root || !canvas || !cursor) return
    const html = document.documentElement
    const reduced = prefersReducedMotion()
    let exiting = false
    const veil = veilRef.current

    let cancelled = false
    let scene: Scene | null = null
    let wantRunning = false
    let descentTL: gsap.core.Timeline | null = null
    let descentST: ScrollTrigger | null = null
    let busy = false
    const smoothScroll = createSmoothScroll()
    const lenis = smoothScroll.lenis
    const ctx = gsap.context(() => {}, root)
    const off: (() => void)[] = []
    const listen = <K extends keyof WindowEventMap>(
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      window.addEventListener(type, fn, opts)
      off.push(() => window.removeEventListener(type, fn, opts))
    }

    const fallbackCam: Cam = { x: 0, y: 0, z: 0, h: 0.44 }
    const baseCam = () => (scene ? scene.base : fallbackCam)

    function buildDescent() {
      const b = baseCam()
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
      tl.fromTo(b, { x: 0, y: () => WL.heroY, z: 0, h: 0.44 }, { x: 0, y: 912, z: 150, h: 0.48, duration: 3.1, ease: 'power1.in', immediateRender: true }, 0)
        .to(b, { y: 588, z: 300, h: 0.56, duration: 1.3 }, 3.1)
        .to(b, { x: () => WL.groundX, y: 30, z: () => WL.groundZ, h: 0.74, duration: 4.4, ease: 'power2.out' }, 4.4)
        .to('#hero-copy', { yPercent: -18, autoAlpha: 0, duration: 1.2, ease: 'power1.in' }, 0.15)
        .to('#scroll-cue', { autoAlpha: 0, duration: 0.5 }, 0)
        .to('#jump-title', { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out', startAt: { y: 40 } }, 4.9)
        .to('#jump-title', { autoAlpha: 0, y: -30, duration: 0.5, ease: 'power1.in' }, 8.0)
        .to('.alt', { autoAlpha: 0, duration: 0.5 }, 8.3)
        .to('#ground-ui', { autoAlpha: 1, duration: 0.5 }, 8.5)
        .to('.enter-btn', { clipPath: 'inset(0% 0 0 0)', duration: 0.9, ease: 'power3.out' }, 8.5)
        .fromTo('.enter-links', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 8.8)
        .fromTo('.notice', { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power2.out' }, 8.7)
        .to({}, { duration: 0.5 }, 9.5)
      return tl
    }

    function initExterior() {
      const tags = Array.from(root!.querySelectorAll<HTMLElement>('.floor-tag')).map((el) => ({
        el,
        y: Number(el.dataset.y),
        on: false,
      }))
      const sign = root!.querySelector<HTMLElement>('#podium-sign')!
      const altMarker = root!.querySelector<HTMLElement>('#alt-marker')!
      const altRead = root!.querySelector<HTMLElement>('#alt-read')!
      const altBand = root!.querySelector<HTMLElement>('#alt-band')!
      const altTop = 1150
      altBand.style.top = `${(1 - SLAB[1] / altTop) * 100}%`
      altBand.style.height = `${((SLAB[1] - SLAB[0]) / altTop) * 100}%`

      descentTL = buildDescent()
      descentST = ScrollTrigger.create({ trigger: '#descent-track', start: 'top top', end: 'bottom bottom', scrub: true, animation: descentTL, invalidateOnRefresh: true })

      let lastAlt = -1
      const frame: FrameFn = (c, below, fog, project) => {
        // altimeter
        const m = Math.max(0, Math.round((c.y - 30) * 0.33))
        if (m !== lastAlt) {
          altRead.textContent = String(m)
          lastAlt = m
        }
        altMarker.style.top = `${clamp(1 - c.y / altTop, 0, 1) * 100}%`
        // floor tags pinned to the tower's right edge
        const p = descentST ? descentST.progress : 1
        const tagsOn = (1 - smooth(0.84, 0.9, p)) * (scene && scene.useOver ? 0 : 1)
        const ax = WL.towerX + WL.towerW / 2
        const az = WL.towerZ - WL.towerD / 2
        for (const t of tags) {
          const q = project(ax, t.y, az)
          let a = 0
          if (q) {
            const top = WL.narrow ? 0.3 : 0.03
            const focus = 1 - smooth(WL.H * 0.1, WL.H * 0.34, Math.abs(q.y - WL.H * (WL.narrow ? 0.58 : 0.46)))
            a = smooth(WL.H * 0.94, WL.H * 0.76, q.y) * smooth(WL.H * top, WL.H * (top + 0.15), q.y) * below * (1 - fog) * tagsOn * (0.45 + 0.55 * focus)
            const cw = Math.min(300, WL.W * (WL.narrow ? 0.66 : 1) - 32)
            const left = clamp(q.x + 56, 16, WL.W - cw - 16)
            t.el.style.setProperty('--cw', `${cw}px`)
            t.el.style.setProperty('--len', `${Math.max(14, left - q.x)}px`)
            t.el.style.transform = `translate3d(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px, 0) translateY(-50%)`
          }
          const on = a > 0.02
          if (on !== t.on) {
            t.el.style.visibility = on ? 'visible' : 'hidden'
            t.on = on
          }
          t.el.style.opacity = a.toFixed(3)
          t.el.style.pointerEvents = a > 0.35 ? 'auto' : 'none'
        }
        // lettering on the podium, above the canopy
        const s = project(WL.towerX, 55.5, WL.doorZ - 0.6)
        if (s && below > 0.5) {
          const sc = (7.2 * s.s) / 72
          const w = sign.offsetWidth
          sign.style.transform = `translate3d(${(s.x - (w * sc) / 2).toFixed(1)}px, ${(s.y - 50 * sc).toFixed(1)}px, 0) scale(${sc.toFixed(4)})`
          sign.style.opacity = String(smooth(0.5, 1, below))
        } else sign.style.opacity = '0'
      }
      if (scene) scene.onFrame = frame
    }

    function heroIntro() {
      if (reduced) return
      const split = SplitText.create(root!.querySelector('.hero-title'), { type: 'lines', mask: 'lines' })
      const tl = gsap.timeline({ delay: 0.1 })
      if (scene) tl.fromTo(scene.intro, { y: 90 }, { y: 0, duration: 3.2, ease: 'power3.out' }, 0)
      tl.from(split.lines, { yPercent: 108, duration: 1.3, ease: 'expo.out', stagger: 0.09, onComplete: () => split.revert() }, 0.45)
        .from('.hero-lede', { y: 22, autoAlpha: 0, duration: 1.1, ease: 'power3.out' }, 0.95)
        .from('#ext-nav > *', { y: -14, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.7)
        .from('.cue-in', { autoAlpha: 0, duration: 0.8 }, 1.4)
        .from('.alt-in', { autoAlpha: 0, x: 14, duration: 0.8 }, 1.2)
    }

    function startScene() {
      wantRunning = true
      if (scene && !document.hidden) scene.start()
    }

    // App.enter: finish the descent, fly through the door, then navigate.
    // The glow (root layout) stays up; the interior shell fades it out.
    async function enter(href: string) {
      if (busy) return
      busy = true
      lenis.stop()
      gsap.to(cursor!, { opacity: 0, duration: 0.3 })
      const p = descentST ? descentST.progress : 1
      if (p < 0.985) {
        await new Promise<void>((res) =>
          lenis.scrollTo(lenis.limit, {
            duration: reduced ? 0 : 1.2 + 2.2 * (1 - p),
            immediate: reduced,
            force: true,
            lock: true,
            easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
            onComplete: () => res(),
          }),
        )
        if (reduced) await sleep(30)
      }
      if (cancelled) return
      if (scene && !reduced) await scene.flyIn(['#ground-ui', '#ext-nav', '#podium-sign'])
      else await gsap.to('#glow', { autoAlpha: 1, duration: 0.45 })
      if (cancelled) return
      router.push(href)
    }

    // App.exit, second half: we arrive at the end of the descent under the
    // glow and back out of the door.
    async function arriveFromInterior() {
      lenis.stop()
      ScrollTrigger.refresh()
      lenis.resize()
      lenis.scrollTo(lenis.limit, { immediate: true, force: true })
      descentTL?.progress(1)
      const targets = ['#ground-ui', '#ext-nav']
      startScene()
      if (scene) {
        if (!reduced) {
          gsap.set(targets, { autoAlpha: 0 })
          await scene.flyOut(targets)
        } else {
          gsap.set(targets, { autoAlpha: 1 })
          await gsap.to('#glow', { autoAlpha: 0, duration: 0.4 })
        }
      } else {
        gsap.set(targets, { autoAlpha: 1 })
        await gsap.to('#glow', { autoAlpha: 0, duration: 0.6 })
      }
      if (cancelled) return
      gsap.to(cursor!, { opacity: 1, duration: 0.3 })
      lenis.start()
    }

    async function boot() {
      // Yield once so a StrictMode mount/unmount/mount never builds (and then
      // loses) a WebGL context or consumes the handoff on the discarded run.
      await Promise.resolve()
      if (cancelled) return
      exiting = handoff.exit
      handoff.exit = false
      if (veil) await Promise.race([document.fonts.ready, sleep(2500)])
      if (cancelled) return
      computeLayout()
      try {
        scene = createScene(canvas!, reduced)
      } catch (e) {
        console.warn('[StockLite] Scene init failed', e)
        scene = null
      }
      if (!scene) {
        html.classList.add('no-gl')
        if (fallbackRef.current) fallbackRef.current.hidden = false
      }
      ctx.add(() => initExterior())

      // mouse parallax + cursor ring (desktop only)
      if (window.matchMedia('(pointer: fine)').matches) {
        html.classList.add('has-cursor')
        const qx = gsap.quickTo(cursor!, 'x', { duration: 0.5, ease: 'power3.out' })
        const qy = gsap.quickTo(cursor!, 'y', { duration: 0.5, ease: 'power3.out' })
        let seen = false
        listen('pointermove', (e) => {
          if (!seen) {
            seen = true
            gsap.set(cursor!, { x: e.clientX, y: e.clientY })
            if (!busy) gsap.to(cursor!, { opacity: 1, duration: 0.4 })
          }
          qx(e.clientX)
          qy(e.clientY)
          if (scene && !scene.useOver) {
            scene.par.tx = (e.clientX / WL.W) * 2 - 1
            scene.par.ty = (e.clientY / WL.H) * 2 - 1
          }
          const target = e.target instanceof Element ? e.target : null
          cursor!.classList.toggle('is-hot', !!target?.closest('#exterior a, #exterior button'))
        }, { passive: true })
      }

      let resizeT = 0
      listen('resize', () => {
        window.clearTimeout(resizeT)
        resizeT = window.setTimeout(() => {
          computeLayout()
          scene?.resize()
          ScrollTrigger.refresh()
        }, 150)
      })
      off.push(() => window.clearTimeout(resizeT))

      enterRef.current = (href) => void enter(href)
      skipRef.current = () =>
        lenis.scrollTo(lenis.limit, {
          duration: reduced ? 0 : 1.6,
          onComplete: () => document.getElementById('enter-btn')?.focus({ preventScroll: true }),
        })

      if (exiting) {
        await arriveFromInterior()
        return
      }
      startScene()
      scene?.launchPlaneAfter(1600)
      if (veil) {
        gsap.to(veil, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut', onComplete: () => setVeiled(false) })
      }
      ctx.add(() => heroIntro())
    }

    // Pause rendering while the tab is hidden.
    const onVisibility = () => {
      if (!scene) return
      if (document.hidden) scene.stop()
      else if (wantRunning) scene.start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    void boot()

    return () => {
      cancelled = true
      enterRef.current = null
      skipRef.current = null
      document.removeEventListener('visibilitychange', onVisibility)
      for (const fn of off) fn()
      gsap.killTweensOf(cursor)
      if (veil) gsap.killTweensOf(veil)
      descentST?.kill()
      descentTL?.kill()
      ctx.revert()
      scene?.destroy()
      scene = null
      smoothScroll.destroy()
      html.classList.remove('has-cursor', 'no-gl')
    }
  }, [router])

  // Plain left-clicks into the interior play the fly-in first.
  const onEnterLink = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !enterRef.current
    ) {
      return
    }
    event.preventDefault()
    enterRef.current(href)
  }

  // Without JS the #ground hash jump still works.
  const onSkip = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!skipRef.current) return
    event.preventDefault()
    skipRef.current()
  }

  return (
    <>
      {veiled && <Veil ref={veilRef} />}
      <noscript>
        <style>{'#veil{display:none}'}</style>
      </noscript>
      <div className="cursor" aria-hidden="true" ref={cursorRef} />
      <div id="exterior" ref={rootRef}>
        <a href="#ground" className="skip" id="skip-descent" onClick={onSkip}>
          Skip the descent
        </a>
        <canvas id="scene" aria-hidden="true" ref={canvasRef} />
        <div id="scene-fallback" aria-hidden="true" hidden ref={fallbackRef} />

        <header className="ext-nav" id="ext-nav">
          <span className="ext-tag">Warehouse Inventory</span>
          <Link href="/" className="brand-stack" aria-label="StockLite home">
            <span>Stock</span>
            <span>Lite</span>
          </Link>
          <nav className="ext-links" aria-label="Account">
            <Link href={LOGIN.href} className="ext-link" onClick={(e) => onEnterLink(e, LOGIN.href)}>
              Sign in
            </Link>
            <Link href="/inventory" className="pill" onClick={(e) => onEnterLink(e, '/inventory')}>
              Open dashboard <Icon name="arrow" className="ic ic-sm" strokeWidth={2.6} />
            </Link>
          </nav>
        </header>

        <section className="hero-copy" id="hero-copy">
          <h1 className="hero-title">Warehouse stock, tracked the moment it moves.</h1>
          <p className="hero-lede">
            StockLite gives your team one place to see inventory, move stock
            between warehouses, and catch reorder points before shelves run dry.
          </p>
        </section>

        <div className="scroll-cue" id="scroll-cue" aria-hidden="true">
          <span className="cue-in">
            Scroll to descend
            <span className="cue-line">
              <i />
            </span>
          </span>
        </div>

        <div className="alt" aria-hidden="true">
          <div className="alt-in">
            <span className="alt-label">Altitude</span>
            <span className="alt-band" id="alt-band" />
            <span className="alt-scale" />
            <span className="alt-marker" id="alt-marker">
              <span className="alt-read">
                <span id="alt-read">0</span>
                <small>m</small>
              </span>
              <span className="alt-tick" />
            </span>
          </div>
        </div>

        <h2 className="jump-title" id="jump-title">
          Jump into StockLite
        </h2>
        <div className="floor-tags" id="floor-tags">
          {TAGS.map(({ section: s, y }) => (
            <Link
              key={s.id}
              href={s.href}
              className="floor-tag"
              data-id={s.id}
              data-y={y}
              onClick={(e) => onEnterLink(e, s.href)}
            >
              <span className="ft-dot" />
              <span className="ft-line" />
              <span className="ft-card">
                <span className="ft-head">
                  <Icon name={s.icon} />
                  <span className="ft-title">{s.title}</span>
                  <span className="ft-go">
                    <Icon name="arrow" strokeWidth={2.6} />
                  </span>
                </span>
                <span className="ft-desc">{s.desc}</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="podium-sign" id="podium-sign" aria-hidden="true">
          StockLite
        </div>

        <div className="ground-ui" id="ground-ui">
          <aside className="notice" aria-label="Warehouse notices">
            <span className="dymo">{notice.warehouse}</span>
            <p className="notice-big tnum">
              {fmt(notice.units)}
              <span>units</span>
            </p>
            <p className="notice-sub">across {plural(notice.productCount, 'product')}</p>
            <ul className="notice-list">
              <li>
                <Icon name="alert" />
                {plural(notice.lowCount, 'item')} near reorder threshold
              </li>
              {notice.lastTransferTo && (
                <li>
                  <Icon name="check" strokeWidth={2.6} />
                  Transfer to {notice.lastTransferTo} completed
                </li>
              )}
            </ul>
          </aside>
          <div className="enter-wrap" id="ground">
            <div className="enter-links">
              <Link href="/inventory" className="ext-link" onClick={(e) => onEnterLink(e, '/inventory')}>
                View live inventory
              </Link>
              <Link href="/transfer" className="ext-link" onClick={(e) => onEnterLink(e, '/transfer')}>
                Try a transfer
              </Link>
            </div>
            <Link
              href={ARCHIVE.href}
              className="enter-btn"
              id="enter-btn"
              onClick={(e) => onEnterLink(e, ARCHIVE.href)}
            >
              <span>Enter</span>
              <svg className="ea" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12h17M14 6l6 6-6 6" />
              </svg>
              <span className="fill" aria-hidden="true">
                <span>Enter</span>
                <svg className="ea" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h17M14 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          </div>
        </div>

        <div className="descent-track" id="descent-track" aria-hidden="true" />
      </div>
    </>
  )
}
