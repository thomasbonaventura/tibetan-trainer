// Shared rendering of a vocabulary entry, used by the Look up mode and (for
// romanizationLine) by the discrimination drill.

import { foldTibetan, tibetanHead } from './search.js';

// Drill-side: show the romanization, or an "unverified" chip in its place.
export function romanizationLine(entry) {
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

// Dictionary-side: always show the romanization, and flag it when unverified.
// A lookup is an answer-side context — there is no test left to protect, and
// the pronunciation is part of what is being learned (see README_DATA.md).
export function romanizationDetail(entry) {
  const wrap = document.createDocumentFragment();
  if (entry.romanization) {
    const r = document.createElement('div');
    r.className = 'romanization';
    r.textContent = entry.romanization;
    wrap.appendChild(r);
  }
  if (!entry.pronunciationVerified) {
    const flag = document.createElement('div');
    flag.className = 'unverified-flag';
    flag.textContent = 'pronunciation unverified';
    wrap.appendChild(flag);
  }
  return wrap;
}

function section(label) {
  const el = document.createElement('div');
  el.className = 'detail-section';
  const h = document.createElement('div');
  h.className = 'detail-label';
  h.textContent = label;
  el.appendChild(h);
  return el;
}

// Renders one {tibetan, english} item as a chip, tappable when the word
// resolves to an entry of its own.
function chip(item, byTibetan, onNavigate) {
  const head = tibetanHead(item.tibetan);
  const targetId = byTibetan.get(foldTibetan(head));
  const linkable = Boolean(targetId && onNavigate);

  const el = document.createElement(linkable ? 'button' : 'div');
  el.className = linkable ? 'chip linkable' : 'chip';

  // Show the head only: a few related items carry a gloss inside the Tibetan
  // field ("དམ་པའི་ཆོས་ (holy Dharma)"), which would otherwise render the
  // English in the big Tibetan serif alongside the gloss column.
  const tib = document.createElement('span');
  tib.className = 'chip-tibetan';
  tib.textContent = head || item.tibetan;
  el.appendChild(tib);

  if (item.english) {
    const gloss = document.createElement('span');
    gloss.className = 'chip-gloss';
    gloss.textContent = item.english;
    el.appendChild(gloss);
  }

  if (linkable) el.addEventListener('click', () => onNavigate(head));
  return el;
}

function chipRow(items, byTibetan, onNavigate) {
  const row = document.createElement('div');
  row.className = 'chip-row';
  for (const item of items) row.appendChild(chip(item, byTibetan, onNavigate));
  return row;
}

// The listed false friends plus the rest of this entry's false-friend group.
// The group members are the authoritative set (they carry real ids); the
// falseFriends array sometimes names a word the group does not.
function falseFriendItems(entry, data) {
  const items = [];
  const seen = new Set([foldTibetan(entry.tibetan)]);

  const push = (tibetan, english) => {
    const key = foldTibetan(tibetanHead(tibetan));
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({ tibetan, english });
  };

  for (const ff of entry.falseFriends || []) push(ff.tibetan, ff.english);

  const group = entry.falseFriendGroup != null ? data.groupsById.get(entry.falseFriendGroup) : null;
  for (const id of group ? group.members : []) {
    if (id === entry.id) continue;
    const member = data.entriesById.get(id);
    if (member) push(member.tibetan, member.english);
  }

  return items;
}

/**
 * The full dictionary record for one entry.
 * @param {object} opts.byTibetan  folded-Tibetan → entryId, from buildSearchIndex
 * @param {(tibetan: string) => void} [opts.onNavigate]  called when a related /
 *   false-friend chip is tapped
 */
export function renderEntryDetail(entry, data, { byTibetan, onNavigate } = {}) {
  const root = document.createElement('div');
  root.className = 'entry-detail';

  const head = document.createElement('div');
  head.className = 'tibetan medium';
  head.textContent = entry.tibetan;
  root.appendChild(head);
  root.appendChild(romanizationDetail(entry));

  if (entry.wylie) {
    const w = document.createElement('div');
    w.className = 'wylie';
    w.textContent = entry.wylie;
    root.appendChild(w);
  }

  // Meaning — one line, or a numbered list when the entry carries several senses.
  const meaning = section('Meaning');
  if ((entry.senses || []).length > 1) {
    const ol = document.createElement('ol');
    ol.className = 'sense-list';
    for (const s of entry.senses) {
      const li = document.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    }
    meaning.appendChild(ol);
  } else {
    const p = document.createElement('div');
    p.className = 'detail-text';
    p.textContent = entry.english;
    meaning.appendChild(p);
  }
  root.appendChild(meaning);

  // 45 entries have no example sentence at all.
  if (entry.example) {
    const ex = section('In context');
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
    root.appendChild(ex);
  }

  // "" means unknown, not false — only render what is actually filled in.
  if (entry.sanskrit) {
    const sk = section('Sanskrit');
    const p = document.createElement('div');
    p.className = 'detail-text';
    p.textContent = entry.sanskrit;
    sk.appendChild(p);
    root.appendChild(sk);
  }

  if (entry.notes) {
    const n = section('Notes');
    const p = document.createElement('div');
    p.className = 'detail-text';
    p.textContent = entry.notes;
    n.appendChild(p);
    root.appendChild(n);
  }

  const related = (entry.related || []).filter(r => r.tibetan);
  if (related.length) {
    const s = section('Related words');
    s.appendChild(chipRow(related, byTibetan || new Map(), onNavigate));
    root.appendChild(s);
  }

  const friends = falseFriendItems(entry, data);
  if (friends.length) {
    const s = section('False friends');
    s.appendChild(chipRow(friends, byTibetan || new Map(), onNavigate));
    root.appendChild(s);
  }

  const meta = [
    entry.category,
    data.sourceNames[entry.sourceCode] || entry.sourceCode,
    entry.lesson,
    entry.dateLearned,
  ].filter(Boolean);
  if (meta.length) {
    const foot = document.createElement('div');
    foot.className = 'detail-meta';
    foot.textContent = meta.join(' · ');
    root.appendChild(foot);
  }

  return root;
}
