// One hue, light to dark, for an ordered scale. Dark mode has its own steps, lightest meaning most.
export const SEQUENTIAL = [
  "bg-[oklch(0.9_0.04_258)] dark:bg-[oklch(0.38_0.07_258)]",
  "bg-[oklch(0.78_0.08_258)] dark:bg-[oklch(0.5_0.09_258)]",
  "bg-[oklch(0.65_0.11_258)] dark:bg-[oklch(0.62_0.1_258)]",
  "bg-[oklch(0.52_0.12_258)] dark:bg-[oklch(0.74_0.09_258)]",
  "bg-[oklch(0.4_0.11_258)] dark:bg-[oklch(0.86_0.06_258)]",
];

export const percent = (count, total) => (total ? Math.round((count / total) * 100) : 0);
