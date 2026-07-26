export function defaultFilters(data) {
  return {
    excludeUnverified: false,
    sources: Object.fromEntries(data.sourceCodes.map(c => [c, true])),
    dates: Object.fromEntries(data.dateLearnedValues.map(d => [d, true])),
  };
}

// Backfill filter state when the data file gains a new source/date that the
// stored filters (from before that source existed) don't know about yet.
export function reconcileFilters(filters, data) {
  for (const c of data.sourceCodes) {
    if (!(c in filters.sources)) filters.sources[c] = true;
  }
  for (const d of data.dateLearnedValues) {
    if (!(d in filters.dates)) filters.dates[d] = true;
  }
  return filters;
}

export function entryPasses(entry, filters) {
  if (filters.excludeUnverified && !entry.pronunciationVerified) return false;
  if (filters.sources[entry.sourceCode] === false) return false;
  if (filters.dates[entry.dateLearned] === false) return false;
  return true;
}

export function activeEntrySet(data, filters) {
  const set = new Set();
  for (const e of data.entries) {
    if (entryPasses(e, filters)) set.add(e.id);
  }
  return set;
}
