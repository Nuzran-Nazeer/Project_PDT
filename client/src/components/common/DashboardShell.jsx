// The frame each role's dashboard is built into: a title, a line saying whose
// screen it is, and an empty state.
//
// The empty state is the point. None of the data these dashboards will show —
// cycles, self-assessments, peer reviews, plan actions — exists yet, and the
// stories that create it have not been written. Filling the space with plausible
// widgets would produce a screen that demos well and is entirely invented, so it
// says plainly that there is nothing here rather than guessing.
// `panel` is for the parts of a dashboard that ARE built, and it sits above the
// empty state rather than replacing it: one true panel does not make the cycles,
// reviews and plans below it exist. `children` still replaces the empty state
// outright, for whenever a dashboard is finished.
export default function DashboardShell({ title, description, panel, children }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 max-w-prose text-muted">{description}</p>

      {panel}

      <div className="mt-8 rounded-xl border border-dashed border-line bg-raised p-10 text-center">
        {children || (
          <p className="text-muted">
            Nothing to show yet — the appraisal cycle, reviews and plans this screen
            reports on have not been built.
          </p>
        )}
      </div>
    </section>
  );
}
