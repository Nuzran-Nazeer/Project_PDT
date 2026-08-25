import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { createUnit, listUnits, updateUnit } from "../../services/orgUnits";
import { buildUnitSchema } from "../../schemas/orgUnitSchema";
import UnitTree from "../../components/org/UnitTree";
import UnitDetail from "../../components/org/UnitDetail";

// The organisation structure. Head of HR builds it; HR and Leadership read it.
//
// It lives at /organisation rather than /head-of-hr/organisation for the same reason
// the roster lives at /employees: three roles reach it, and naming the route after
// one of them would be wrong the moment the other two arrive.
//
// THE TREE IS A NAVIGATION RAIL, not the content. It started as the wide half of the
// screen and was inverted when the unit's own page arrived: a tree of five short
// names needs about fifteen characters of width, while its members, its lead and the
// appointment form need room. The selected unit is now the page and the tree is how
// you get to it.
//
// CREATING AND EDITING HAPPEN HERE, not on separate routes like /employees/new. A
// unit is three fields against an employee's ten, and the criterion says a unit is
// created "from this screen" — a whole page for a name, a type and a parent is
// heavier than the thing deserves, and it would hide the tree at the moment you most
// need to see it.
//
// Styling follows the roster and the record page rather than being invented here:
// the same header shape, the same `mt-6`/`mt-8` rhythm, the same primary button, the
// same alert.

const EMPTY = { name: "", type: "", parentUnitId: "" };

// Every unit beneath this one, so the parent picker can leave them out.
//
// The server refuses a unit placed inside its own sub-tree, so this is a guide rail
// rather than the rule — the same choice made for the lead picker, which offers only
// people eligible to lead rather than letting you pick anyone and be refused.
// Preventing the mistake reads better than reporting it.
const descendantsOf = (units, rootId) => {
  const found = new Set();

  const walk = (id) => {
    units.forEach((unit) => {
      const child = String(unit._id);
      if (String(unit.parentUnitId) !== String(id) || found.has(child)) return;
      found.add(child);
      walk(child);
    });
  };

  walk(rootId);
  return found;
};

export default function OrgTreePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, constants } = useAuth();
  const canManage = user?.roles?.includes("head_of_hr");
  // Wider than shaping the tree: HR places people and appoints leads, Head of HR
  // does that as well as changing the structure itself. Same split the server makes.
  const canAssign = user?.roles?.some((role) => ["hr", "head_of_hr"].includes(role));

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // What the right-hand side is doing: showing the selected unit, or creating, or
  // editing it. One value rather than two booleans, because "creating and editing
  // at once" is not a state that should be representable.
  //
  // `forUnit` records which unit was on screen when the form opened. It is what
  // lets a change of unit close the form by DERIVING the mode below, rather than by
  // an effect that writes state every time the URL changes.
  const [formState, setFormState] = useState({ mode: "idle", forUnit: null });
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = () =>
    listUnits()
      .then((data) => setUnits(data.items || []))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    let cancelled = false;

    listUnits()
      .then((data) => !cancelled && setUnits(data.items || []))
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  // THE SELECTED UNIT LIVES IN THE URL, not in state. A unit is now a page with
  // members and a lead on it, so it needs to be linkable and to survive a refresh —
  // and the tree stays beside it, which a separate route would have cost.
  const selected = units.find((unit) => String(unit._id) === String(id)) || null;

  // Any change of unit closes whatever the form was doing — including arriving by
  // URL or the back button, which a click handler would miss.
  //
  // Derived, not reset in an effect. The mode is already a function of the URL and
  // of where the form was opened, and an effect writing state on every change of
  // `id` is a second render pass for something that can simply be worked out.
  const mode = formState.forUnit === (id ?? null) ? formState.mode : "idle";

  const hasRoot = units.some((unit) => !unit.parentUnitId);

  // Which units may be offered as a parent. When editing, the unit itself and
  // everything under it are removed.
  const parentOptions = useMemo(() => {
    // A discontinued unit is never offered as a parent. The server refuses it, and
    // putting a live unit inside a closed one would bring the closed one back by the
    // back door — its sub-tree would be operating again while it is marked shut.
    const live = units.filter((unit) => unit.active !== false);

    if (mode !== "edit" || !selected) return live;

    const blocked = descendantsOf(units, selected._id);
    return live.filter(
      (unit) =>
        String(unit._id) !== String(selected._id) && !blocked.has(String(unit._id)),
    );
  }, [units, mode, selected]);

  const select = (unit) => navigate(`/organisation/${unit._id}`);

  const startCreate = () => {
    setFormState({ mode: "create", forUnit: id ?? null });
    setForm(EMPTY);
    setFieldErrors({});
    setFormError("");
  };

  const startEdit = () => {
    setFormState({ mode: "edit", forUnit: id ?? null });
    setForm({
      name: selected.name || "",
      type: selected.type || "",
      parentUnitId: selected.parentUnitId ? String(selected.parentUnitId) : "",
    });
    setFieldErrors({});
    setFormError("");
  };

  const cancel = () => {
    setFormState({ mode: "idle", forUnit: id ?? null });
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    // Editing the root is the one case where a parent is genuinely optional, so the
    // requirement is judged against what is being saved, not against the tree.
    const needsParent = mode === "create" ? hasRoot : Boolean(selected?.parentUnitId);

    try {
      await buildUnitSchema(constants, { hasRoot: needsParent }).validate(form, {
        abortEarly: false,
      });
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (!errors[err.path]) errors[err.path] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      parentUnitId: form.parentUnitId || null,
    };

    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createUnit(payload)
          : await updateUnit(selected._id, payload);

      await reload();
      // Navigating rather than selecting: a new unit becomes the page you are on.
      // The form is closed against the SAVED unit, so it stays closed once the URL
      // catches up rather than reopening for a moment.
      setFormState({ mode: "idle", forUnit: String(saved._id) });
      navigate(`/organisation/${saved._id}`);
    } catch (err) {
      // The server's own words: a second root, a unit inside itself, a company below
      // the top, a name already used by a sibling. Every one names the rule that
      // stopped it, and THE TREE IS UNTOUCHED — nothing is applied until the request
      // comes back, so a refusal changes nothing on screen.
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink";
  const primaryClass =
    "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryClass =
    "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  return (
    <section>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Organisation</h1>
          <p className="mt-1 text-muted">
            {canManage
              ? "The company as a tree of units. Supervision is read from its shape."
              : "The company as a tree of units. Only the Head of HR can change it."}
          </p>
        </div>

        {canManage && units.length > 0 && (
          <button
            type="button"
            onClick={startCreate}
            className={`ml-auto ${primaryClass}`}
          >
            New unit
          </button>
        )}
      </div>

      {loadError && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading the tree…</p>
      ) : units.length === 0 ? (
        // Empty state, not invented content. The first unit is the company itself,
        // and until it exists there is no tree and nothing else can be made.
        <div className="mt-6 rounded-xl border border-line bg-raised px-6 py-12 text-center">
          <p className="text-sm font-semibold text-ink">No units yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            {canManage
              ? "The tree starts with the company itself. Create that first, then add units beneath it."
              : "Nobody has built the organisation structure yet. The Head of HR creates it."}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={startCreate}
              className={`mt-6 ${primaryClass}`}
            >
              Create the company
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="rounded-xl border border-line bg-raised p-2">
            <UnitTree units={units} selectedId={selected?._id} onSelect={select} />
          </div>

          <div className="rounded-xl border border-line bg-raised p-5">
            {mode === "idle" ? (
              selected ? (
                <>
                  {/* Keyed by the unit so switching unit gives a fresh component
                      rather than one holding the previous unit's members while its
                      own request is still in flight. */}
                  <UnitDetail
                    key={selected._id}
                    unit={selected}
                    units={units}
                    canAssign={canAssign}
                    canManage={canManage}
                    onChanged={reload}
                  />
                  {canManage && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className={`mt-8 ${secondaryClass}`}
                    >
                      Edit this unit
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-muted">
                  {canManage
                    ? "Select a unit to see who is in it, rename it, or move it somewhere else."
                    : "Select a unit to see who is in it and who leads it."}
                </p>
              )
            ) : (
              // Capped rather than filling the panel: three short fields stretched
              // across a wide column read as a form nobody finished designing.
              <form onSubmit={handleSubmit} className="max-w-md">
                <p className="text-sm font-semibold text-ink">
                  {mode === "create"
                    ? hasRoot
                      ? "New unit"
                      : "The company"
                    : `Editing ${selected.name}`}
                </p>

                <div className="mt-5">
                  <label htmlFor="name" className={labelClass}>
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    aria-invalid={Boolean(fieldErrors.name)}
                    className={inputClass}
                  />
                  {fieldErrors.name && (
                    <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.name}</p>
                  )}
                </div>

                <div className="mt-4">
                  <label htmlFor="type" className={labelClass}>
                    Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    aria-invalid={Boolean(fieldErrors.type)}
                    className={inputClass}
                  >
                    <option value="">Choose…</option>
                    {(constants?.orgUnitTypes || []).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.type && (
                    <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.type}</p>
                  )}
                </div>

                {/* Absent entirely when the tree is empty: the first unit is the
                    company and has nowhere to sit. An empty dropdown would invite
                    the question and then refuse to answer it. */}
                {(mode === "edit" || hasRoot) && (
                  <div className="mt-4">
                    <label htmlFor="parentUnitId" className={labelClass}>
                      Sits inside
                    </label>
                    <select
                      id="parentUnitId"
                      name="parentUnitId"
                      value={form.parentUnitId}
                      onChange={handleChange}
                      aria-invalid={Boolean(fieldErrors.parentUnitId)}
                      className={inputClass}
                    >
                      <option value="">
                        {mode === "edit" && !selected.parentUnitId
                          ? "Nothing — this is the top"
                          : "Choose…"}
                      </option>
                      {parentOptions.map((unit) => (
                        <option key={unit._id} value={unit._id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.parentUnitId && (
                      <p className="mt-1.5 text-[13px] text-danger">
                        {fieldErrors.parentUnitId}
                      </p>
                    )}
                  </div>
                )}

                {formError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
                  >
                    {formError}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="submit" disabled={saving} className={primaryClass}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={cancel} className={secondaryClass}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
