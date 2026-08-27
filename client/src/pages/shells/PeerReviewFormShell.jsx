import { useParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import ShellNotice from "../../components/shells/ShellNotice";
import CompetencyRows from "../../components/shells/CompetencyRows";
import { FormShell, FormSection, FormActions } from "../../components/shells/FormShell";

// The colleague feedback form. Same competencies as the self-assessment, worded for a
// colleague, because a shorter peer form makes the two averages incomparable.
//
// ⚠️ Anonymity runs one way. The reviewer sees who they review; the reviewee never
// learns who reviewed them. The risk is every screen downstream of this one.
export default function PeerReviewFormShell() {
  // The reviewee's id, once assignments exist. Nothing reads it yet.
  const { id } = useParams();

  return (
    <>
      <PageHeader
        title="Colleague feedback"
        context="The form as it will be, with nothing behind it"
        backTo="/dashboard"
      />

      <ShellNotice>
        This is the whole colleague feedback form. It is not attached to anybody: nobody
        has been assigned to review anybody yet, so there is no colleague to name at the
        top{id ? ` (asked for "${id}")` : ""}.
      </ShellNotice>

      <FormShell>
        <FormSection
          letter="A"
          title="Working relationship"
          note="How you know them, and for how long. It is what makes the rest of your answers readable to a supervisor who was not there."
        >
          <div className="grid gap-3">
            <Prompt>
              How you worked together (same unit, shared project, or across teams)
            </Prompt>
            <Prompt>Roughly how long</Prompt>
          </div>
        </FormSection>

        <FormSection
          letter="B"
          title="Competency ratings"
          note="The same competencies their supervisor rates, asked of you as a colleague. Decline any you have not seen: that is a real answer, not a gap."
        >
          {/* ⚠️ No reviewee yet, so no family is passed. Falling back to the signed-in
              person's own would be wrong and look right. */}
          <CompetencyRows
            jobFamily={undefined}
            prompt={(competency) => competency.definition}
          />
        </FormSection>

        <FormSection letter="C" title="In your own words">
          <div className="grid gap-3">
            <Prompt>One strength worth keeping</Prompt>
            <Prompt>One thing that would help them grow</Prompt>
          </div>
        </FormSection>

        <FormActions backTo="/feedback-i-owe" backLabel="Back to feedback I owe" />
      </FormShell>

      <p className="mt-4 max-w-prose text-[13px] text-muted">
        What you write reaches their supervisor as part of a consolidated summary, never
        with your name on it. Nothing you submit is shown to anybody until at least three
        colleagues have submitted, because a single comment on its own is traceable.
      </p>
    </>
  );
}

function Prompt({ children }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink">{children}</p>
      <div className="mt-1.5 rounded-lg border border-dashed border-line px-3.5 py-3 text-[13px] text-muted">
        Written answer
      </div>
    </div>
  );
}
