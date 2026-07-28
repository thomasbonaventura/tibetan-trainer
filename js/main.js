import { loadData } from './data.js';
import { ProgressStore, loadFilters, saveFilters } from './storage.js';
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

  const ctx = {
    data,
    store,
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
  function renderFilters() {
    filterBody.innerHTML = '';

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
