const AppError = require("./AppError");

// ⚠️ THE CONVENTION IS [from, to). `from` is the first day covered, `to` the first day
// NOT covered, `to: null` still open. Someone moving on 1 April gets `to: 2026-04-01`
// on the old record and `from: 2026-04-01` on the new one: the same date twice, so
// there is no gap and no day on which both are true. An inclusive `to` would force
// every close to compute "the day before", wrong at every month end and leap year.
//
// Not specified by the design documents; confined to this file so it is one change if
// overruled. HR sees a last day, which is `to` minus one.
//
// ⚠️ Dates are normalised to UTC midnight. Unnormalised, a membership saved at 10:32
// is not found by a query asking about that day, and it looks like missing data.
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

// Closing is the one case needing arithmetic: HR supplies a LAST day, which becomes
// the first uncovered day. Date.UTC normalises out-of-range values, so the 31st
// becomes the 1st of the next month with no special case. The only day-arithmetic in
// the codebase, kept here so it is not reinvented slightly wrong elsewhere.
const dayAfter = (day) =>
  new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1),
  );

// `to` equal to `from` covers no days, so the record is true on no date.
const assertOrderedRange = (from, to) => {
  if (to && to.getTime() <= from.getTime()) {
    throw new AppError("The end date must be after the start date", 400);
  }
};

// The only way to ask "as at".
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

module.exports = { toDay, dayAfter, assertOrderedRange, activeOn, overlapping };
