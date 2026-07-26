// Shared "what's next" logic for all three drills. Cards that are new or
// overdue (per the Leitner store) are pulled first; once nothing is due,
// falls back to a random not-yet-due card so the drill never dead-ends.

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickNext(candidateIds, store, drillType, avoidId) {
  if (candidateIds.length === 0) return null;
  const due = candidateIds.filter(id => store.isDue(id, drillType));
  const pool = due.length > 0 ? due : candidateIds;
  const filtered = pool.length > 1 ? pool.filter(id => id !== avoidId) : pool;
  const finalPool = filtered.length > 0 ? filtered : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

export function dueCount(candidateIds, store, drillType) {
  return candidateIds.filter(id => store.isDue(id, drillType)).length;
}
