export function competenciesFor(constants, jobFamily) {
  return constants?.competencies?.[jobFamily] || [];
}

export function competencyCount(constants, jobFamily) {
  return competenciesFor(constants, jobFamily).length;
}

// The team endpoint returns designation but not jobFamily; this reads the server's mapping.
export function jobFamilyFor(constants, designation) {
  if (!designation) return undefined;
  const match = (constants?.designations || []).find((d) => d.name === designation);
  return match?.jobFamily;
}
