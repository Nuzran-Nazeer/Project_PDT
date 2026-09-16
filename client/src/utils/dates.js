export const formatDate = (value) => {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// ⚠️ Sliced from the ISO string, never rebuilt from local date parts: UTC midnight reads
// as the previous evening in a timezone behind it.
export const toDateInput = (value) => (value ? String(value).slice(0, 10) : "");

// ⚠️ Clamped to the target month's last day: 31 August plus six months would roll into March.
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

// ⚠️ Local calendar, never `toISOString().slice(0, 10)`: before 05:30 in Colombo the
// UTC date is still yesterday.
export const todayInput = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

// ⚠️ The server stores an end as the first day not covered; HR reads and types a last day.
// Every end date crossing that boundary is converted here, and nowhere else. UTC throughout.
const shiftDays = (value, days) => {
  const [year, month, day] = String(value || "")
    .slice(0, 10)
    .split("-")
    .map(Number);
  if (!year || !month || !day) return "";

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

// Stored end to what HR reads. ⚠️ Never for a `from` or a `startDate`.
export const lastDayOf = (exclusiveEnd) => shiftDays(exclusiveEnd, -1);

// What HR typed to what the API stores.
export const dayAfter = (inclusiveLastDay) => shiftDays(inclusiveLastDay, 1);
