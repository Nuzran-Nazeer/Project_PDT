const AppError = require("./AppError");

// Every relationship that changes over time is stored here as a PERIOD, and every
// rule in this system asks the same question of it: "was this true on date D?".
// Both halves of that answer live in this one file, so the four dated collections
// cannot drift into three different interpretations of the same dates.
//
// ---------------------------------------------------------------------------
// THE CONVENTION: [from, to)
// ---------------------------------------------------------------------------
// `from` is the first day the record covers.
// `to`   is the first day it does NOT cover.
// `to: null` means the record is still open.
//
// So someone who moves unit on 1 April gets `to: 2026-04-01` on the old record and
// `from: 2026-04-01` on the new one. THE SAME DATE, written twice — which is the
// point: there is no day-before arithmetic to get wrong, no gap between the two
// records, and no day on which both are true.
//
// The alternative, an inclusive `to` of 31 March, forces every close to compute
// "the day before" — and that computation is wrong at every month end, every leap
// year, and every daylight-saving boundary.
//
// ⚠️ NOT SPECIFIED BY THE DESIGN DOCUMENTS. The system spec says only that `to` is
// null for the current record; it never says which side of the boundary `to` sits
// on. Chosen here on 2026-08-25, flagged to Nuzran, and confined to this file so it
// is one change if overruled. HR never sees it: a screen showing a last day shows
// `to` minus one day.
//
// ---------------------------------------------------------------------------
// Dates are normalised to UTC midnight
// ---------------------------------------------------------------------------
// HR enters days, not moments. Left unnormalised, a membership saved at 10:32 would
// not be found by a query asking about that same day at 00:00, and the failure would
// look like missing data rather than a time-of-day bug.
const toDay = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    throw new AppError(`${fieldName} is required`, 400);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${fieldName} is not a valid date`, 400);
  }
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
};

// A period must cover at least one day. `to` equal to `from` covers none, which is a
// record that is true on no date at all -- always a mistake, never a useful history.
const assertOrderedRange = (from, to) => {
  if (to && to.getTime() <= from.getTime()) {
    throw new AppError("The end date must be after the start date", 400);
  }
};

// Records true on the given day. This is the ONLY way to ask "as at" -- criterion 2
// of the dated-history story, and the foundation the reporting line is built on.
const activeOn = (day) => ({
  from: { $lte: day },
  $or: [{ to: null }, { to: { $gt: day } }],
});

// Records whose period overlaps [from, to). Two periods overlap when each starts
// before the other ends; a null end reads as "no end", so that half is always true.
const overlapping = (from, to) => {
  const clauses = [{ $or: [{ to: null }, { to: { $gt: from } }] }];
  if (to) clauses.push({ from: { $lt: to } });
  return { $and: clauses };
};

module.exports = { toDay, assertOrderedRange, activeOn, overlapping };
