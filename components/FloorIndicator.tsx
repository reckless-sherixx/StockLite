'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'

// The black "floor" plate in the bar. A new title rolls up into the window
// while the old one rolls out, and the window eases to the new text width.
// The rolling spans are managed imperatively; React only renders the first.
export default function FloorIndicator({ title }: { title: string }) {
  const winRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const shown = useRef<string | null>(null)
  const tweens = useRef<gsap.core.Tween[]>([])
  const [firstTitle] = useState(title)

  useLayoutEffect(() => {
    const win = winRef.current
    const measure = measureRef.current
    if (!win || !measure) return
    const widthOf = (text: string) => {
      measure.textContent = text
      return Math.ceil(measure.offsetWidth) + 2
    }

    if (shown.current === null) {
      shown.current = title
      win.style.width = `${widthOf(title)}px`
      // Re-measure once the display face has loaded; the fallback is narrower.
      document.fonts?.ready.then(() => {
        if (shown.current === title) win.style.width = `${widthOf(title)}px`
      })
      return
    }
    if (shown.current === title) return
    shown.current = title

    const w = widthOf(title)
    const old = Array.from(win.querySelectorAll<HTMLElement>('.floor-text'))
    const next = document.createElement('span')
    next.className = 'floor-text'
    next.textContent = title
    win.append(next)
    if (prefersReducedMotion() || !old.length) {
      old.forEach((o) => o.remove())
      win.style.width = `${w}px`
      return
    }
    win.style.width = `${Math.max(w, win.offsetWidth)}px`
    gsap.killTweensOf(old)
    tweens.current = [
      gsap.fromTo(
        next,
        { yPercent: 100 },
        {
          yPercent: 0,
          duration: 0.55,
          ease: 'power3.out',
          onComplete: () => {
            win.style.width = `${w}px`
          },
        },
      ),
      gsap.to(old, {
        yPercent: -100,
        duration: 0.55,
        ease: 'power3.out',
        onComplete: () => old.forEach((o) => o.remove()),
      }),
    ]
  }, [title])

  useEffect(() => () => tweens.current.forEach((t) => t.kill()), [])

  return (
    <div className="floor" role="status" aria-live="polite">
      <span className="floor-dot" aria-hidden="true" />
      <span className="floor-win" ref={winRef}>
        <span className="floor-text">{firstTitle}</span>
      </span>
      <span className="floor-measure" ref={measureRef} aria-hidden="true" />
    </div>
  )
}
