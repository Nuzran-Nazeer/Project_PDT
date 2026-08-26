import { useAuth } from "../../hooks/useAuth";
import PageHeader from "../../components/layout/PageHeader";

// Every tab that has a place in the design and no data behind it yet.
//
// ONE PAGE SERVES ALL OF THEM, driven by the registry entry the router hands it. The
// alternative was twenty near identical files, which is twenty places for the wording
// to drift and twenty files to delete later.
//
// WHY THESE EXIST AT ALL RATHER THAN BEING LEFT OUT. Sprint 1 was planned as a
// skeleton that runs end to end, chosen deliberately over finishing one feature at a
// time: a skeleton can be demonstrated and tested from week two, four perfect
// features and no flow cannot. Clicking through the real navigation and finding an
// honest "not built yet" is the demonstration. Finding a missing link is not.
//
// AND WHY IT SAYS "NOT BUILT" IN THOSE WORDS. "Nothing to show" is a real answer: it
// means you have no colleague reviews this cycle. This is a different statement, and
// showing the second as the first tells somebody something false about their own
// appraisal.
export default function PendingTabPage({ tab }) {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title={tab.title}
        context={[user?.designation, user?.name].filter(Boolean).join(" · ")}
        backTo="/dashboard"
      />

      <div className="rounded-xl border border-dashed border-line p-10 text-center">
        <p className="text-ink">{tab.description}</p>
        <p className="mx-auto mt-3 max-w-prose text-sm text-muted">
          Not built yet. This screen has a place in the design and a route that works,
          and the data behind it does not exist on the server.
        </p>
      </div>
    </>
  );
}
