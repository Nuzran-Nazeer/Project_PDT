const AppError = require("./AppError");

// ⚠️ The convention is [from, to): `to` is the first day not covered, null while open. A
// move on 1 April has that date on both records, with no gap and no overlap.
// ⚠️ Dates are normalised to UTC midnight, or a record saved at 10:32 is not found for its day.
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

// HR supplies a last day, which becomes the first uncovered day. Date.UTC rolls the 31st over.
const dayAfter = (day) =>
  new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1));

const assertOrderedRange = (from, to) => {
  if (to && to.getTime() <= from.getTime()) {
    throw new AppError("The end date must be after the start date", 400);
  }
};

const activeOn = (day) => ({
  from: { $lte: day },
  $or: [{ to: null }, { to: { $gt: day } }],
});

// Two periods overlap when each starts before the other ends; a null end never ends.
const overlapping = (from, to) => {
  const clauses = [{ $or: [{ to: null }, { to: { $gt: from } }] }];
  if (to) clauses.push({ from: { $lt: to } });
  return { $and: clauses };
};

module.exports = { toDay, dayAfter, assertOrderedRange, activeOn, overlapping };
