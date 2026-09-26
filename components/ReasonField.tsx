import { MOVEMENT_REASONS, MovementReason, isMovementReason } from '@/lib/types'

// Optional reason for a stock movement; '' means "No reason" and is not sent.
export default function ReasonField({
  id,
  value,
  onChange,
}: {
  id: string
  value: MovementReason | ''
  onChange: (reason: MovementReason | '') => void
}) {
  return (
    <div className="field">
      <label htmlFor={id}>Reason</label>
      <select
        id={id}
        className="select"
        value={value}
        onChange={(e) =>
          onChange(isMovementReason(e.target.value) ? e.target.value : '')
        }
      >
        <option value="">No reason</option>
        {MOVEMENT_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  )
}
