import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'

// Client-side motion helpers. Plugins touch `document` when registered, so
// registration waits for a browser; importing this module on the server (as
// client components are during SSR) is harmless.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip, ScrollTrigger, SplitText)
}

export { gsap, Flip, ScrollTrigger, SplitText }

// Read at call time rather than once, so a user toggling the OS setting is
// honoured on the next transition.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// The reference's smooth scroll: Lenis driven by the GSAP ticker and feeding
// ScrollTrigger. Returns the instance and a teardown for effect cleanup.
export function createSmoothScroll(): { lenis: Lenis; destroy: () => void } {
  const lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.1,
  })
  const onScroll = () => ScrollTrigger.update()
  const raf = (time: number) => lenis.raf(time * 1000)
  lenis.on('scroll', onScroll)
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)
  return {
    lenis,
    destroy: () => {
      gsap.ticker.remove(raf)
      lenis.off('scroll', onScroll)
      lenis.destroy()
    },
  }
}
