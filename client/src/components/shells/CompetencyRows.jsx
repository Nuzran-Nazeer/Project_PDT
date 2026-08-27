import { useAuth } from "../../hooks/useAuth";
import { competenciesFor } from "../../utils/competencies";

// One component for all three forms: every rater rates the same competencies and only
// the wording changes. Separate lists drift, and drifted lists are not comparable.
//
// ⚠️ Nothing here assumes six, and the family is the REVIEWEE's, never the rater's.

// Labelled because unlabelled numbers drift between supervisors.
const SCALE = [
  { score: 1, label: "Unsatisfactory" },
  { score: 2, label: "Needs improvement" },
  { score: 3, label: "Meets expectations" },
  { score: 4, label: "Exceeds expectations" },
  { score: 5, label: "Outstanding" },
];

export default function CompetencyRows({ jobFamily, prompt }) {
  const { constants } = useAuth();
  const competencies = competenciesFor(constants, jobFamily);

  if (competencies.length === 0) {
    return (
      <p className="text-sm text-muted">
        No competency set could be read for {jobFamily || "this job family"}.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {competencies.map((competency) => (
        <div key={competency.key} className="rounded-lg border border-line p-4">
          <p className="font-medium text-ink">{competency.name}</p>
          <p className="mt-1 max-w-prose text-[13px] text-muted">
            {prompt ? prompt(competency) : competency.definition}
          </p>

          {/* Drawn out rather than a dropdown: the labels are the point. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {SCALE.map((step) => (
              <span
                key={step.score}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-muted"
              >
                <strong className="text-ink">{step.score}</strong> {step.label}
              </span>
            ))}
            {/* A real answer, not a blank: no score, no evidence required. */}
            <span className="rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[12px] text-muted">
              Not observed
            </span>
          </div>

          <div className="mt-3 rounded-lg border border-dashed border-line px-3.5 py-2.5 text-[13px] text-muted">
            Evidence or example, required with every rating
          </div>
        </div>
      ))}
    </div>
  );
}
