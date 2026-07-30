import { shuffle, pickNext, dueCount } from '../queue.js';
import { romanizationLine } from '../entry-view.js';
import { createHistory, navRow } from './card-history.js';

const DRILL_TYPE = 'discrimination';
const MAX_OPTIONS = 4;

function activeGroupMembers(group, data, activeSet) {
  return group.members.filter(id => activeSet.has(id));
}

// Two members that share an English gloss cannot both be offered, in EITHER
// direction, because the card stops having one right answer:
//   ti-en  the learner sees ཡིད་ and picks between two options both reading "mind"
//   en-ti  the prompt "mind" matches ཡིད་ AND སེམས་, so both options are correct
// Three groups are affected — ཡིད་/སེམས་ ("mind"), སོ་/ནོ་ ("terminating
// particle"), ཐུགས་རྗེ་/སྙིང་རྗེ་ ("compassion"). Marking either choice wrong is a
// bug in the card, not a mistake by the learner.
function meaningKey(entry) {
  return entry.english.trim().toLowerCase();
}

// The correct entry plus only those members that are actually tellable apart
// from it, and from each other, by their English.
function answerableMembers(members, correct) {
  const seen = new Set([meaningKey(correct)]);
  const out = [correct];
  for (const m of members) {
    if (m.id === correct.id) continue;
    const key = meaningKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
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

// An entry is only drillable if at least one group member survives the
// answerable filter — otherwise every distractor would duplicate the answer.
function drillableMembers(entry, data, activeSet) {
  const group = data.groupsById.get(entry.falseFriendGroup);
  if (!group) return [];
  const members = activeGroupMembers(group, data, activeSet)
    .map(id => data.entriesById.get(id));
  return answerableMembers(members, entry);
}

function candidateIds(data, activeSet) {
  const out = [];
  for (const e of data.entries) {
    if (e.falseFriendGroup === null || e.falseFriendGroup === undefined) continue;
    if (!activeSet.has(e.id)) continue;
    if (drillableMembers(e, data, activeSet).length >= 2) out.push(e.id);
  }
  return out;
}

export function createDiscriminationDrill(ctx) {
  let lastEntryId = null;
  const history = createHistory();

  function candidates() {
    return candidateIds(ctx.data, ctx.getActiveSet());
  }

  // Called on every mode switch. Redraws whatever was on screen rather than
  // moving on, so looking a word up and coming back does not lose the card.
  function render() {
    const cands = candidateIds(ctx.data, ctx.getActiveSet());
    ctx.setDueCount(dueCount(cands, ctx.store, DRILL_TYPE));

    if (cands.length === 0) {
      history.clear();
      ctx.container.innerHTML = '<div class="empty-state">No false-friend groups available with the current filters. Try including more sources, or turn off &ldquo;exclude unverified&rdquo; in Filters.</div>';
      return;
    }

    const card = history.viewing();
    if (card && ctx.data.entriesById.has(card.entryId)) {
      drawCard(card);
      return;
    }
    next();
  }

  function next() {
    const activeSet = ctx.getActiveSet();
    const cands = candidateIds(ctx.data, activeSet);
    if (cands.length === 0) { render(); return; }

    const entryId = pickNext(cands, ctx.store, DRILL_TYPE, lastEntryId);
    lastEntryId = entryId;
    const entry = ctx.data.entriesById.get(entryId);
    const members = drillableMembers(entry, ctx.data, activeSet);

    // The option order is frozen into the card, so stepping back redraws the
    // same buttons in the same places instead of reshuffling them.
    history.push({
      entryId,
      direction: Math.random() < 0.5 ? 'ti-en' : 'en-ti',
      optionIds: pickOptionMembers(members, entryId).map(m => m.id),
      answeredId: null,
    });
    drawCard(history.viewing());
  }

  function drawCard(state) {
    const entry = ctx.data.entriesById.get(state.entryId);
    const group = ctx.data.groupsById.get(entry.falseFriendGroup);
    const members = state.optionIds
      .map(id => ctx.data.entriesById.get(id))
      .filter(Boolean);
    renderCard(entry, group, members, state.direction, state);
  }

  function renderCard(entry, group, members, direction, state) {
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

    const options = members.map(m => ({
      entry: m,
      label: direction === 'ti-en' ? m.english : m.tibetan,
      correct: m.id === entry.id,
    }));

    // Already answered — either earlier in this session, or before the learner
    // switched away and came back. Redraw the outcome; never score it twice.
    const alreadyAnswered = state.answeredId !== null;
    let answered = alreadyAnswered;

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'option-btn' + (direction === 'en-ti' ? ' tibetan' : '');
      btn.textContent = opt.label;
      opt.btn = btn;

      if (alreadyAnswered) {
        btn.disabled = true;
        if (opt.correct) btn.classList.add('correct');
        if (opt.entry.id === state.answeredId && !opt.correct) btn.classList.add('incorrect');
      }

      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        ctx.store.answer(entry.id, DRILL_TYPE, opt.correct);
        history.update({ answeredId: opt.entry.id });
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
    if (alreadyAnswered) {
      showFooter();
    } else {
      // Reachable before answering too, so you can step back without being
      // forced to guess at the card in front of you first.
      const nav = navRow(history, () => drawCard(history.viewing()));
      if (nav) container.appendChild(nav);
    }

    function showFooter() {
      if (!romanizationShownInPrompt) card.appendChild(romanizationLine(entry));

      // When the options are Tibetan spellings, label every one of them with its
      // own pronunciation — not just the correct answer. Telling བསྔོ་བ་ NGO-WA
      // from ངོ་བོ་ NGO-WO, or seeing that ཤི་ and གཤིས་ are both SHI, is the
      // entire point of the drill, and it is unlearnable if the distractors are
      // unlabelled. Safe on the answer side: the test is already over.
      if (direction === 'en-ti') {
        for (const opt of options) {
          const rom = document.createElement('div');
          rom.className = 'option-rom';
          rom.textContent = opt.entry.romanization;
          opt.btn.appendChild(rom);
        }
      }
      // group.note is authoring guidance addressed to whoever builds the app
      // ("Do NOT show the pronunciation on the QUESTION side…"), not something
      // a learner should ever read. The instruction it carries is already
      // honoured via group.hideRomanizationOnPrompt above.
      const row = document.createElement('div');
      row.className = 'action-row';
      const nextBtn = document.createElement('button');
      nextBtn.className = 'big-btn primary';
      // While reviewing an older card, "Next" walks forward through history
      // rather than dealing a new word — otherwise the cards you stepped back
      // past would be unreachable again.
      nextBtn.textContent = history.atLive() ? 'Next' : 'Next →';
      nextBtn.addEventListener('click', () => {
        if (history.atLive()) next();
        else { history.forward(); drawCard(history.viewing()); }
      });
      row.appendChild(nextBtn);
      container.appendChild(row);

      const nav = navRow(history, () => drawCard(history.viewing()));
      if (nav) container.appendChild(nav);
    }
  }

  return { render, candidates };
}
