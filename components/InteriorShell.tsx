'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type Lenis from 'lenis'
import FloorIndicator from '@/components/FloorIndicator'
import Icon from '@/components/Icon'
import InteriorLink, { InteriorNavContext } from '@/components/InteriorLink'
import Veil from '@/components/Veil'
import {
  ARCHIVE,
  LOGIN,
  SECTIONS,
  interiorRoute,
  type SectionCounts,
} from '@/components/sections'
import { useIsClient } from '@/components/useIsClient'
import {
  Flip,
  createSmoothScroll,
  gsap,
  prefersReducedMotion,
} from '@/lib/gsap'

export type ShellUser = { name: string; initials: string }

// What a click started, consumed when the destination route renders.
// 'flip' carries the lobby compartments' positions for Flip; the others only
// mark the navigation as ours (so the new page starts at the top).
type Pending =
  | { kind: 'flip'; to: string; state: Flip.FlipState; pick: DOMRect | null }
  | { kind: 'exit' | 'plain'; to: string }

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// The persistent interior: int-bar + main, with the cabinet rail and open
// folder around file pages. It stays mounted across interior navigations so
// the reference's cross-page transitions can play:
//   lobby -> file   compartments Flip into the drawer rail, the folder flies
//                   onto the desk (state captured on click, played on arrival)
//   file -> file    folder shrinks into its drawer, then the next route
//                   loads and the folder re-emerges from the new drawer
//   anything else   fade out, navigate, then the destination's intro
//   full page load  the veil lifts and the "entering" timeline plays
// Browser back/forward skips the exit half and plays only the arrival.
export default function InteriorShell({
  user,
  counts,
  children,
}: {
  user: ShellUser
  counts: SectionCounts
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const route = interiorRoute(pathname)
  const isClient = useIsClient()
  // Only a page painted from server HTML needs the veil: it hides the
  // content until the entering timeline has taken hold of it.
  const [veiled, setVeiled] = useState(!isClient)
  const [floorTitle, setFloorTitle] = useState(route?.title ?? '')

  const rootRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const scene = useRef<gsap.Context | null>(null) // current arrival animations
  const exit = useRef<gsap.core.Tween | null>(null) // running exit animation
  const pending = useRef<Pending | null>(null)
  const lastPath = useRef(pathname) // the route currently on screen

  const arrive = useCallback(
    (path: string, prev: string | null, entering: boolean) => {
      const root = rootRef.current
      const main = mainRef.current
      const to = interiorRoute(path)
      const from = prev === null ? null : interiorRoute(prev)
      const intent = pending.current?.to === path ? pending.current : null
      pending.current = null

      // Settle anything still moving from the previous transition.
      const running = exit.current
      exit.current = null
      if (running) {
        const targets = running.targets()
        running.kill()
        gsap.set(targets, { clearProps: 'transform,opacity,visibility' })
      }
      scene.current?.revert()
      scene.current = null
      if (!root || !main || !to) return

      if (intent) {
        lenisRef.current?.scrollTo(0, { immediate: true, force: true })
      }
      const reduced = prefersReducedMotion()
      if (to.kind === 'file') {
        const rail = root.querySelector<HTMLElement>('.cabinet')
        const drawer = rail?.querySelector<HTMLElement>(
          `.drawer[data-id="${to.section.id}"]`,
        )
        if (rail && drawer && rail.scrollWidth > rail.clientWidth) {
          rail.scrollTo({
            left: drawer.offsetLeft - (rail.clientWidth - drawer.offsetWidth) / 2,
            behavior: reduced ? 'auto' : 'smooth',
          })
        }
      }

      if (!reduced) {
        scene.current = gsap.context((self) => {
          if (to.kind === 'archive') {
            const tl = gsap.timeline()
            if (entering) {
              tl.from('.lobby', { scale: 1.07, filter: 'blur(10px)', duration: 1.5, ease: 'power3.out', clearProps: 'filter,transform' }, 0)
            }
            tl.from('.lobby-title', { y: 40, autoAlpha: 0, duration: 1.1, ease: 'expo.out' }, entering ? 0.2 : 0)
              .from('.cubby', { y: 50, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07 }, entering ? 0.3 : 0.05)
              .from('.cubby-folder', { yPercent: 42, duration: 1.3, ease: 'expo.out', stagger: 0.07, clearProps: 'transform' }, entering ? 0.45 : 0.15)
          } else if (to.kind === 'login') {
            gsap.timeline()
              .from('.lanyard', { scaleY: 0, transformOrigin: '50% 0%', duration: 0.8, ease: 'expo.out' }, 0)
              .from('.badge', { y: -60, rotationX: -18, autoAlpha: 0, transformOrigin: '50% 0%', duration: 1.2, ease: 'elastic.out(1, 0.75)' }, 0.1)
              .from('.badge-body > *', { y: 12, autoAlpha: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' }, 0.4)
          } else if (intent?.kind === 'flip') {
            // Signature: the compartments collapse into the drawer rail while
            // the chosen file flies onto the desk.
            gsap.set('.drawer-in', { autoAlpha: 0 })
            Flip.from(intent.state, {
              targets: '.drawer',
              duration: 0.95,
              ease: 'power3.inOut',
              absolute: true,
              stagger: 0.035,
              props: 'backgroundColor,borderRadius',
              onComplete: () => {
                self.add(() => gsap.to('.drawer-in', { autoAlpha: 1, duration: 0.4, stagger: 0.05 }))
              },
            })
            const folder = root.querySelector<HTMLElement>('#folder')
            const pick = intent.pick
            if (folder && pick) {
              const fr = folder.getBoundingClientRect()
              gsap.from(folder, { x: pick.left - fr.left, y: pick.top - fr.top, scale: pick.width / fr.width, rotation: -2, transformOrigin: '0% 0%', duration: 1.05, ease: 'power3.inOut', clearProps: 'transform' })
            }
            gsap.from('#sheet > *', { y: 18, autoAlpha: 0, duration: 0.65, stagger: 0.05, delay: 0.75, ease: 'power3.out' })
          } else if (from?.kind === 'file') {
            // Second half of the folder swap: re-emerge from the new drawer.
            const folder = root.querySelector<HTMLElement>('#folder')
            const drawer = root.querySelector<HTMLElement>(`.drawer[data-id="${to.section.id}"]`)
            if (folder && drawer) {
              const fr = folder.getBoundingClientRect()
              const dr = drawer.getBoundingClientRect()
              gsap.fromTo(
                folder,
                { x: dr.left - fr.left, y: dr.top - fr.top, scale: dr.width / fr.width, autoAlpha: 0, transformOrigin: '0% 0%' },
                { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.75, ease: 'expo.out', clearProps: 'transform,opacity,visibility' },
              )
            }
            gsap.from('#sheet > *', { y: 14, autoAlpha: 0, duration: 0.55, stagger: 0.04, delay: 0.22, ease: 'power3.out' })
          } else {
            const tl = gsap.timeline()
            if (entering) {
              tl.from('.desk-layout', { scale: 1.06, filter: 'blur(10px)', duration: 1.4, ease: 'power3.out', clearProps: 'filter,transform' }, 0)
            }
            tl.from('.drawer', { x: -40, autoAlpha: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06, clearProps: 'transform,opacity,visibility' }, 0.1)
              .from('#folder', { y: 60, autoAlpha: 0, duration: 1, ease: 'expo.out', clearProps: 'transform,opacity,visibility' }, 0.15)
              .from('#sheet > *', { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.05, ease: 'power3.out' }, 0.4)
          }
        }, root)
      }

      main.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
    },
    [],
  )

  // Mount: smooth scroll, then the entering timeline (after the fonts, under
  // the veil, on a full page load).
  useLayoutEffect(() => {
    const smooth = createSmoothScroll()
    lenisRef.current = smooth.lenis
    let cancelled = false
    let veilTween: gsap.core.Tween | null = null
    const start = () => {
      if (cancelled) return
      if (veilRef.current) {
        veilTween = gsap.to(veilRef.current, {
          autoAlpha: 0,
          duration: 0.7,
          ease: 'power2.inOut',
          onComplete: () => setVeiled(false),
        })
      }
      arrive(lastPath.current, null, true)
    }
    if (veilRef.current) {
      Promise.race([document.fonts.ready, sleep(2500)]).then(start)
    } else {
      start()
    }
    return () => {
      cancelled = true
      veilTween?.kill()
      exit.current?.kill()
      exit.current = null
      scene.current?.revert()
      scene.current = null
      smooth.destroy()
      lenisRef.current = null
    }
  }, [arrive])

  // Every committed route change inside the interior.
  useLayoutEffect(() => {
    const prev = lastPath.current
    if (prev === pathname) return
    lastPath.current = pathname
    const next = interiorRoute(pathname)
    if (next) setFloorTitle(next.title)
    arrive(pathname, prev, false)
  }, [pathname, arrive])

  const navigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      const link = event.currentTarget
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (link.target && link.target !== '_self')
      ) {
        return
      }
      const current = lastPath.current
      const from = interiorRoute(current)
      const to = interiorRoute(href)
      // Leaving the interior (e.g. back home) is a plain navigation.
      if (!from || !to) return
      if (href === current) {
        event.preventDefault()
        return
      }
      setFloorTitle(to.title)

      if (prefersReducedMotion()) {
        pending.current = { kind: 'plain', to: href }
        return
      }
      // An exit already started: retarget it. If it has finished, its push is
      // in flight, so replace that navigation.
      const running = exit.current
      if (running) {
        event.preventDefault()
        if (pending.current) pending.current = { ...pending.current, to: href }
        if (running.progress() === 1) router.push(href)
        return
      }

      const root = rootRef.current
      // Snap any intro still playing to its end so measurements are clean.
      scene.current?.revert()
      scene.current = null

      if (from.kind === 'archive' && to.kind === 'file' && root) {
        const pick = link.querySelector('.cubby-folder')
        pending.current = {
          kind: 'flip',
          to: href,
          state: Flip.getState(root.querySelectorAll('.cubby'), {
            props: 'backgroundColor,borderRadius',
          }),
          pick: pick ? pick.getBoundingClientRect() : null,
        }
        return // next/link navigates now; the Flip plays when the file renders
      }

      event.preventDefault()
      pending.current = { kind: 'exit', to: href }
      // exit.current is kept until the arrival, which clears its inline
      // styles before measuring the new layout.
      const go = () => router.push(pending.current?.to ?? href)

      if (from.kind === 'file' && to.kind === 'file' && root) {
        // First half of the folder swap: shrink into the current drawer.
        const folder = root.querySelector<HTMLElement>('#folder')
        const drawer = root.querySelector<HTMLElement>(
          `.drawer[data-id="${from.section.id}"]`,
        )
        if (!folder || !drawer) return go()
        const fr = folder.getBoundingClientRect()
        const dr = drawer.getBoundingClientRect()
        exit.current = gsap.to(folder, {
          x: dr.left - fr.left,
          y: dr.top - fr.top,
          scale: dr.width / fr.width,
          autoAlpha: 0,
          transformOrigin: '0% 0%',
          duration: 0.45,
          ease: 'power3.in',
          onComplete: go,
        })
        return
      }

      const page = mainRef.current?.firstElementChild
      if (!page) return go()
      exit.current = gsap.to(page, {
        autoAlpha: 0,
        y: 14,
        duration: 0.26,
        ease: 'power2.in',
        onComplete: go,
      })
    },
    [router],
  )

  const file = route?.kind === 'file' ? route.section : null

  return (
    <InteriorNavContext.Provider value={navigate}>
      {veiled && <Veil ref={veilRef} />}
      <noscript>
        <style>{'#veil{display:none}.floor-win{width:auto}.floor-text{position:static}'}</style>
      </noscript>
      <div className="interior" ref={rootRef}>
        <header className="int-bar">
          <InteriorLink href={ARCHIVE.href} className="brand" aria-label="StockLite archive">
            <span className="brand-mark">SL</span>
            <span className="brand-text">
              <b>StockLite</b>
              <small>Warehouse Inventory</small>
            </span>
          </InteriorLink>
          <FloorIndicator title={floorTitle} />
          <div className="bar-right">
            <div className="staff">
              <span className="avatar" aria-hidden="true">
                {user.initials}
              </span>
              <span className="staff-text">
                <small>Signed in as</small>
                <b>{user.name}</b>
              </span>
            </div>
            <InteriorLink href={LOGIN.href} className="bar-link">
              Switch user
            </InteriorLink>
            <Link href="/" className="btn-exit" aria-label="Back to home">
              <Icon name="back" className="ic ic-sm" />
              <span>Back to home</span>
            </Link>
          </div>
        </header>
        <main id="int-main" tabIndex={-1} ref={mainRef}>
          {file ? (
            <div className="desk-layout">
              <nav className="cabinet" aria-label="Files">
                <ul className="drawers">
                  {SECTIONS.map((s) => {
                    const open = s.id === file.id
                    return (
                      <li key={s.id}>
                        <InteriorLink
                          href={s.href}
                          className={open ? 'drawer is-open' : 'drawer'}
                          data-flip-id={`drawer-${s.id}`}
                          data-id={s.id}
                          aria-current={open ? 'page' : undefined}
                        >
                          <span className="drawer-in">
                            <span className="drawer-icon">
                              <Icon name={s.icon} />
                            </span>
                            <span className="drawer-meta">
                              <span className="dymo">{s.label}</span>
                              <span className="drawer-count">{s.stat(counts)}</span>
                            </span>
                          </span>
                        </InteriorLink>
                      </li>
                    )
                  })}
                </ul>
              </nav>
              <section className="desk">
                <article className="folder" id="folder">
                  <div className="folder-tab">
                    <span className="dymo">{file.label}</span>
                  </div>
                  <div className="folder-body">
                    <div className="sheet" id="sheet">
                      {children}
                    </div>
                  </div>
                </article>
              </section>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </InteriorNavContext.Provider>
  )
}
