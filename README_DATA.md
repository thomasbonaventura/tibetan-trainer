# tibetan_trainer_data.json — data contract

Personal Tibetan vocabulary, exported from a hand-built dictionary.
**484 entries · 34 false-friend groups · 347 cloze cards.** UTF-8, ~1.1 MB.

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
| `meta` | counts, sources, romanization convention, **`cardGuidance`** |
| `entries` | 484 vocabulary entries |
| `falseFriendGroups` | 34 sets of confusable words |
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
  "falseFriendGroup": null,          // or a groupId
  "sourceCode": "TIB1",
  "sources": ["Tibetan I – Grammar Slides", …],
  "lesson": "Slide 1 (basic vocab); 4; 21",
  "dateLearned": "2025-10-01",       // null only for contrast entries
  "pronunciationVerified": true,     // false on 178 entries — see below
  "pronunciationProvenance": "from slides",   // or "from source" / "derived – reviewed"
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
  "members": ["NEC-017","SYL-001"],          // ཅན་ and ཆེན་
  "romanizations": ["CHEN","CHEN"],
  "romanizationsIdentical": true,
  "hideRomanizationOnPrompt": false,
  "note": "All members are romanized CHEN. Showing the pronunciation is harmless
           here — it cannot disambiguate — and is worth showing, because it
           demonstrates that pronunciation will not save you."
}
```

Groups are **connected components**, so a word listed against two different
partners lands in one group with all of them.

Sizes: 2 members ×21, 3 ×9, 4 ×1, 5 ×1, 6 ×1, **12 ×1**. The twelve-member group
merges the "all" words with the plural markers — cap distractors at three or four
when drilling it, or it becomes a lottery.

### Showing the romanization — read this carefully

The leak runs the **opposite way** from the obvious guess.

- **Risk exists when members DIFFER** in romanization (ལས་ LE / ལམ་ LAM / ནས་ NE).
  The learner can answer from the romanization without ever reading the script,
  which defeats the whole point of the drill. → `hideRomanizationOnPrompt: true`
- **No risk when all members SHARE one romanization** (ཅན་/ཆེན་ both CHEN). It
  cannot disambiguate, and showing it teaches the real lesson: pronunciation
  will not help, read the script. → `hideRomanizationOnPrompt: false`

Honour `hideRomanizationOnPrompt`, not `romanizationsIdentical`.
30 of the 34 groups hide it on the prompt; 4 do not.

**Always show the romanization on the answer side, in every card type.** Once the
answer is revealed there is no test left to protect, and the pronunciation is
part of what is being learned. See `meta.cardGuidance`.

Four groups share one romanization across all members: `ཅན་/ཆེན་` (CHEN),
`བོས་/བོད་` (BÖ), `གོང་/དགོངས་` (GONG), `དང་/སྡང་` (DANG). These are the hardest
and most valuable cards.

## clozeCards

One per entry whose headword was locatable in its example sentence.
`{cardId, entryId, tibetan, english, tokens, blank}` — same token/blank shape as
`entry.example`. Sentences repeat across cards with different blanks; that is
intentional, but dedupe by `tibetan` if a session feels repetitive.

---

## Things that will bite you

1. **178 entries have `pronunciationVerified: false`** — supplied by me and checked
   for rule-consistency, but not confirmed by a teacher
   (`pronunciationProvenance: "derived – reviewed"`). The app should be able to
   exclude them.
2. **Romanization cannot disambiguate.** It is a reading aid, not phonetics — no
   tone, no vowel length. The column follows one convention throughout (Tergar
   liturgy: ཟ→Z, ཞ→ZH, བྱ→J), recorded in `meta.romanizationConvention`. Never
   use it as the answer key on a discrimination card — but do show it on reveal.
3. **Tibetan needs real rendering.** Stacked forms like སྙིང་རྗེ་, སྟོང་པ་ཉིད་,
   བསྒྲུབས་ break under fonts with poor coverage. iOS ships *Kailasa*; verify
   visually on a real iPhone, not just a desktop browser.
4. **`""` means unknown, not false.** Empty strings are absent data — only 16
   entries have verb stems, 36 are marked honorific.
5. **Some entries aren't vocabulary.** ~40 are particles or grammatical terms
   (ལ་དོན་, རྫོགས་ཚིག་). They make poor recall cards; filter by `category` if a
   drill feels wrong.
6. **`dateLearned` is null** on contrast entries (`SYL-`) — they were added to
   sharpen a distinction, never taught on a date.
