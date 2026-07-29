// Within-session scheduling for the recall drill.
//
// The Leitner store in storage.js handles the *across-day* schedule (which box
// a word is in, what date it is next due). It has no concept of "later in this
// session", which is why a missed word used to vanish into a pool of 450 other
// due cards and effectively never come back. This module adds the two things
// that were missing:
//
//   1. A relearning queue. Answer "didn't know" and the word is re-served after
//      a few intervening cards, the way Anki's "again" step behaves.
//   2. A cohort. Only `cohortSize` words are in rotation at a time, taken in
//      curriculum order, so you consolidate a small set instead of being fed
//      all 484 at random. It grows only when you ask it to.

// How many other cards must pass before a missed word comes back. Small enough
// that you still remember being shown it, large enough not to be a giveaway.
const RELEARN_GAP = 3;

// A word is "learned" once it has survived into box 3, i.e. answered correctly
// often enough that its next review is days out rather than today.
export const GRADUATED_BOX = 3;

// Candidates in the data file's own order, which is curriculum order (TIB1-001,
// TIB1-002, … then the Ngöndro sources). Introducing words in this order beats
// introducing them at random for liturgy study.
export function orderedCandidates(data, activeSet) {
  return data.entries.filter(e => activeSet.has(e.id)).map(e => e.id);
}

export function createSession(drillType) {
  // [{ id, dueAt }] — dueAt is a card position, not a date.
  let relearn = [];
  let position = 0;
  let lastId = null;

  function cohortOf(ordered, cohortSize) {
    return ordered.slice(0, Math.max(1, cohortSize));
  }

  /**
   * @returns {{ id: string|null, reason: 'relearn'|'due'|null,
   *             cohort: string[], due: string[], learned: string[] }}
   *   id is null when nothing is due — the caller shows the "come back later
   *   or add more words" state rather than serving a card.
   */
  function next(data, activeSet, store, cohortSize) {
    const ordered = orderedCandidates(data, activeSet);
    const cohort = cohortOf(ordered, cohortSize);
    const inCohort = new Set(cohort);

    // Drop relearn entries that have fallen out of the cohort (filters changed).
    relearn = relearn.filter(r => inCohort.has(r.id));

    const due = cohort.filter(id => store.isDue(id, drillType));
    const learned = cohort.filter(id => store.get(id, drillType).box >= GRADUATED_BOX);
    const base = { cohort, due, learned };

    // 1. A missed word that has waited its gap outranks everything else.
    const ready = relearn.filter(r => r.dueAt <= position);
    if (ready.length > 0) {
      const pick = ready[0];
      relearn = relearn.filter(r => r !== pick);
      position += 1;
      lastId = pick.id;
      return { id: pick.id, reason: 'relearn', ...base };
    }

    if (due.length === 0) return { id: null, reason: null, ...base };

    // 2. Otherwise the least-practised due word, so new words in the cohort get
    //    introduced steadily and reviews cycle evenly. Ties broken at random.
    const pool = due.length > 1 ? due.filter(id => id !== lastId) : due;
    const candidates = pool.length > 0 ? pool : due;
    let best = Infinity;
    for (const id of candidates) best = Math.min(best, store.get(id, drillType).seen);
    const leastPractised = candidates.filter(id => store.get(id, drillType).seen === best);

    const id = leastPractised[Math.floor(Math.random() * leastPractised.length)];
    position += 1;
    lastId = id;
    return { id, reason: 'due', ...base };
  }

  function answer(id, wasCorrect, store, cohortLength) {
    store.answer(id, drillType, wasCorrect);
    if (wasCorrect) return;
    // Re-queue. With a tiny cohort there aren't RELEARN_GAP other cards to show,
    // so shrink the gap rather than stalling.
    const gap = Math.max(1, Math.min(RELEARN_GAP, (cohortLength || 1) - 1));
    relearn = relearn.filter(r => r.id !== id);
    relearn.push({ id, dueAt: position + gap });
  }

  function relearnCount() {
    return relearn.length;
  }

  return { next, answer, relearnCount };
}
