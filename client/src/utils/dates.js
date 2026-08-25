// The server stores dates and sends them back as full ISO timestamps. Two shapes
// are needed from that: something a person reads, and something an <input
// type="date"> accepts, which is only ever YYYY-MM-DD.

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

// Sliced from the ISO string rather than rebuilt from the local date parts. A date
// stored as midnight UTC reads as the previous evening in a timezone behind it, and
// rebuilding from local parts would quietly move a joined date by a day — which
// decides someone's appraisal group.
export const toDateInput = (value) => (value ? String(value).slice(0, 10) : "");

// Add whole months to a YYYY-MM-DD string, clamping to the end of the target month.
//
// The clamp is the whole reason this is not a one-liner. 31 August plus six months is
// 31 February, which JavaScript silently rolls forward into March, so a probation end
// date would land in the wrong month for anyone who joined on the 29th, 30th or 31st.
// Everything is done in UTC because these are date-only strings and pulling them
// through a local timezone can shift the day.
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

// Today as YYYY-MM-DD in the LOCAL calendar, for prefilling a date input and for
// asking the server about "as things stand today".
//
// Deliberately NOT `new Date().toISOString().slice(0, 10)`, which is today in UTC.
// Colombo is UTC+5:30, so between midnight and half past five in the morning the UTC
// date is still yesterday, and every prefilled "today" in the app would be a day
// behind. This was caught by a test run at 06:00 local, where a membership opened
// "today" was dated the 25th on a machine reading the 26th.
//
// Note this is the opposite choice from toDateInput above, and both are right: that
// one reads back a date the server STORED at UTC midnight, where slicing the ISO
// string is what avoids shifting it. This one produces a NEW calendar date from the
// clock in front of the person typing.
export const todayInput = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
