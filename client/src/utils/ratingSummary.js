// ⚠️ Counts only: a snippet of the evidence is the text somebody quotes back at its author.
export function summariseRatings(ratings = []) {
  const declined = ratings.filter((rating) => rating.notObserved).length;

  return [`${ratings.length - declined} rated`, declined && `${declined} not observed`]
    .filter(Boolean)
    .join(" · ");
}
