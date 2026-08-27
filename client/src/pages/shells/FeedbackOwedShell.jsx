import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import PageHeader from "../../components/layout/PageHeader";
import ShellNotice from "../../components/shells/ShellNotice";
import ShellTable from "../../components/shells/ShellTable";

// Colleague feedback owed. Empty because nobody has been assigned to review anybody:
// choosing reviewers is a later story.
export default function FeedbackOwedShell() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title="Feedback I owe"
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <ShellNotice>
        This is the shape of the colleague feedback list, not the list. Nobody is assigned
        to review anybody yet: choosing reviewers is a later story, and until it runs
        there is nothing here to owe.
      </ShellNotice>

      <ShellTable
        heading="Feedback I owe"
        columns={["Colleague", "How you know them", "Status"]}
        rows={[]}
        empty="No colleague reviews have been assigned to you. Nobody has been asked to review anybody yet."
      />

      {/* With assignments this action sits on each row instead. */}
      <div className="mt-5 rounded-xl border border-dashed border-line p-5">
        <p className="text-sm text-muted">
          Each person assigned to you will carry a <strong>Review</strong> action here.
          The form is built and can be walked now, without a colleague attached to it.
        </p>
        <Link
          to="/feedback-i-owe/form"
          className="mt-3 inline-block rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand"
        >
          Open the colleague feedback form
        </Link>
      </div>

      <p className="mt-4 max-w-prose text-[13px] text-muted">
        A reviewer is only ever picked from people you actually worked with: four
        continuous months, at least two of them inside the cycle. The form you open will
        be the same competencies as your own, worded for a colleague.
      </p>
    </>
  );
}
