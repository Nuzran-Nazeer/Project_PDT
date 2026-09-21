import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { createUnit, listUnits, updateUnit } from "../../services/orgUnits";
import { getMyCoverage } from "../../services/hrCoverage";
import { buildUnitSchema } from "../../schemas/orgUnitSchema";
import UnitTree from "../../components/org/UnitTree";
import UnitDetail from "../../components/org/UnitDetail";

// The tree is a navigation rail; the selected unit is the page.

const EMPTY = { name: "", type: "", parentUnitId: "" };

// So the parent picker can leave them out. The server refuses a unit inside its own sub-tree.
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
  const canAssign = user?.roles?.some((role) => ["hr", "head_of_hr"].includes(role));
  // An officer acts only inside the units they cover.
  const isOfficer = !canManage && Boolean(user?.roles?.includes("hr"));
  const [coveredIds, setCoveredIds] = useState(() => new Set());

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // `forUnit` records which unit was on screen when the form opened, so a change of
  // unit closes the form by deriving the mode rather than by an effect.
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

  // A failed read offers nothing; the server decides regardless.
  useEffect(() => {
    if (!isOfficer) return undefined;
    let cancelled = false;

    getMyCoverage()
      .then((data) => !cancelled && setCoveredIds(new Set(data.unitIds || [])))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOfficer]);

  // The selected unit lives in the URL, so it is linkable and survives a refresh.
  const selected = units.find((unit) => String(unit._id) === String(id)) || null;

  // Any change of unit closes the form, including by URL or the back button. Derived, not an effect.
  const mode = formState.forUnit === (id ?? null) ? formState.mode : "idle";

  const hasRoot = units.some((unit) => !unit.parentUnitId);

  const covers = (unit) => canManage || coveredIds.has(String(unit._id));
  const canCreate =
    canManage ||
    (isOfficer && units.some((unit) => unit.active !== false && covers(unit)));

  const parentOptions = useMemo(() => {
    // A discontinued unit is never offered as a parent: the server refuses it.
    const live = units.filter((unit) => unit.active !== false);

    if (isOfficer) return live.filter((unit) => coveredIds.has(String(unit._id)));
    if (mode !== "edit" || !selected) return live;

    const blocked = descendantsOf(units, selected._id);
    return live.filter(
      (unit) =>
        String(unit._id) !== String(selected._id) && !blocked.has(String(unit._id)),
    );
  }, [units, mode, selected, isOfficer, coveredIds]);

  const select = (unit) => navigate(`/organisation/${unit._id}`);

  const startCreate = () => {
    setFormState({ mode: "create", forUnit: id ?? null });
    // An officer can make nothing but a sub-unit, so the type is fixed.
    setForm(
      isOfficer
        ? {
            ...EMPTY,
            type: "sub-unit",
            parentUnitId: selected && covers(selected) ? String(selected._id) : "",
          }
        : EMPTY,
    );
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

    // Editing the root is the one case where a parent is optional.
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
      // Closed against the saved unit, so it stays closed once the URL catches up.
      setFormState({ mode: "idle", forUnit: String(saved._id) });
      navigate(`/organisation/${saved._id}`);
    } catch (err) {
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
              ? "The company as a tree of units."
              : isOfficer
                ? "The company as a tree of units. You can add sub-units inside the units you cover; only the Head of HR can change the rest."
                : "The company as a tree of units. Only the Head of HR can change it."}
          </p>
        </div>

        {canCreate && units.length > 0 && (
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
                  {/* Keyed by the unit so switching gives a fresh component. */}
                  <UnitDetail
                    key={selected._id}
                    unit={selected}
                    units={units}
                    canAssign={canAssign && covers(selected)}
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
                  {isOfficer ? (
                    <p id="type" className="text-sm text-ink">
                      sub-unit
                      <span className="block text-[13px] text-muted">
                        HR officers add sub-units only. The Head of HR creates units.
                      </span>
                    </p>
                  ) : (
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
                  )}
                  {fieldErrors.type && (
                    <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.type}</p>
                  )}
                </div>

                {/* Absent when the tree is empty: the first unit has nowhere to sit. */}
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
                          ? "Nothing, this is the top"
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
