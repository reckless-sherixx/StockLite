'use client'

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'

const ROWS = 'tbody tr, .empty'

// The reference's filter repaint: the rows on screen fade up and out, then
// the new set renders and drops in. Returns the filter value to render (it
// trails `value` by the fade-out) and its key; the caller keys the panel's
// content by that key so each repaint gets fresh rows, as the reference's
// innerHTML swap does. `key` must identify `value`.
export function useRowSwap<T>(
  value: T,
  key: string,
  panelRef: RefObject<HTMLElement>,
  stagger: { out: number; in: number },
): { value: T; key: string } {
  const [shown, setShown] = useState({ value, key })
  const animateIn = useRef(false)

  useLayoutEffect(() => {
    if (key === shown.key) return
    const swap = () => {
      animateIn.current = !prefersReducedMotion()
      setShown({ value, key })
    }
    const panel = panelRef.current
    const old = panel ? Array.from(panel.querySelectorAll(ROWS)) : []
    if (prefersReducedMotion() || !old.length) {
      swap()
      return
    }
    gsap.killTweensOf(old)
    const tween = gsap.to(old, {
      autoAlpha: 0,
      y: -6,
      duration: 0.14,
      stagger: stagger.out,
      onComplete: swap,
    })
    return () => {
      tween.kill()
    }
    // Only a new key starts a repaint; value is read from the same render.
  }, [key])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!animateIn.current || !panel) return
    animateIn.current = false
    const ctx = gsap.context(() => {
      gsap.from(ROWS, {
        y: 10,
        autoAlpha: 0,
        duration: 0.45,
        ease: 'power3.out',
        stagger: stagger.in,
      })
    }, panel)
    return () => ctx.revert()
  }, [shown.key])

  return shown
}
