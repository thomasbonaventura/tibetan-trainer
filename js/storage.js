// localStorage-backed progress (Leitner boxes, keyed by entry.id) and filters.
// Progress survives re-importing an updated data file because it never keys
// on array position — only on the permanent entry.id.

const PROGRESS_KEY = 'tibtrainer.progress.v1';
const FILTERS_KEY = 'tibtrainer.filters.v1';
const SETTINGS_KEY = 'tibtrainer.settings.v1';

// Days until next review, indexed by box (1-5). Box 0 = never seen.
const BOX_INTERVALS = [0, 0, 1, 3, 7, 14];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export class ProgressStore {
  constructor() {
    this.data = load(PROGRESS_KEY, {});
  }

  _record(entryId, drillType) {
    if (!this.data[entryId]) this.data[entryId] = {};
    if (!this.data[entryId][drillType]) {
      this.data[entryId][drillType] = { box: 0, due: todayStr(), seen: 0, correct: 0 };
    }
    return this.data[entryId][drillType];
  }

  get(entryId, drillType) {
    return this.data[entryId]?.[drillType] || { box: 0, due: todayStr(), seen: 0, correct: 0 };
  }

  isDue(entryId, drillType) {
    const rec = this.get(entryId, drillType);
    return rec.box === 0 || rec.due <= todayStr();
  }

  answer(entryId, drillType, wasCorrect) {
    const rec = this._record(entryId, drillType);
    rec.seen += 1;
    if (wasCorrect) {
      rec.correct += 1;
      rec.box = Math.min(rec.box + 1, 5);
    } else {
      rec.box = 1;
    }
    rec.due = addDays(todayStr(), BOX_INTERVALS[rec.box]);
    save(PROGRESS_KEY, this.data);
  }

  // Sort key for queue ordering: never-seen and overdue first.
  priority(entryId, drillType) {
    const rec = this.get(entryId, drillType);
    if (rec.box === 0) return -1; // new cards float to the front, but shuffled in by caller
    const daysOverdue = (new Date(todayStr()) - new Date(rec.due)) / 86400000;
    return -daysOverdue; // more overdue = more negative = earlier
  }

  stats(entryId, drillType) {
    return this.get(entryId, drillType);
  }
}

export function loadFilters(defaults) {
  return load(FILTERS_KEY, defaults);
}

export function saveFilters(filters) {
  save(FILTERS_KEY, filters);
}

// Recall session shape. cohortSize is the "x" words in rotation; expandStep is
// the "y" added each time you ask for more. cohortSize is both editable here
// and incremented by the "add more words" button, so there is only ever one
// number describing how much is in play.
export const DEFAULT_SETTINGS = {
  recallCohortSize: 10,
  recallExpandStep: 5,
};

export function loadSettings() {
  const stored = load(SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings) {
  save(SETTINGS_KEY, settings);
}

export { todayStr };
