import { shuffle, pickNext, dueCount } from '../queue.js';

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

  function candidates() {
    return candidateEntryIds(ctx.data, ctx.getActiveSet());
  }

  function render() {
    const activeSet = ctx.getActiveSet();
    const cands = candidateEntryIds(ctx.data, activeSet);
    ctx.setDueCount(dueCount(cands, ctx.store, DRILL_TYPE));

    if (cands.length === 0) {
      ctx.container.innerHTML = '<div class="empty-state">No cloze cards available with the current filters.</div>';
      return;
    }

    const entryId = pickNext(cands, ctx.store, DRILL_TYPE, lastEntryId);
    lastEntryId = entryId;
    const cards = ctx.data.clozeByEntryId.get(entryId);
    const card = cards[Math.floor(Math.random() * cards.length)];
    const entry = ctx.data.entriesById.get(entryId);

    renderCard(entry, card);
  }

  function renderCard(entry, card) {
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

    function reveal(wasCorrect, givenText) {
      if (answered) return;
      answered = true;
      ctx.store.answer(entry.id, DRILL_TYPE, wasCorrect);
      blankSpan.textContent = answer;
      blankSpan.classList.add('filled');

      const englishEl = document.createElement('div');
      englishEl.className = 'english-reveal';
      englishEl.textContent = card.english;
      sentenceCard.appendChild(englishEl);

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
      const distractors = pickDistractors(ctx.data, answer, 3);
      const options = shuffle([answer, ...distractors]);
      for (const opt of options) {
        const btn = document.createElement('button');
        btn.className = 'option-btn tibetan';
        btn.textContent = opt;
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

    function renderFooter() {
      const toggleRow = document.createElement('div');
      toggleRow.className = 'action-row';
      const next = document.createElement('button');
      next.className = 'big-btn primary';
      next.textContent = 'Next';
      next.addEventListener('click', render);
      toggleRow.appendChild(next);
      container.appendChild(toggleRow);
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
