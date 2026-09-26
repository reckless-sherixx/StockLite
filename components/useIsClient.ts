'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// false on the server and while hydrating (so markup matches the server's),
// true afterwards and on client-only mounts. Lets a component tell "painted
// from server HTML" apart from "mounted by a client-side navigation".
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
