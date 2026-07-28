// Look up — dictionary search over every entry, in English, Tibetan script or
// romanized pronunciation. Deliberately ignores the Filters sheet: those narrow
// what you *drill*, and a lookup should never hide a word you know exists.

import { buildSearchIndex, searchEntries } from './search.js';
import { renderEntryDetail } from './entry-view.js';

const RESULT_LIMIT = 50;

export function createLookupView(ctx) {
  let index = null;
  let query = '';
  let expandedId = null;
  let autoExpandSingle = false;

  // Rebuilt by render(); held here so the input handler can reach them without
  // re-querying the DOM.
  let inputEl = null;
  let resultsEl = null;
  // The one expanded entry: { id, row, detail }, or null.
  let openRefs = null;

  function render() {
    // Built lazily on first use — 484 entries, so the cost is a rounding error,
    // but there is no reason to pay it for someone who never opens this tab.
    if (!index) index = buildSearchIndex(ctx.data);
    ctx.setDueCount(0);

    const container = ctx.container;
    container.innerHTML = '';

    const row = document.createElement('div');
    row.className = 'search-row';

    inputEl = document.createElement('input');
    inputEl.type = 'search';
    inputEl.className = 'search-input';
    inputEl.placeholder = 'English, Tibetan, or pronunciation';
    inputEl.setAttribute('aria-label', 'Search the dictionary');
    inputEl.autocapitalize = 'none';
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;
    inputEl.enterKeyHint = 'search';
    inputEl.value = query;
    row.appendChild(inputEl);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'search-clear';
    clearBtn.type = 'button';
    clearBtn.setAttribute('aria-label', 'Clear search');
    clearBtn.textContent = '✕';
    row.appendChild(clearBtn);

    resultsEl = document.createElement('div');
    resultsEl.className = 'results';

    container.append(row, resultsEl);

    // Only the results are rebuilt per keystroke. Re-creating the input — what
    // every drill does on re-render — would drop focus and dismiss the iOS
    // keyboard mid-word.
    inputEl.addEventListener('input', () => {
      query = inputEl.value;
      expandedId = null;
      syncClear();
      renderResults();
    });

    clearBtn.addEventListener('click', () => {
      query = '';
      expandedId = null;
      inputEl.value = '';
      syncClear();
      renderResults();
      inputEl.focus();
    });

    syncClear();
    renderResults();

    function syncClear() {
      clearBtn.classList.toggle('hidden', query.length === 0);
    }
  }

  // Jump to a related word / false friend: reuse the search itself rather than
  // building a navigation stack. A chip resolves to a single entry, so open it
  // straight away instead of leaving a one-row list to tap again.
  function navigateTo(tibetan) {
    query = tibetan;
    inputEl.value = tibetan;
    expandedId = null;
    autoExpandSingle = true;
    renderResults();
    ctx.container.scrollTop = 0;
  }

  function renderResults() {
    resultsEl.innerHTML = '';
    openRefs = null;

    const single = autoExpandSingle;
    autoExpandSingle = false;

    if (!query.trim()) {
      resultsEl.appendChild(hint('Search the dictionary in English, Tibetan script, or romanized pronunciation.'));
      return;
    }

    const { tooShort, hits, total } = searchEntries(index, query, RESULT_LIMIT);

    if (tooShort) {
      resultsEl.appendChild(hint('Keep typing…'));
      return;
    }
    if (hits.length === 0) {
      const none = document.createElement('div');
      none.className = 'empty-state';
      none.textContent = 'No matches for “' + query.trim() + '”.';
      resultsEl.appendChild(none);
      return;
    }

    if (single && hits.length === 1) expandedId = hits[0].entry.id;

    for (const { entry } of hits) resultsEl.appendChild(resultItem(entry));

    if (total > hits.length) {
      const more = document.createElement('div');
      more.className = 'results-more';
      more.textContent = (total - hits.length) + ' more matches — try a longer search.';
      resultsEl.appendChild(more);
    }
  }

  function hint(text) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.textContent = text;
    return el;
  }

  function resultItem(entry) {
    const item = document.createElement('div');
    item.className = 'result-item';

    const row = document.createElement('button');
    row.className = 'result-row';
    row.type = 'button';

    const main = document.createElement('div');
    main.className = 'result-main';

    const tib = document.createElement('div');
    tib.className = 'result-tibetan';
    tib.textContent = entry.tibetan;
    main.appendChild(tib);

    if (entry.romanization) {
      const rom = document.createElement('div');
      rom.className = 'result-rom';
      rom.textContent = entry.romanization;
      main.appendChild(rom);
    }

    const gloss = document.createElement('div');
    gloss.className = 'result-gloss';
    gloss.textContent = entry.english;

    row.append(main, gloss);
    item.appendChild(row);

    if (expandedId === entry.id) expand(entry, item, row);

    // Accordion, toggled in place: rebuilding the list here would collapse its
    // height for an instant and the browser would clamp the scroll to the top.
    row.addEventListener('click', () => {
      const wasOpen = openRefs !== null && openRefs.id === entry.id;
      collapse();
      if (!wasOpen) expand(entry, item, row);
      expandedId = openRefs ? entry.id : null;
    });

    return item;
  }

  function expand(entry, item, row) {
    const detail = renderEntryDetail(entry, ctx.data, {
      byTibetan: index.byTibetan,
      onNavigate: navigateTo,
    });
    item.appendChild(detail);
    row.setAttribute('aria-expanded', 'true');
    openRefs = { id: entry.id, row, detail };
  }

  function collapse() {
    if (!openRefs) return;
    openRefs.detail.remove();
    openRefs.row.setAttribute('aria-expanded', 'false');
    openRefs = null;
  }

  return { render };
}
