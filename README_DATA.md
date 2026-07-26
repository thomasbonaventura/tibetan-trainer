# tibetan_trainer_data.json — data contract

Personal Tibetan vocabulary, exported from a hand-built dictionary.
**463 entries · 21 false-friend groups · 347 cloze cards.** UTF-8, ~1 MB.

This file is the *only* thing the app should read. Do not parse the spreadsheet.
Re-exporting produces the same shape with more entries.

---

## The one rule that matters

`entry.id` (e.g. `TIB1-001`, `NEC-042`, `NGO2-013`, `SYL-004`) is a **permanent
key**. It never changes and is never reused. Store all review progress against
it, so re-importing a newer export adds words without losing history.

---

## Top level

| key | what |
|---|---|
| `meta` | counts, generation date, source list |
| `entries` | 463 vocabulary entries |
| `falseFriendGroups` | 21 sets of confusable words |
| `clozeCards` | 347 pre-built fill-in-the-blank cards |

## entry

```jsonc
{
  "id": "TIB1-016",
  "tibetan": "སེམས་ཅན་",
  "romanization": "SEM-CHEN",       // approximate Lhasa reading, not phonetic
  "wylie": "sems can",
  "english": "sentient being(s)",
  "senses": ["sentient being(s)"],  // english split on ";"
  "category": "noun",               // incl. Tibetan grammatical classes
  "verbStems": "", "volitionality": "", "register": "",   // "" when unknown
  "sanskrit": "sattva",
  "notes": "Frequently plural in sense even without a plural marker…",
  "related":      [ {"tibetan":"སེམས་","english":"mind"}, … ],
  "falseFriends": [ {"tibetan":"…","english":"…"}, … ],   // [] if none
  "falseFriendGroup": null,         // or a groupId
  "sourceCode": "TIB1",
  "sources": ["Tibetan I – Grammar Slides", …],
  "lesson": "Slide 1 (basic vocab); 4; 21",
  "dateLearned": "2025-10-01",      // null only for contrast entries
  "pronunciationVerified": true,    // false on 164 entries — see below
  "example": {
    "tibetan": "སེམས་ཅན་རྣམས་འཁོར་བ་ལ་ཡོད།",
    "english": "Sentient beings dwell in samsara",
    "tokens": ["སེམས་","ཅན་","རྣམས་","འཁོར་","བ་","ལ་","ཡོད།"],
    "blank": {"start":0,"length":2,"answer":"སེམས་ཅན་"}   // null if not locatable
  }
}
```

`tokens` are already split on the tsheg (་). Join them with `""` — the
separator is part of each token. To render a cloze, replace
`tokens[start … start+length]` with a blank.

## falseFriendGroups

```jsonc
{
  "groupId": 2,
  "members": ["NEC-017","SYL-001"],      // ཅན་ and ཆེན་
  "romanizationsIdentical": true,
  "note": "All members share the romanization CHEN — the app must NOT show the
           pronunciation on these cards, or the answer is given away."
}
```

Groups are **connected components**, so a word listed against two different
partners lands in one group with all of them: ལས་ / ལམ་ / ནས་ is a single
3-member set, and the བྱེད་ verb family is one 6-member set.

Group sizes: 2 members ×8, 3 ×7, 4 ×2, 5 ×1, 6 ×1.

**Three groups have identical romanization across all members** — `ཅན་/ཆེན་`
(CHEN), `བོས་/བོད་` (BÖ), `དང་/སྡང་` (DANG). These are the hardest and most
valuable cards. Honour `romanizationsIdentical`.

## clozeCards

One per entry whose headword was locatable in its example sentence.
`{cardId, entryId, tibetan, english, tokens, blank}` — same token/blank shape as
`entry.example`. Sentences repeat across cards with different blanks; that is
intentional, but dedupe by `tibetan` if a session feels repetitive.

---

## Things that will bite you

1. **164 entries have `pronunciationVerified: false`.** Those romanizations are
   unconfirmed guesses. The app must be able to exclude them; never quiz the
   romanization of one.
2. **Romanization cannot disambiguate.** It is a reading aid, not phonetics —
   no tone, no vowel length, and inconsistent between sources (`DÜN DU` vs
   `gey-wa`). Never use it as the answer key for a discrimination card.
3. **Tibetan needs real rendering.** Stacked forms like སྙིང་རྗེ་, སྟོང་པ་ཉིད་,
   བསྒྲུབས་ break under fonts with poor coverage. iOS ships *Kailasa*; verify
   visually on a real iPhone, not just a desktop browser.
4. **`""` means unknown, not false.** Empty strings are absent data — only 16
   entries have verb stems, 36 are marked honorific.
5. **Some entries aren't vocabulary.** ~40 are particles or grammatical terms
   (ལ་དོན་, རྫོགས་ཚིག་). They make poor recall cards; filter by `category` if a
   drill feels wrong.
6. **`dateLearned` is null** on contrast entries (`SYL-`, plus a few added for
   comparison) — they were never taught on a date.
