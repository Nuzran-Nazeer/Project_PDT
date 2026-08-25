import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createUnit, listUnits, updateUnit } from "../../services/orgUnits";
import { buildUnitSchema } from "../../schemas/orgUnitSchema";
import UnitTree from "../../components/org/UnitTree";

// The organisation structure. Head of HR builds it; HR and Leadership read it.
//
// It lives at /organisation rather than /head-of-hr/organisation for the same reason
// the roster lives at /employees: three roles reach it, and naming the route after
// one of them would be wrong the moment the other two arrive.
//
// CREATING AND EDITING HAPPEN HERE, not on separate routes like /employees/new. A
// unit is three fields against an employee's ten, and the criterion says a unit is
// created "from this screen" — a whole page for a name, a type and a parent is
// heavier than the thing deserves, and it would hide the tree at the moment you most
// need to see it.
//
// Styling follows the roster and the record page rather than being invented here:
// the same header shape, the same `mt-6`/`mt-8` rhythm, the same primary button, the
// same alert. An earlier version of this file used `hover:opacity-90` on the primary
// button, which quietly ignored the `--color-brand-hover` token that exists for
// exactly that state.

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
  const { user, constants } = useAuth();
  const canManage = user?.roles?.includes("head_of_hr");

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // `mode` is what the side panel is doing: nothing, creating, or editing the
  // selected unit. One value rather than two booleans, because "creating and
  // editing at once" is not a state that should be representable.
  const [mode, setMode] = useState("idle");
  const [selected, setSelected] = useState(null);
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

  const hasRoot = units.some((unit) => !unit.parentUnitId);

  // Which units may be offered as a parent. When editing, the unit itself and
  // everything under it are removed.
  const parentOptions = useMemo(() => {
    if (mode !== "edit" || !selected) return units;
    const blocked = descendantsOf(units, selected._id);
    return units.filter(
      (unit) =>
        String(unit._id) !== String(selected._id) && !blocked.has(String(unit._id)),
    );
  }, [units, mode, selected]);

  const select = (unit) => {
    setSelected(unit);
    setMode("idle");
    setFieldErrors({});
    setFormError("");
  };

  const startCreate = () => {
    setMode("create");
    setSelected(null);
    setForm(EMPTY);
    setFieldErrors({});
    setFormError("");
  };

  const startEdit = () => {
    setMode("edit");
    setForm({
      name: selected.name || "",
      type: selected.type || "",
      parentUnitId: selected.parentUnitId ? String(selected.parentUnitId) : "",
    });
    setFieldErrors({});
    setFormError("");
  };

  const cancel = () => {
    setMode("idle");
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
      setSelected(saved);
      setMode("idle");
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
          <button type="button" onClick={startCreate} className={`ml-auto ${primaryClass}`}>
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
            <button type="button" onClick={startCreate} className={`mt-6 ${primaryClass}`}>
              Create the company
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="rounded-xl border border-line bg-raised p-3">
            <UnitTree units={units} selectedId={selected?._id} onSelect={select} />
          </div>

          <aside className="rounded-xl border border-line bg-raised p-5">
            {mode === "idle" ? (
              selected ? (
                <>
                  <p className="text-sm font-semibold text-ink">{selected.name}</p>
                  <p className="mt-0.5 text-[13px] capitalize text-muted">{selected.type}</p>
                  {canManage && (
                    <button type="button" onClick={startEdit} className={`mt-5 ${secondaryClass}`}>
                      Edit this unit
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-muted">
                  {canManage
                    ? "Select a unit to rename it, change its type, or move it somewhere else."
                    : "Select a unit to see its details."}
                </p>
              )
            ) : (
              <form onSubmit={handleSubmit}>
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
          </aside>
        </div>
      )}
    </section>
  );
}
