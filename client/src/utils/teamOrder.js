// Earliest-starting running cycle first, then no cycle, then by name. Nobody is hidden: a
// supervisor who cannot find someone assumes they have left the team.
const startOf = (person) =>
  person.cycle ? new Date(person.cycle.startDate).getTime() : Infinity;

export const byRunningCycle = (people) =>
  [...people].sort((a, b) => startOf(a) - startOf(b) || a.name.localeCompare(b.name));
