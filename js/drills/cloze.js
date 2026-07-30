import { shuffle, pickNext, dueCount } from '../queue.js';
import { createHistory, navRow } from './card-history.js';

const DRILL_TYPE = 'cloze';

function joinTokens(tokens) {
  return tokens.join('');
}

function candidateEntryIds(data, activeSet) {
  const out = [];
  for (const [entryId, cards] of data.clozeByEntryId) {
    if (activeSet.has(entryId) && cards.length > 0) out.push(entryId);
  }
  return out;
}

function pickDistractors(data, correctAnswer, count) {
  const pool = data.entries
    .map(e => e.tibetan)
    .filter(t => t && t !== correctAnswer);
  const chosen = new Set();
  const shuffled = shuffle(pool);
  for (const t of shuffled) {
    if (chosen.size >= count) break;
    chosen.add(t);
  }
  return [...chosen];
}

export function createClozeDrill(ctx) {
  let lastEntryId = null;
  let typeMode = false; // false = multiple choice, true = type it
  const history = createHistory();

  function candidates() {
    return candidateEntryIds(ctx.data, ctx.getActiveSet());
  }

  // Redraws the card that was on screen; only advances when there is none.
  function render() {
    const cands = candidateEntryIds(ctx.data, ctx.getActiveSet());
    ctx.setDueCount(dueCount(cands, ctx.store, DRILL_TYPE));

    if (cands.length === 0) {
      history.clear();
      ctx.container.innerHTML = '<div class="empty-state">No cloze cards available with the current filters.</div>';
      return;
    }

    const state = history.viewing();
    if (state && ctx.data.entriesById.has(state.entryId)) {
      drawCard(state);
      return;
    }
    next();
  }

  function next() {
    const cands = candidateEntryIds(ctx.data, ctx.getActiveSet());
    if (cands.length === 0) { render(); return; }

    const entryId = pickNext(cands, ctx.store, DRILL_TYPE, lastEntryId);
    lastEntryId = entryId;
    const cards = ctx.data.clozeByEntryId.get(entryId);
    const card = cards[Math.floor(Math.random() * cards.length)];

    // Which sentence, and which distractors in which order, are fixed now so
    // the card redraws identically.
    history.push({
      entryId,
      cardId: card.cardId,
      options: shuffle([card.blank.answer, ...pickDistractors(ctx.data, card.blank.answer, 3)]),
      answer: null, // { correct, given } once answered
    });
    drawCard(history.viewing());
  }

  function drawCard(state) {
    const entry = ctx.data.entriesById.get(state.entryId);
    const cards = ctx.data.clozeByEntryId.get(state.entryId) || [];
    const card = cards.find(c => c.cardId === state.cardId) || cards[0];
    if (!card) { next(); return; }
    renderCard(entry, card, state);
  }

  function renderCard(entry, card, state) {
    const container = ctx.container;
    container.innerHTML = '';

    const toggle = document.createElement('div');
    toggle.className = 'mode-toggle';
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = typeMode ? 'Pick from choices instead' : 'Type it instead';
    toggleBtn.addEventListener('click', () => { typeMode = !typeMode; render(); });
    toggle.appendChild(toggleBtn);
    container.appendChild(toggle);

    const before = joinTokens(card.tokens.slice(0, card.blank.start));
    const answer = card.blank.answer;
    const after = joinTokens(card.tokens.slice(card.blank.start + card.blank.length));

    const sentenceCard = document.createElement('div');
    sentenceCard.className = 'card';

    const sentence = document.createElement('div');
    sentence.className = 'cloze-sentence';
    const beforeSpan = document.createElement('span');
    beforeSpan.textContent = before;
    const blankSpan = document.createElement('span');
    blankSpan.className = 'cloze-blank';
    blankSpan.id = 'cloze-blank-slot';
    blankSpan.textContent = '    ';
    const afterSpan = document.createElement('span');
    afterSpan.textContent = after;
    sentence.append(beforeSpan, blankSpan, afterSpan);
    sentenceCard.appendChild(sentence);
    container.appendChild(sentenceCard);

    let answered = false;

    // `score` is false when redrawing an answer the learner already gave, so
    // leaving the mode and coming back cannot inflate the Leitner counts.
    function reveal(wasCorrect, givenText, score = true) {
      if (answered) return;
      answered = true;
      if (score) {
        ctx.store.answer(entry.id, DRILL_TYPE, wasCorrect);
        history.update({ answer: { correct: wasCorrect, given: givenText ?? null } });
      }
      blankSpan.textContent = answer;
      blankSpan.classList.add('filled');

      const englishEl = document.createElement('div');
      englishEl.className = 'english-reveal';
      englishEl.textContent = card.english;
      sentenceCard.appendChild(englishEl);

      if (entry.pronunciationVerified) {
        const romEl = document.createElement('div');
        romEl.className = 'romanization';
        romEl.textContent = entry.romanization;
        sentenceCard.appendChild(romEl);
      }

      if (givenText !== undefined && givenText !== answer) {
        const gaveEl = document.createElement('div');
        gaveEl.className = 'unverified-flag';
        gaveEl.style.marginTop = '10px';
        gaveEl.textContent = 'You answered: ' + (givenText || '(nothing)');
        sentenceCard.appendChild(gaveEl);
      }

      renderFooter();
    }

    if (typeMode) {
      const inputRow = document.createElement('div');
      inputRow.className = 'text-input-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Type the missing word';
      input.autocapitalize = 'off';
      input.autocomplete = 'off';
      input.spellcheck = false;
      inputRow.appendChild(input);
      container.appendChild(inputRow);

      const row = document.createElement('div');
      row.className = 'action-row';
      const submit = document.createElement('button');
      submit.className = 'big-btn primary';
      submit.textContent = 'Check';
      submit.addEventListener('click', () => {
        const given = input.value.trim();
        reveal(normalize(given) === normalize(answer), given);
      });
      row.appendChild(submit);
      container.appendChild(row);
      setTimeout(() => input.focus(), 50);
    } else {
      const optionsEl = document.createElement('div');
      optionsEl.className = 'options';
      for (const opt of state.options) {
        const btn = document.createElement('button');
        btn.className = 'option-btn tibetan';
        btn.textContent = opt;
        if (state.answer) {
          btn.disabled = true;
          if (opt === answer) btn.classList.add('correct');
          if (opt === state.answer.given && !state.answer.correct) btn.classList.add('incorrect');
        }
        btn.addEventListener('click', () => {
          if (answered) return;
          const correct = opt === answer;
          reveal(correct, opt);
          for (const child of optionsEl.children) child.disabled = true;
          btn.classList.add(correct ? 'correct' : 'incorrect');
          if (!correct) {
            [...optionsEl.children].find(c => c.textContent === answer)?.classList.add('correct');
          }
        });
        optionsEl.appendChild(btn);
      }
      container.appendChild(optionsEl);
    }

    if (state.answer) {
      reveal(state.answer.correct, state.answer.given ?? undefined, false);
    } else {
      const nav = navRow(history, () => drawCard(history.viewing()));
      if (nav) container.appendChild(nav);
    }

    function renderFooter() {
      const toggleRow = document.createElement('div');
      toggleRow.className = 'action-row';
      const nextBtn = document.createElement('button');
      nextBtn.className = 'big-btn primary';
      nextBtn.textContent = history.atLive() ? 'Next' : 'Next →';
      nextBtn.addEventListener('click', () => {
        if (history.atLive()) next();
        else { history.forward(); drawCard(history.viewing()); }
      });
      toggleRow.appendChild(nextBtn);
      container.appendChild(toggleRow);

      const nav = navRow(history, () => drawCard(history.viewing()));
      if (nav) container.appendChild(nav);
    }
  }

  function normalize(s) {
    return (s || '').replace(/\s+/g, '').replace(/[་]+$/, '');
  }

  function setTypeMode(on) {
    typeMode = on;
    render();
  }

  return { render, candidates, setTypeMode, isTypeMode: () => typeMode };
}
