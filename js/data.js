// Loads tibetan_trainer_data.json and builds convenient indices.
// Re-importing an updated export just means replacing that JSON file; nothing
// here caches a transformed copy, so old data can never mask new data.

export async function loadData() {
  const res = await fetch('tibetan_trainer_data.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Failed to load vocabulary data: ' + res.status);
  const raw = await res.json();

  const entriesById = new Map(raw.entries.map(e => [e.id, e]));
  const groupsById = new Map(raw.falseFriendGroups.map(g => [g.groupId, g]));

  // Cloze cards grouped by entryId (an entry may have zero, one, or more).
  const clozeByEntryId = new Map();
  for (const c of raw.clozeCards) {
    if (!clozeByEntryId.has(c.entryId)) clozeByEntryId.set(c.entryId, []);
    clozeByEntryId.get(c.entryId).push(c);
  }

  const sourceCodes = [...new Set(raw.entries.map(e => e.sourceCode))];
  const dateLearnedValues = [...new Set(raw.entries.map(e => e.dateLearned))]
    .sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    });

  return {
    meta: raw.meta,
    entries: raw.entries,
    entriesById,
    groups: raw.falseFriendGroups,
    groupsById,
    clozeCards: raw.clozeCards,
    clozeByEntryId,
    sourceCodes,
    sourceNames: Object.fromEntries((raw.meta.sources || []).map(s => [s.code, s.name])),
    dateLearnedValues,
  };
}
