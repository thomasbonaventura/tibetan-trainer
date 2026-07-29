import { createSession, orderedCandidates, GRADUATED_BOX } from '../session.js';
import { romanizationLine } from '../entry-view.js';

const DRILL_TYPE = 'recall';

export function createRecallDrill(ctx) {
  const session = createSession(DRILL_TYPE);

  function candidates() {
    return orderedCandidates(ctx.data, ctx.getActiveSet());
  }

  function render() {
    const activeSet = ctx.getActiveSet();
    const all = orderedCandidates(ctx.data, activeSet);

    if (all.length === 0) {
      ctx.container.innerHTML = '<div class="empty-state">No entries available with the current filters.</div>';
      ctx.setDueCount(0);
      return;
    }

    const cohortSize = ctx.settings.recallCohortSize;
    const pick = session.next(ctx.data, activeSet, ctx.store, cohortSize);

    ctx.setDueCount(pick.due.length + session.relearnCount());

    if (pick.id === null) {
      renderCohortDone(pick, all.length);
      return;
    }

    const entry = ctx.data.entriesById.get(pick.id);
    const direction = Math.random() < 0.5 ? 'ti-en' : 'en-ti';
    renderCard(entry, direction, pick);
  }

  // Nothing in the cohort is due: everything has been pushed out to a future
  // date. That is the spaced-repetition system working, not a dead end, so say
  // so plainly and offer the two real options.
  function renderCohortDone(pick, totalAvailable) {
    const container = ctx.container;
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card';

    const h = document.createElement('div');
    h.className = 'english-prompt';
    h.textContent = 'Nothing due right now';
    card.appendChild(h);

    const sub = document.createElement('div');
    sub.className = 'romanization';
    sub.textContent = `${pick.learned.length} of ${pick.cohort.length} words in rotation are learned. ` +
      'The rest come back on their review dates.';
    card.appendChild(sub);
    container.appendChild(card);

    const remaining = totalAvailable - pick.cohort.length;
    if (remaining > 0) {
      const step = Math.min(ctx.settings.recallExpandStep, remaining);
      const add = document.createElement('button');
      add.className = 'big-btn primary';
      add.style.marginTop = '16px';
      add.textContent = `Add ${step} more word${step === 1 ? '' : 's'}`;
      add.addEventListener('click', () => {
        ctx.settings.recallCohortSize = pick.cohort.length + step;
        ctx.persistSettings();
        render();
      });
      container.appendChild(add);

      const note = document.createElement('div');
      note.className = 'empty-state';
      note.style.padding = '14px 0 0';
      note.textContent = `${remaining} more available. Change how many words are in rotation in Settings.`;
      container.appendChild(note);
    } else {
      const note = document.createElement('div');
      note.className = 'empty-state';
      note.textContent = 'Every word matching your filters is in rotation.';
      container.appendChild(note);
    }
  }

  function renderCard(entry, direction, pick) {
    const container = ctx.container;
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card flip-card';

    if (pick.reason === 'relearn') {
      const again = document.createElement('div');
      again.className = 'again-flag';
      again.textContent = 'again';
      card.appendChild(again);
    }

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

    const progress = document.createElement('div');
    progress.className = 'cohort-progress';
    progress.textContent = `${pick.learned.length}/${pick.cohort.length} learned in rotation`;
    container.appendChild(progress);

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
      } else {
        const tib = document.createElement('div');
        tib.className = 'tibetan medium';
        tib.textContent = entry.tibetan;
        back.appendChild(tib);
      }
      // Always on the answer side, in both directions — see meta.cardGuidance.
      back.appendChild(romanizationLine(entry));

      // The sentence the word was actually met in. 45 entries have none.
      if (entry.example) {
        const ex = document.createElement('div');
        ex.className = 'example-block';

        const label = document.createElement('div');
        label.className = 'detail-label';
        label.textContent = 'In context';
        ex.appendChild(label);

        const tib = document.createElement('div');
        tib.className = 'cloze-sentence example-sentence';
        tib.textContent = entry.example.tibetan;
        ex.appendChild(tib);

        if (entry.example.english) {
          const eng = document.createElement('div');
          eng.className = 'english-reveal';
          eng.textContent = entry.example.english;
          ex.appendChild(eng);
        }
        back.appendChild(ex);
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
      bad.addEventListener('click', () => {
        session.answer(entry.id, false, ctx.store, pick.cohort.length);
        render();
      });
      good.addEventListener('click', () => {
        session.answer(entry.id, true, ctx.store, pick.cohort.length);
        render();
      });
      row.append(bad, good);
      container.appendChild(row);
    });
  }

  return { render, candidates };
}
