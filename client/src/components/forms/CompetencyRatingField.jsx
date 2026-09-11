import TextAreaField from "./TextAreaField";

// One competency, asked as one question. Every rater in the appraisal answers the same
// six, so this is written once and the wording of the prompt is what changes.
//
// ⚠️ "Not observed" sits IN the same radio group as the five scores, because it is an
// answer to the question rather than an escape from it. Split into a separate control it
// reads as a skip, and a skipped competency and a declined one are not the same record.

const SCALE = [
  { score: 1, label: "Unsatisfactory" },
  { score: 2, label: "Needs improvement" },
  { score: 3, label: "Meets expectations" },
  { score: 4, label: "Exceeds expectations" },
  { score: 5, label: "Outstanding" },
];

const NOT_OBSERVED = "notObserved";

export default function CompetencyRatingField({
  competency,
  value = {},
  onChange,
  prompt,
  disabled = false,
  readOnly = false,
  error,
}) {
  const name = `rating-${competency.key}`;
  const errorId = `${name}-error`;

  const chosen = value.notObserved
    ? NOT_OBSERVED
    : value.score != null
      ? String(value.score)
      : "";

  // Declining stores neither a score nor evidence, and the server refuses a record
  // carrying both, so the switch clears the other side rather than leaving it behind.
  const choose = (next) =>
    onChange(
      next === NOT_OBSERVED
        ? { notObserved: true, score: null, evidence: "" }
        : { notObserved: false, score: Number(next) },
    );

  if (readOnly) {
    return (
      <div className="rounded-lg border border-line p-4">
        <p className="font-medium text-ink">{competency.name}</p>

        <p className="mt-2 text-[13px] text-ink">{answerText(value)}</p>

        {!value.notObserved && (
          <p className="mt-2 max-w-prose whitespace-pre-wrap text-[13px] text-muted">
            {value.evidence || "No evidence given."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line p-4">
      <p className="font-medium text-ink">{competency.name}</p>
      <p className="mt-1 max-w-prose text-[13px] text-muted">
        {prompt ? prompt(competency) : competency.definition}
      </p>

      <fieldset className="mt-3" aria-describedby={error ? errorId : undefined}>
        <legend className="sr-only">Your rating for {competency.name}</legend>

        <div className="flex flex-wrap gap-2">
          {SCALE.map((step) => (
            <Choice
              key={step.score}
              name={name}
              value={String(step.score)}
              chosen={chosen}
              onChoose={choose}
              disabled={disabled}
            >
              <strong>{step.score}</strong> {step.label}
            </Choice>
          ))}

          <Choice
            name={name}
            value={NOT_OBSERVED}
            chosen={chosen}
            onChoose={choose}
            disabled={disabled}
            dashed
          >
            Not observed
          </Choice>
        </div>
      </fieldset>

      {!value.notObserved && (
        <TextAreaField
          className="mt-3"
          id={`evidence-${competency.key}`}
          label={`Evidence for ${competency.name}`}
          hideLabel
          placeholder="Evidence or example, required with every rating"
          value={value.evidence || ""}
          onChange={(evidence) => onChange({ evidence })}
          disabled={disabled}
        />
      )}

      {error && (
        <p id={errorId} className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// Spelled out rather than shown as the chosen pill among six: a closed record is read,
// not scanned for which control is lit.
function answerText(value) {
  if (value.notObserved) return "Not observed.";
  const step = SCALE.find((s) => s.score === value.score);
  return step ? `${step.score} \u00b7 ${step.label}` : "No answer given.";
}

// The radio carries the meaning and the span carries the look. Hiding the input with
// `sr-only` rather than swapping it for a button keeps arrow-key movement through the
// scale, which is what a rating group is supposed to do.
function Choice({ name, value, chosen, onChoose, disabled, dashed, children }) {
  const border = dashed ? "border-dashed border-line" : "border-line";

  return (
    <label className={disabled ? "cursor-not-allowed" : "cursor-pointer"}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={chosen === value}
        disabled={disabled}
        onChange={(e) => onChoose(e.target.value)}
        className="peer sr-only"
      />
      <span
        className={`inline-block rounded-lg border px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:text-ink peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:opacity-60 ${border}`}
      >
        {children}
      </span>
    </label>
  );
}
