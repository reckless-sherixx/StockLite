// The four nav icons plus a few authored in the same 24px stroke style.
const PATHS = {
  inventory: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M9 4v16" />
    </>
  ),
  stock: <path d="M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5" />,
  transfer: <path d="M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4" />,
  history: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  arrow: <path d="M3 12h17M14 6l6 6-6 6" />,
  back: <path d="M21 12H4M10 6l-6 6 6 6" />,
  alert: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4.2M12 17.2v.3" />
    </>
  ),
  check: <path d="M4.5 12.5l4.8 4.8L19.5 7" />,
  link: (
    <>
      <path d="M9.5 14.5l5-5" />
      <path d="M11 6.5l1.6-1.6a4 4 0 0 1 5.6 5.6L16.6 12M13 17.5l-1.6 1.6a4 4 0 0 1-5.6-5.6L7.4 12" />
    </>
  ),
  in: (
    <>
      <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4 20h16" />
    </>
  ),
  out: (
    <>
      <path d="M12 18.5v-11M7.5 12L12 7.5 16.5 12" />
      <path d="M4 4h16" />
    </>
  ),
  tin: (
    <>
      <path d="M20 12H8M12 8l-4 4 4 4" />
      <path d="M4 4v16" />
    </>
  ),
  tout: (
    <>
      <path d="M4 12h12M12 8l4 4-4 4" />
      <path d="M20 4v16" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

export default function Icon({
  name,
  className = 'ic',
  strokeWidth = 2.4,
}: {
  name: IconName
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
