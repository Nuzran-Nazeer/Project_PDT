import { useEffect, useState } from "react";
import {
  listMemberships,
  openMembership,
  transferMembership,
} from "../../services/memberships";
import { listUnits } from "../../services/orgUnits";
import { moveSchema } from "../../schemas/orgStructureSchema";
import { formatDate, toDateInput, todayInput } from "../../utils/dates";


// Local calendar date, not UTC. See the note on todayInput.
const today = todayInput;

export default function UnitHistoryPanel({ person, canAssign }) {
  const userId = String(person._id);

  const [records, setRecords] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [moving, setMoving] = useState(false);
  const [form, setForm] = useState({ unitId: "", from: today() });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // No setLoading(true) in the effect body: the lint rule rejects the second render
  // pass. Mounted with a `key` of the person's id, so a different employee gives a
  // fresh component with `loading` already true.
  useEffect(() => {
    let cancelled = false;

    Promise.all([listMemberships({ userId }), listUnits()])
      .then(([history, unitList]) => {
        if (cancelled) return;
        setError("");
        setRecords(history.items || []);
        setUnits(unitList.items || []);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  // At most one is open: the server refuses any membership overlapping another.
  const current = records.find((record) => !record.to) || null;
  const past = records.filter((record) => record.to);

  // Discontinued and current units are both left out: the server refuses either, and
  // offering them invites the mistake.
  const destinations = units.filter(
    (unit) =>
      unit.active !== false && String(unit._id) !== String(current?.unitId?._id || ""),
  );

  const startMove = () => {
    setMoving(true);
    // A first placement defaults to the joining date, not today, which would quietly
    // lose the months before it.
    setForm({
      unitId: "",
      from: current ? today() : toDateInput(person.joinedDate) || today(),
    });
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

    try {
      await moveSchema.validate(form, { abortEarly: false });
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (!errors[err.path]) errors[err.path] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    const payload = { userId, unitId: form.unitId, from: form.from };

    setSaving(true);
    try {
      // A move must close and open in ONE call, or a half-success leaves someone in
      // no unit or in two.
      if (current) {
        await transferMembership(payload);
      } else {
        await openMembership(payload);
      }
      setMoving(false);
      setReloadKey((key) => key + 1);
    } catch (err) {
      // The server's own words, never reworded.
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink";

  return (
    <div className="mt-8 rounded-xl border border-line bg-raised p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-ink">Unit</h2>
        {canAssign && !moving && !loading && (
          <button
            type="button"
            onClick={startMove}
            className="ml-auto cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {current ? "Move to another unit" : "Place in a unit"}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : (
        <>
          {current ? (
            <p className="mt-3 text-sm text-ink">
              {current.unitId?.name || "Unknown unit"}
              <span className="text-muted"> · since {formatDate(current.from)}</span>
            </p>
          ) : (
            // A real state, not a gap: someone in no unit is not appraised.
            <p className="mt-3 text-sm text-muted">
              Not in a unit. Nobody supervises this person and they are not appraised
              until they are placed in one.
            </p>
          )}

          {moving && (
            <form
              onSubmit={handleSubmit}
              className="mt-4 rounded-xl border border-line bg-surface p-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="unitId" className={labelClass}>
                    {current ? "Move to" : "Place in"}
                  </label>
                  <select
                    id="unitId"
                    name="unitId"
                    value={form.unitId}
                    onChange={handleChange}
                    aria-invalid={Boolean(fieldErrors.unitId)}
                    className={inputClass}
                  >
                    <option value="">Choose…</option>
                    {destinations.map((unit) => (
                      <option key={unit._id} value={unit._id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.unitId && (
                    <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.unitId}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="from" className={labelClass}>
                    Takes effect
                  </label>
                  <input
                    id="from"
                    name="from"
                    type="date"
                    value={form.from}
                    onChange={handleChange}
                    aria-invalid={Boolean(fieldErrors.from)}
                    className={inputClass}
                  />
                  {fieldErrors.from && (
                    <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.from}</p>
                  )}
                </div>
              </div>

              {current && (
                <p className="mt-3 text-[13px] text-muted">
                  The stint in {current.unitId?.name || "the current unit"} ends on that
                  date and the new one begins the same day, so there is no gap and no
                  overlap.
                </p>
              )}

              {formError && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
                >
                  {formError}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : current ? "Move" : "Place"}
                </button>
                <button
                  type="button"
                  onClick={() => setMoving(false)}
                  className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {past.length > 0 && (
            <div className="mt-5">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                Before that
              </h3>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {past.map((record) => (
                  <li
                    key={record._id}
                    className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5"
                  >
                    <span className="text-sm text-ink">
                      {record.unitId?.name || "Unknown unit"}
                    </span>
                    <span className="ml-auto text-[13px] text-muted">
                      {formatDate(record.from)} to {formatDate(record.to)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
