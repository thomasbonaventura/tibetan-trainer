import { shuffle, pickNext, dueCount } from '../queue.js';

const DRILL_TYPE = 'discrimination';
const MAX_OPTIONS = 4;

function activeGroupMembers(group, data, activeSet) {
  return group.members.filter(id => activeSet.has(id));
}

// Large groups (e.g. the 12-member "all"/plural-marker set) would turn the
// drill into a lottery if every member were offered as an option, so cap it:
// the correct entry plus up to MAX_OPTIONS-1 random distractors.
function pickOptionMembers(members, correctId) {
  if (members.length <= MAX_OPTIONS) return shuffle(members);
  const correct = members.find(m => m.id === correctId);
  const distractors = shuffle(members.filter(m => m.id !== correctId)).slice(0, MAX_OPTIONS - 1);
  return shuffle([correct, ...distractors]);
}

function romanizationLine(entry) {
  if (entry.pronunciationVerified) {
    const r = document.createElement('div');
    r.className = 'romanization';
    r.textContent = entry.romanization;
    return r;
  }
  const flag = document.createElement('div');
  flag.className = 'unverified-flag';
  flag.textContent = 'pronunciation unverified';
  return flag;
}

function candidateIds(data, activeSet) {
  const out = [];
  for (const e of data.entries) {
    if (e.falseFriendGroup === null || e.falseFriendGroup === undefined) continue;
    if (!activeSet.has(e.id)) continue;
    const group = data.groupsById.get(e.falseFriendGroup);
    if (activeGroupMembers(group, data, activeSet).length >= 2) out.push(e.id);
  }
  return out;
}

export function createDiscriminationDrill(ctx) {
  let lastEntryId = null;

  function candidates() {
    return candidateIds(ctx.data, ctx.getActiveSet());
  }

  function render() {
    const activeSet = ctx.getActiveSet();
    const cands = candidateIds(ctx.data, activeSet);
    ctx.setDueCount(dueCount(cands, ctx.store, DRILL_TYPE));

    if (cands.length === 0) {
      ctx.container.innerHTML = '<div class="empty-state">No false-friend groups available with the current filters. Try including more sources, or turn off &ldquo;exclude unverified&rdquo; in Filters.</div>';
      return;
    }

    const entryId = pickNext(cands, ctx.store, DRILL_TYPE, lastEntryId);
    lastEntryId = entryId;
    const entry = ctx.data.entriesById.get(entryId);
    const group = ctx.data.groupsById.get(entry.falseFriendGroup);
    const members = activeGroupMembers(group, ctx.data, activeSet).map(id => ctx.data.entriesById.get(id));
    const direction = Math.random() < 0.5 ? 'ti-en' : 'en-ti';

    renderCard(entry, group, members, direction);
  }

  function renderCard(entry, group, members, direction) {
    const container = ctx.container;
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card';

    const romanizationShownInPrompt = direction === 'ti-en' && !group.hideRomanizationOnPrompt;

    if (direction === 'ti-en') {
      const t = document.createElement('div');
      t.className = 'tibetan';
      t.textContent = entry.tibetan;
      card.appendChild(t);

      if (romanizationShownInPrompt) card.appendChild(romanizationLine(entry));
    } else {
      const p = document.createElement('div');
      p.className = 'english-prompt';
      p.textContent = entry.english;
      card.appendChild(p);
    }

    container.appendChild(card);

    const caption = document.createElement('div');
    caption.className = 'empty-state';
    caption.style.margin = '0 0 12px';
    caption.style.padding = '0';
    caption.textContent = direction === 'ti-en' ? 'Which meaning is correct?' : 'Which spelling is correct?';
    container.appendChild(caption);

    const optionsEl = document.createElement('div');
    optionsEl.className = 'options';

    const options = pickOptionMembers(members, entry.id).map(m => ({
      entry: m,
      label: direction === 'ti-en' ? m.english : m.tibetan,
      correct: m.id === entry.id,
    }));

    let answered = false;

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'option-btn' + (direction === 'en-ti' ? ' tibetan' : '');
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        ctx.store.answer(entry.id, DRILL_TYPE, opt.correct);
        for (const child of optionsEl.children) child.disabled = true;
        btn.classList.add(opt.correct ? 'correct' : 'incorrect');
        if (!opt.correct) {
          const correctBtn = [...optionsEl.children][options.indexOf(options.find(o => o.correct))];
          correctBtn.classList.add('correct');
        }
        showFooter();
      });
      optionsEl.appendChild(btn);
    }

    container.appendChild(optionsEl);

    function showFooter() {
      if (!romanizationShownInPrompt) card.appendChild(romanizationLine(entry));
      if (group.note) {
        const note = document.createElement('div');
        note.className = 'empty-state';
        note.style.textAlign = 'left';
        note.style.padding = '0';
        note.style.marginTop = '14px';
        note.textContent = group.note;
        container.appendChild(note);
      }
      const row = document.createElement('div');
      row.className = 'action-row';
      const next = document.createElement('button');
      next.className = 'big-btn primary';
      next.textContent = 'Next';
      next.addEventListener('click', render);
      row.appendChild(next);
      container.appendChild(row);
    }
  }

  return { render, candidates };
}
