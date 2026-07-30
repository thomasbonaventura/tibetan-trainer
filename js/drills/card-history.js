// Per-drill card history: what is on screen survives leaving the mode, and the
// last few cards can be looked at again.
//
// Two problems, one mechanism. Switching to Look up mid-drill used to throw the
// card away, because main.js calls render() on every mode switch and render()
// picked a new word. And once a card was answered there was no way back to it.
// Both are fixed by keeping the *card* — not just the entry id — in a stack, so
// render() can redraw exactly what was there.
//
// A card descriptor must capture everything needed to redraw the card
// identically, including the option order, or going back would reshuffle the
// answers and the card would look different the second time.
//
// SCORING: a descriptor records whether it was answered. Redrawing therefore
// never re-scores, which is what keeps the Leitner counts honest when you leave
// a mode and come back, or step backwards through history.

const DEFAULT_LIMIT = 20;

export function createHistory(limit = DEFAULT_LIMIT) {
  const stack = [];
  let cursor = -1;

  return {
    push(card) {
      stack.push(card);
      if (stack.length > limit) stack.shift();
      cursor = stack.length - 1;
    },
    // Update the card being viewed in place — used when it gets answered.
    update(patch) {
      if (cursor >= 0) Object.assign(stack[cursor], patch);
    },
    viewing() {
      return cursor >= 0 ? stack[cursor] : null;
    },
    isEmpty() {
      return stack.length === 0;
    },
    atLive() {
      return cursor === stack.length - 1;
    },
    canBack() {
      return cursor > 0;
    },
    canForward() {
      return cursor < stack.length - 1;
    },
    back() {
      if (cursor > 0) cursor -= 1;
      return this.viewing();
    },
    forward() {
      if (cursor < stack.length - 1) cursor += 1;
      return this.viewing();
    },
    stepsBack() {
      return stack.length - 1 - cursor;
    },
    clear() {
      stack.length = 0;
      cursor = -1;
    },
  };
}

/**
 * The ← / → row. Returns null when there is nowhere to go, so drills can append
 * unconditionally.
 * @param {object} history       from createHistory
 * @param {() => void} rerender  redraw the drill after the cursor moves
 */
export function navRow(history, rerender) {
  if (!history.canBack() && !history.canForward()) return null;

  const row = document.createElement('div');
  row.className = 'card-nav';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nav-btn';
  back.textContent = '← Previous';
  back.disabled = !history.canBack();
  back.addEventListener('click', () => { history.back(); rerender(); });
  row.appendChild(back);

  if (!history.atLive()) {
    const label = document.createElement('span');
    label.className = 'nav-label';
    const n = history.stepsBack();
    label.textContent = n === 1 ? '1 card back' : `${n} cards back`;
    row.appendChild(label);

    const fwd = document.createElement('button');
    fwd.type = 'button';
    fwd.className = 'nav-btn';
    fwd.textContent = 'Next →';
    fwd.addEventListener('click', () => { history.forward(); rerender(); });
    row.appendChild(fwd);
  }

  return row;
}
