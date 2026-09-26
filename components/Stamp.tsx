'use client'

import { useLayoutEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'

// A rubber stamp that thumps down when mounted and jolts the slip it lands
// on (.readout or .docket). Remount it with a new key to stamp again.
export default function Stamp({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const stamp = ref.current
    if (!stamp || prefersReducedMotion()) return
    const slip = stamp.closest('.readout, .docket') ?? stamp.parentElement
    const ctx = gsap.context(() => {
      gsap.fromTo(
        stamp,
        { scale: 1.9, autoAlpha: 0, rotation: -3 },
        { scale: 1, autoAlpha: 0.92, rotation: -9, duration: 0.42, ease: 'power4.in' },
      )
      if (slip) {
        gsap.fromTo(
          slip,
          { x: 0 },
          { keyframes: { x: [0, -3, 3, -2, 0] }, duration: 0.3, delay: 0.4, ease: 'none', clearProps: 'x' },
        )
      }
    })
    return () => ctx.revert()
  }, [])

  return (
    <span ref={ref} className="stamp">
      {text}
    </span>
  )
}
