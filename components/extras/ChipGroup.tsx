// A radio group drawn as chips, the same filter vocabulary as History.
export default function ChipGroup({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string
  label: string
  options: [string, string][]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="filter-group">
      <legend className="filter-label">{label}</legend>
      <div className="chips">
        {options.map(([v, text]) => (
          <label className="chip" key={v}>
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
