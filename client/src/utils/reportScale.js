// The ordered scale reverses in dark mode; counts and labels carry the values too.
export const SEQUENTIAL = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export const percent = (count, total) => (total ? Math.round((count / total) * 100) : 0);
