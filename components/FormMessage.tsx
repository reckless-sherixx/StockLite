import Icon from '@/components/Icon'

// The live region under a form: an ink error slip or a ruled success line.
export default function FormMessage({
  error,
  success,
}: {
  error: string
  success: string
}) {
  return (
    <div className="msg" aria-live="polite">
      {error ? (
        <p className="form-error">
          <Icon name="alert" />
          <span>{error}</span>
        </p>
      ) : success ? (
        <p className="form-success">
          <Icon name="check" />
          <span>{success}</span>
        </p>
      ) : null}
    </div>
  )
}
