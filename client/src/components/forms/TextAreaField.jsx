// `readOnly` is not `disabled`: a closed record has no controls on it at all.
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
        <p className="mt-2 max-w-prose whitespace-pre-wrap rounded-lg border border-line bg-secondary/40 p-3 text-[13px] leading-relaxed text-ink">
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
        className="workflow-field w-full"
      />

      {error && (
        <p id={errorId} className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
