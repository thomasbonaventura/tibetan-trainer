import { pickNext, dueCount } from '../queue.js';

const DRILL_TYPE = 'recall';

function candidateIds(data, activeSet) {
  const out = [];
  for (const e of data.entries) {
    if (activeSet.has(e.id)) out.push(e.id);
  }
  return out;
}

export function createRecallDrill(ctx) {
  let lastEntryId = null;

  function candidates() {
    return candidateIds(ctx.data, ctx.getActiveSet());
  }

  function render() {
    const activeSet = ctx.getActiveSet();
    const cands = candidateIds(ctx.data, activeSet);
    ctx.setDueCount(dueCount(cands, ctx.store, DRILL_TYPE));

    if (cands.length === 0) {
      ctx.container.innerHTML = '<div class="empty-state">No entries available with the current filters.</div>';
      return;
    }

    const entryId = pickNext(cands, ctx.store, DRILL_TYPE, lastEntryId);
    lastEntryId = entryId;
    const entry = ctx.data.entriesById.get(entryId);
    const direction = Math.random() < 0.5 ? 'ti-en' : 'en-ti';

    renderCard(entry, direction);
  }

  function renderCard(entry, direction) {
    const container = ctx.container;
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card flip-card';

    const front = document.createElement('div');
    if (direction === 'ti-en') {
      front.className = 'tibetan';
      front.textContent = entry.tibetan;
    } else {
      front.className = 'english-prompt';
      front.textContent = entry.english;
    }
    card.appendChild(front);
    container.appendChild(card);

    let revealed = false;

    const revealBtn = document.createElement('button');
    revealBtn.className = 'big-btn primary';
    revealBtn.textContent = 'Show answer';
    revealBtn.style.marginTop = '16px';
    container.appendChild(revealBtn);

    revealBtn.addEventListener('click', () => {
      if (revealed) return;
      revealed = true;

      const back = document.createElement('div');
      back.className = 'flip-back';

      if (direction === 'ti-en') {
        const eng = document.createElement('div');
        eng.className = 'english-prompt';
        eng.textContent = entry.english;
        back.appendChild(eng);
        if (entry.pronunciationVerified && entry.romanization) {
          const rom = document.createElement('div');
          rom.className = 'romanization';
          rom.textContent = entry.romanization;
          back.appendChild(rom);
        }
      } else {
        const tib = document.createElement('div');
        tib.className = 'tibetan medium';
        tib.textContent = entry.tibetan;
        back.appendChild(tib);
        if (entry.pronunciationVerified && entry.romanization) {
          const rom = document.createElement('div');
          rom.className = 'romanization';
          rom.textContent = entry.romanization;
          back.appendChild(rom);
        }
      }

      if (entry.notes) {
        const notes = document.createElement('div');
        notes.className = 'empty-state';
        notes.style.textAlign = 'left';
        notes.style.padding = '10px 0 0';
        notes.textContent = entry.notes;
        back.appendChild(notes);
      }

      card.appendChild(back);
      revealBtn.remove();

      const row = document.createElement('div');
      row.className = 'action-row';
      const bad = document.createElement('button');
      bad.className = 'big-btn bad';
      bad.textContent = '✗ Didn’t know';
      const good = document.createElement('button');
      good.className = 'big-btn good';
      good.textContent = '✓ Knew it';
      bad.addEventListener('click', () => { ctx.store.answer(entry.id, DRILL_TYPE, false); render(); });
      good.addEventListener('click', () => { ctx.store.answer(entry.id, DRILL_TYPE, true); render(); });
      row.append(bad, good);
      container.appendChild(row);
    });
  }

  return { render, candidates };
}
