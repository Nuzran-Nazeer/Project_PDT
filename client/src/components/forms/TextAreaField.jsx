// A labelled written answer. Every form in the appraisal asks for several, and a
// placeholder is not a label: it disappears the moment somebody types.
//
// `readOnly` is not `disabled`. A disabled box is a control somebody cannot use and
// reads as broken; a closed record has no controls on it at all.
export default function TextAreaField({
  id,
  label,
  hideLabel = false,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  rows = 2,
  placeholder,
  error,
  className = "",
}) {
  const errorId = `${id}-error`;

  if (readOnly) {
    return (
      <div className={className}>
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="mt-1 max-w-prose whitespace-pre-wrap text-[13px] text-muted">
          {value || "Nothing written."}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={
          hideLabel ? "sr-only" : "mb-1.5 block text-[13px] font-medium text-ink"
        }
      >
        {label}
      </label>

      <textarea
        id={id}
        rows={rows}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink placeholder:text-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      />

      {error && (
        <p id={errorId} className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
