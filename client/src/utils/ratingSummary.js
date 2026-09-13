// ⚠️ Counts only. A snippet of the evidence here is the same text in two places, and the
// shorter copy is the one somebody quotes back at the person who wrote it.
export function summariseRatings(ratings = []) {
  const declined = ratings.filter((rating) => rating.notObserved).length;

  return [`${ratings.length - declined} rated`, declined && `${declined} not observed`]
    .filter(Boolean)
    .join(" · ");
}
