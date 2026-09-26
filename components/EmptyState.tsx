export default function EmptyState({
  title,
  hint,
}: {
  title: string
  hint: string
}) {
  return (
    <div className="empty">
      <span className="empty-tray" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{hint}</p>
    </div>
  )
}
