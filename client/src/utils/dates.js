// The server sends full ISO timestamps. Two shapes are needed from that: something a
// person reads, and something an <input type="date"> accepts, which is only ever
// YYYY-MM-DD.

export const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Sliced from the ISO string, never rebuilt from local date parts. A date stored as
// midnight UTC reads as the previous evening in a timezone behind it, so rebuilding
// would move a joined date by a day, which decides someone's appraisal group.
export const toDateInput = (value) => (value ? String(value).slice(0, 10) : "");

// The clamp is the whole reason this is not a one-liner. 31 August plus six months is
// 31 February, which JavaScript silently rolls forward into March, putting a probation
// end date in the wrong month for anyone who joined on the 29th, 30th or 31st. UTC
// throughout, because pulling a date-only string through a local timezone shifts it.
export const addMonths = (isoDate, months) => {
  const [year, month, day] = String(isoDate || "")
    .slice(0, 10)
    .split("-")
    .map(Number);
  if (!year || !month || !day) return "";

  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDayOfTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDayOfTarget));
  return target.toISOString().slice(0, 10);
};

// Today in the LOCAL calendar, deliberately not `toISOString().slice(0, 10)`, which is
// today in UTC. Colombo is UTC+5:30, so before 05:30 the UTC date is still yesterday
// and every prefilled "today" would be a day behind.
//
// This is the opposite choice from toDateInput above and both are right: that one
// reads back a date the server stored at UTC midnight, this one makes a new calendar
// date from the clock in front of the person typing.
export const todayInput = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
