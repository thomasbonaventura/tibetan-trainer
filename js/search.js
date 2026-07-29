// Matching logic for the Look up mode. No DOM here.
//
// Three query languages fail in three different ways, so there are three
// normalizers rather than one:
//   - romanization/Wylie: hyphenation and spacing are arbitrary, strip them
//   - English: keep word boundaries, or "arm" matches "karma"
//   - Tibetan: the tsheg is a separator, not part of the syllable

const TIBETAN_RE = /[ༀ-࿿]/;

// É Ö Ü are the only diacritics in the romanization column; decomposing and
// dropping the combining marks folds all three to their bare letters, which is
// what lets "cho", "chö" and "CHÖ" all find ཆོས་.
function stripMarks(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// "SÖL-WA DEP-PA" and "solwa depa" both fold to "solwadeppa".
export function foldTight(s) {
  return stripMarks((s || '').toLowerCase()).replace(/[^a-z0-9]+/g, '');
}

export function foldLoose(s) {
  return stripMarks((s || '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
}

// Whitespace, tsheg (U+0F0B) and shad (U+0F0D) all go, so a typed "སེམས"
// prefix-matches the stored "སེམས་ཅན་".
export function foldTibetan(s) {
  return (s || '').replace(/[\s་།༎]+/g, '');
}

export function isTibetan(s) {
  return TIBETAN_RE.test(s || '');
}

// Related/false-friend items carry a bare {tibetan, english} with no id, and
// some smuggle a gloss into the Tibetan field: "དམ་པའི་ཆོས་ (holy Dharma)".
// Keep only the leading run of Tibetan codepoints and separators.
export function tibetanHead(s) {
  const m = (s || '').match(/^[\sༀ-࿿]+/);
  return (m ? m[0] : s || '').trim();
}

const MIN_LATIN = 2;
const MIN_TIBETAN = 1;

// Score tiers. Headword hits beat body hits by a wide enough margin that no
// number of weak matches can outrank an exact one.
const EXACT = 100;
const PREFIX = 80;
const SUBSTRING = 60;
const BODY = 40;
const EXAMPLE = 20;

export function buildSearchIndex(data) {
  const byTibetan = new Map();
  const records = data.entries.map((entry) => {
    const tib = foldTibetan(entry.tibetan);
    if (tib && !byTibetan.has(tib)) byTibetan.set(tib, entry.id);
    const ex = entry.example;
    return {
      entry,
      tib,
      rom: foldTight(entry.romanization),
      wylie: foldTight(entry.wylie),
      english: foldLoose(entry.english),
      senses: (entry.senses || []).map(foldLoose),
      sanskrit: foldLoose(entry.sanskrit),
      notes: foldLoose(entry.notes),
      exTib: ex ? foldTibetan(ex.tibetan) : '',
      exEng: ex ? foldLoose(ex.english) : '',
    };
  });
  return { records, byTibetan };
}

// True when `needle` starts any whitespace-delimited word of `hay`, so that
// "sentient" hits "sentient being(s)" but "arm" does not hit "karma".
function wordPrefix(hay, needle) {
  if (!hay || !needle) return false;
  if (hay.startsWith(needle)) return true;
  return hay.includes(' ' + needle);
}

function scoreTibetan(rec, q) {
  if (!rec.tib) return 0;
  if (rec.tib === q) return EXACT;
  if (rec.tib.startsWith(q)) return PREFIX;
  if (rec.tib.includes(q)) return SUBSTRING;
  if (rec.exTib && rec.exTib.includes(q)) return EXAMPLE;
  return 0;
}

function scoreLatin(rec, tight, loose) {
  if (rec.rom === tight || rec.english === loose || rec.senses.includes(loose)) return EXACT;
  if (rec.rom.startsWith(tight) || rec.wylie.startsWith(tight)) return PREFIX;
  if (wordPrefix(rec.english, loose) || rec.senses.some(s => wordPrefix(s, loose))) return PREFIX;
  if (rec.rom.includes(tight) || rec.wylie.includes(tight)) return SUBSTRING;
  // English is matched at word boundaries only, never mid-word: glosses are
  // short, and a substring pass turns "arm" into a list of every "karma".
  if (wordPrefix(rec.sanskrit, loose) || wordPrefix(rec.notes, loose)) return BODY;
  if (rec.exEng.includes(loose)) return EXAMPLE;
  return 0;
}

/**
 * @param {object} [opts]
 * @param {(entry: object) => boolean} [opts.filter]  narrows the searched set,
 *   applied before the result cap so `total` reflects the scope
 * @returns {{ tooShort: boolean, hits: Array<{entry, score}>, total: number }}
 *   `hits` is capped at `limit`; `total` is how many matched before capping.
 */
export function searchEntries(index, query, limit = 50, opts = {}) {
  const raw = (query || '').trim();
  const tibetanQuery = isTibetan(raw);
  const records = opts.filter ? index.records.filter(r => opts.filter(r.entry)) : index.records;

  if (tibetanQuery) {
    const q = foldTibetan(raw);
    if (q.length < MIN_TIBETAN) return { tooShort: true, hits: [], total: 0 };
    return rank(records, rec => scoreTibetan(rec, q), limit);
  }

  const tight = foldTight(raw);
  const loose = foldLoose(raw);
  if (!tight) return { tooShort: true, hits: [], total: 0 };

  if (tight.length < MIN_LATIN) {
    // Two entries are romanized as a single letter (Ö, Ü) and would otherwise
    // be unreachable by their own pronunciation. Let an exact match through,
    // but nothing weaker, so a stray "a" still doesn't list half the deck.
    const exact = rank(records, rec => scoreLatin(rec, tight, loose) === EXACT ? EXACT : 0, limit);
    return exact.total > 0 ? exact : { tooShort: true, hits: [], total: 0 };
  }
  return rank(records, rec => scoreLatin(rec, tight, loose), limit);
}

function rank(records, scoreOf, limit) {
  const hits = [];
  for (const rec of records) {
    const score = scoreOf(rec);
    if (score > 0) hits.push({ entry: rec.entry, score });
  }
  // Stable ordering: strongest match, then shortest headword (the plain word
  // before its compounds), then alphabetically so the list never reshuffles.
  hits.sort((a, b) =>
    b.score - a.score ||
    a.entry.tibetan.length - b.entry.tibetan.length ||
    a.entry.romanization.localeCompare(b.entry.romanization) ||
    a.entry.id.localeCompare(b.entry.id)
  );
  return { tooShort: false, hits: hits.slice(0, limit), total: hits.length };
}
