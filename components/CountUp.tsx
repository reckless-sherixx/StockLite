'use client'

import { useLayoutEffect, useState } from 'react'
import { fmt } from '@/components/format'
import { gsap, prefersReducedMotion } from '@/lib/gsap'

export type CountStart = { id: number; from: number }

// A number that counts from `start.from` to `value` whenever a new `start`
// arrives (each carries a fresh id); otherwise it just shows `value`.
// Rendered through state so React stays the only writer of the text node.
export default function CountUp({
  value,
  start,
}: {
  value: number
  start: CountStart | null
}) {
  const [shown, setShown] = useState(value)

  useLayoutEffect(() => {
    if (!start || prefersReducedMotion() || !Number.isFinite(start.from)) {
      setShown(value)
      return
    }
    const counter = { v: start.from }
    const tween = gsap.to(counter, {
      v: value,
      duration: 0.9,
      ease: 'power3.out',
      onUpdate: () => setShown(Math.round(counter.v)),
    })
    return () => {
      tween.kill()
    }
  }, [value, start])

  return <span>{fmt(shown)}</span>
}
