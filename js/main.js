import { loadData } from './data.js';
import { ProgressStore, loadFilters, saveFilters, loadSettings, saveSettings } from './storage.js';
import { defaultFilters, reconcileFilters, activeEntrySet } from './filters.js';
import { createDiscriminationDrill } from './drills/discrimination.js';
import { createClozeDrill } from './drills/cloze.js';
import { createRecallDrill } from './drills/recall.js';
import { createLookupView } from './lookup.js';

const drillArea = document.getElementById('drill-area');
const modeTitle = document.getElementById('mode-title');
const dueCountEl = document.getElementById('due-count');
const tabs = [...document.querySelectorAll('.tab')];
const filterBtn = document.getElementById('filter-btn');
const filterClose = document.getElementById('filter-close');
const filterSheet = document.getElementById('filter-sheet');
const filterBody = document.getElementById('filter-body');
const backdrop = document.getElementById('sheet-backdrop');

const MODE_TITLES = {
  discrimination: 'Discriminate',
  cloze: 'Cloze',
  recall: 'Recall',
  lookup: 'Look up',
};

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    drillArea.innerHTML = '<div class="empty-state">Could not load vocabulary data.<br>' + err.message + '</div>';
    return;
  }

  const store = new ProgressStore();
  let filters = reconcileFilters(loadFilters(defaultFilters(data)), data);
  saveFilters(filters);
  const settings = loadSettings();

  const ctx = {
    data,
    store,
    settings,
    persistSettings: () => saveSettings(settings),
    getActiveSet: () => activeEntrySet(data, filters),
    container: drillArea,
    setDueCount: (n) => { dueCountEl.textContent = n > 0 ? String(n) : ''; },
  };

  const drills = {
    discrimination: createDiscriminationDrill(ctx),
    cloze: createClozeDrill(ctx),
    recall: createRecallDrill(ctx),
    lookup: createLookupView(ctx),
  };

  let currentMode = 'discrimination';

  function showMode(mode) {
    currentMode = mode;
    modeTitle.textContent = MODE_TITLES[mode];
    for (const t of tabs) t.classList.toggle('active', t.dataset.mode === mode);
    const drill = drills[mode];
    if (drill) {
      drill.render();
    } else {
      drillArea.innerHTML = '<div class="empty-state">Coming soon.</div>';
      dueCountEl.textContent = '';
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => showMode(tab.dataset.mode));
  }

  const initialMode = location.hash.slice(1);
  showMode(drills[initialMode] ? initialMode : 'discrimination');

  // ---------- Filters ----------
  // A number row with −/+ steppers. Used for the recall cohort settings.
  function stepperRow(label, help, getValue, setValue, min, max) {
    const wrap = document.createElement('div');
    wrap.className = 'stepper-row';

    const text = document.createElement('div');
    text.className = 'stepper-text';
    const title = document.createElement('div');
    title.textContent = label;
    text.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'stepper-help';
    sub.textContent = help;
    text.appendChild(sub);
    wrap.appendChild(text);

    const ctrl = document.createElement('div');
    ctrl.className = 'stepper';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'stepper-btn';
    minus.textContent = '−';
    minus.setAttribute('aria-label', 'Decrease ' + label);
    const value = document.createElement('span');
    value.className = 'stepper-value';
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'stepper-btn';
    plus.textContent = '+';
    plus.setAttribute('aria-label', 'Increase ' + label);

    const sync = () => {
      const v = getValue();
      value.textContent = String(v);
      minus.disabled = v <= min();
      plus.disabled = v >= max();
    };
    const bump = (delta) => {
      const v = Math.max(min(), Math.min(max(), getValue() + delta));
      setValue(v);
      saveSettings(settings);
      sync();
      showMode(currentMode);
    };
    minus.addEventListener('click', () => bump(-1));
    plus.addEventListener('click', () => bump(1));

    ctrl.append(minus, value, plus);
    wrap.appendChild(ctrl);
    sync();
    return wrap;
  }

  function renderFilters() {
    filterBody.innerHTML = '';

    // Recall session sizing
    const g0 = document.createElement('div');
    g0.className = 'filter-group';
    g0.innerHTML = '<h3>Recall session</h3>';
    const totalAvailable = () => activeEntrySet(data, filters).size;
    g0.appendChild(stepperRow(
      'Words in rotation',
      'Only this many words are drilled at a time.',
      () => settings.recallCohortSize,
      (v) => { settings.recallCohortSize = v; },
      () => 1,
      () => Math.max(1, totalAvailable()),
    ));
    g0.appendChild(stepperRow(
      'Add this many at a time',
      'How many new words the “add more” button brings in.',
      () => settings.recallExpandStep,
      (v) => { settings.recallExpandStep = v; },
      () => 1,
      () => 50,
    ));
    filterBody.appendChild(g0);

    // Unverified toggle
    const g1 = document.createElement('div');
    g1.className = 'filter-group';
    g1.innerHTML = '<h3>Pronunciation</h3>';
    const row = document.createElement('label');
    row.className = 'filter-row';
    row.innerHTML = `
      <span>Exclude unverified pronunciation (${data.meta.unverifiedPronunciationCount})</span>
      <span class="switch">
        <input type="checkbox" id="f-unverified">
        <span class="track"></span><span class="thumb"></span>
      </span>`;
    g1.appendChild(row);
    filterBody.appendChild(g1);
    const unvCheckbox = row.querySelector('#f-unverified');
    unvCheckbox.checked = filters.excludeUnverified;
    unvCheckbox.addEventListener('change', () => {
      filters.excludeUnverified = unvCheckbox.checked;
      persistAndRefresh();
    });

    // Sources
    const g2 = document.createElement('div');
    g2.className = 'filter-group';
    g2.innerHTML = '<h3>Sources</h3>';
    for (const code of data.sourceCodes) {
      const count = data.entries.filter(e => e.sourceCode === code).length;
      const name = data.sourceNames[code] || code;
      const r = document.createElement('label');
      r.className = 'checkbox-row';
      r.innerHTML = `<input type="checkbox" data-source="${code}"> <span>${name}</span> <span class="count">(${count})</span>`;
      const cb = r.querySelector('input');
      cb.checked = filters.sources[code] !== false;
      cb.addEventListener('change', () => {
        filters.sources[code] = cb.checked;
        persistAndRefresh();
      });
      g2.appendChild(r);
    }
    filterBody.appendChild(g2);

    // Date learned
    const g3 = document.createElement('div');
    g3.className = 'filter-group';
    g3.innerHTML = '<h3>Date learned</h3>';
    for (const d of data.dateLearnedValues) {
      const count = data.entries.filter(e => e.dateLearned === d).length;
      const label = d === null ? 'No date (contrast entries)' : d;
      const r = document.createElement('label');
      r.className = 'checkbox-row';
      r.innerHTML = `<input type="checkbox" data-date="${d}"> <span>${label}</span> <span class="count">(${count})</span>`;
      const cb = r.querySelector('input');
      cb.checked = filters.dates[d] !== false;
      cb.addEventListener('change', () => {
        filters.dates[d] = cb.checked;
        persistAndRefresh();
      });
      g3.appendChild(r);
    }
    filterBody.appendChild(g3);

    // About — credits and licence. Content lives in meta.attribution, which the
    // importer copies from tools/attribution.json, so adding a source is a data
    // edit rather than a code change.
    const about = data.meta.attribution;
    if (about) {
      const g4 = document.createElement('div');
      g4.className = 'filter-group';
      g4.innerHTML = '<h3>About</h3>';

      const wrap = document.createElement('div');
      wrap.className = 'about-block';

      if (about.compiledBy) {
        const lead = document.createElement('p');
        lead.className = 'about-lead';
        lead.textContent = about.compiledBy;
        wrap.appendChild(lead);
      }

      if (about.sources && about.sources.length) {
        const ol = document.createElement('ol');
        ol.className = 'about-sources';
        for (const s of about.sources) {
          const li = document.createElement('li');
          li.textContent = s;
          ol.appendChild(li);
        }
        wrap.appendChild(ol);
      }

      if (about.notice) {
        const notice = document.createElement('p');
        notice.className = 'about-notice';
        notice.textContent = about.notice;
        wrap.appendChild(notice);
      }

      // An invitation rather than a disclaimer, so it reads a shade warmer than
      // the notice above it.
      if (about.corrections) {
        const corrections = document.createElement('p');
        corrections.className = 'about-corrections';
        corrections.textContent = about.corrections;
        wrap.appendChild(corrections);
      }

      g4.appendChild(wrap);
      filterBody.appendChild(g4);
    }

    const reset = document.createElement('button');
    reset.className = 'reset-link';
    reset.textContent = 'Reset filters';
    reset.addEventListener('click', () => {
      filters = defaultFilters(data);
      persistAndRefresh();
      renderFilters();
    });
    filterBody.appendChild(reset);
  }

  function persistAndRefresh() {
    saveFilters(filters);
    showMode(currentMode);
  }

  function openSheet() {
    renderFilters();
    filterSheet.classList.remove('hidden');
    backdrop.classList.remove('hidden');
  }
  function closeSheet() {
    filterSheet.classList.add('hidden');
    backdrop.classList.add('hidden');
  }

  filterBtn.addEventListener('click', openSheet);
  filterClose.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
}

main();
