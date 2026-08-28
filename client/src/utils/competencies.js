// Kept out of the component file because exporting a
// component and a helper together breaks fast refresh.

export function competenciesFor(constants, jobFamily) {
  return constants?.competencies?.[jobFamily] || [];
}

export function competencyCount(constants, jobFamily) {
  return competenciesFor(constants, jobFamily).length;
}

// The team endpoint returns designation but not jobFamily, so a supervisor review could
// not resolve the reviewee's set. Reads the same mapping the server derives from.
// ⚠️ The tidier fix is the endpoint returning jobFamily; this helper goes then.
export function jobFamilyFor(constants, designation) {
  if (!designation) return undefined;
  const match = (constants?.designations || []).find((d) => d.name === designation);
  return match?.jobFamily;
}
