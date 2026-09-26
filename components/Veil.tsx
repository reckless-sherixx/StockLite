import { forwardRef } from 'react'

// Full-screen loader shown while a fresh page load boots (fonts, first
// timeline); the caller fades it out and unmounts it.
const Veil = forwardRef<HTMLDivElement>(function Veil(_props, ref) {
  return (
    <div id="veil" ref={ref} aria-hidden="true">
      <div className="veil-mark">
        <div className="veil-word">
          Stock
          <br />
          Lite
        </div>
        <div className="veil-bar">
          <i />
        </div>
      </div>
    </div>
  )
})

export default Veil
