'use client'

import Link from 'next/link'
import { createContext, useContext, type ComponentProps, type MouseEvent } from 'react'

// Provided by the interior shell. It either lets next/link navigate as usual
// or calls preventDefault() and navigates itself once an exit animation ends.
export type InteriorNavigate = (
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
) => void

export const InteriorNavContext = createContext<InteriorNavigate | null>(null)

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string }

// A plain next/link (real href, works in new tabs and without JS) whose
// clicks the shell can choreograph.
export default function InteriorLink({ href, onClick, ...rest }: Props) {
  const navigate = useContext(InteriorNavContext)
  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) navigate?.(event, href)
      }}
    />
  )
}
