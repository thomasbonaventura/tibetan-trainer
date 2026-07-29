# tibetan_trainer_data.json — data contract

Personal Tibetan vocabulary, exported from a hand-built dictionary.
**527 entries · 64 false-friend groups · 384 cloze cards.** UTF-8, ~1.26 MB.

This file is the *only* thing the app should read. Nothing in `js/` parses the
spreadsheet — one script does, and it is the only thing that ever should.

---

## The one rule that matters

`entry.id` (e.g. `TIB1-001`, `NEC-042`, `NGO2-013`, `SYL-004`) is a **permanent
key**. It never changes and is never reused. Store all review progress against
it, so re-importing a newer export adds words without losing history.

The spreadsheet is **content-authoritative**; the app is **progress-authoritative**.
Nothing in this file records progress — Leitner boxes live in localStorage keyed
on `id`. `entry.mastery` is the learner's own spreadsheet column, currently empty
on every row, and is not the app's progress field.

---

## Regenerating it

```bash
python3 tools/import_dictionary.py --xlsx "…/20260729 Tibetan_Vocabulary_Dictionary.xlsx"
```

Needs `openpyxl`. Add `--dry-run` to see the report without writing, or
`--sample-ids TIB1-041,NGO6-017` to print entries instead. The script verifies
its own output before writing and exits non-zero if anything failed to round-trip.

Re-importing is *just* replacing this file: `data.js` fetches it `no-cache` and
the service worker is network-first for this path. Changing anything in `js/`,
by contrast, needs `SHELL_CACHE` bumped in `sw.js` — shell files are cache-first
and an installed PWA will otherwise serve the old module forever.

### Two things that will silently corrupt a re-import

1. **Never Unicode-normalize.** Tibetan stacks are sequences of separate
   codepoints (subjoined U+0F90–U+0FBC). NFD, NFKC and NFKD all mutate this
   data. The importer normalizes nothing and asserts the output still round-trips.
2. **The spreadsheet's separators are not what they look like.** In the paired
   columns (related words, false friends) `/` separates *items* and `;`
   separates *senses inside one item* — `'body; to remain / negative particle'`
   is two items, not three. Splitting those columns on `;` is exactly what
   truncates a homograph like ལས་. Sources split on `;`, lesson segments on `|`.

## Top level

| key | what |
|---|---|
| `meta` | counts, sources, romanization convention, **`cardGuidance`** |
| `entries` | 527 vocabulary entries |
| `falseFriendGroups` | 64 sets of confusable words |
| `clozeCards` | 384 pre-built fill-in-the-blank cards |

## entry

```jsonc
{
  "id": "TIB1-016",
  "tibetan": "སེམས་ཅན་",
  "romanization": "SEM-CHEN",       // approximate Lhasa reading, not phonetic
  "wylie": "sems can",              // search index only — never displayed
  "english": "sentient being(s)",
  "senses": ["sentient being(s)"],  // english split on ";" — 370 entries have >1
  "category": "noun",               // incl. Tibetan grammatical classes
  "verbStems": "", "volitionality": "", "register": "",   // "" when unknown
  "sanskrit": "sattva",
  "notes": "Frequently plural in sense even without a plural marker…",
  "related":      [ {"tibetan":"སེམས་","english":"mind"}, … ],
  "falseFriends": [ {"tibetan":"…","english":"…"}, … ],   // [] if none
  "falseFriendGroup": null,          // or a groupId
  "sourceCode": "TIB1",
  "sources": ["Tibetan I – Grammar Slides", …],
  "lesson": "Slide 1 (basic vocab); 4; 21 | Verse 1 (loving-kindness) | Ngöndro 2 … v.2m",
  "sourceLessons": [ {"source":"Tibetan I – Grammar Slides",
                      "lesson":"Slide 1 (basic vocab); 4; 21"}, … ],
  "dateLearned": "2025-10-01",       // null on 16 contrast entries
  "dateAdded": "2026-07-25",         // when the row entered the spreadsheet
  "mastery": null,                   // the learner's column; empty on every row
  "pronunciationVerified": true,     // false on 186 entries — see below
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
`tokens[start … start+length]` with a blank. `blank.answer` is the *sentence's*
wording, which may differ from the headword: a sentence-final word wears a shad
instead of a tsheg (ཡིན་ → ཡིན།).

### sources, lesson, sourceLessons

156 entries come from more than one source; a word met again in a new text gains
a source rather than a duplicate row. `sources` and `lesson` are the flat forms.
`sourceLessons` is the same information **paired** — one `{source, lesson}` per
lesson segment, so you can say *which* lesson belongs to *which* source. Prefer
it; `lesson` is a single joined string kept for the entry footer.

Two entries (`SYL-003`, `SYL-009`) cite a lesson whose source is missing from
the spreadsheet. Those pairs carry `"source": null, "sourceMissing": true`
rather than a guess. Handle a null source, or filter those pairs out.

## falseFriendGroups

```jsonc
{
  "groupId": 12,
  "members": ["NEC-017","NGO2-050","SYL-001"],   // ཅན་, སྤྱན་ and ཆེན་
  "romanizations": ["CHEN","CHEN","CHEN"],       // parallel to members
  "romanizationsIdentical": true,
  "hideRomanizationOnPrompt": false,
  "note": "All members are romanized CHEN. Showing the pronunciation is harmless
           here — it cannot disambiguate — and is worth showing, because it
           demonstrates that pronunciation will not save you…"
}
```

Groups are **connected components**, so a word listed against two different
partners lands in one group with all of them.

Sizes: 2 members ×33, 3 ×14, 4 ×8, 5 ×2, 6 ×2, 8, 9, 10, 11, and **13 ×1**. The
thirteen-member group merges the "all" words with the plural markers — cap
distractors at three or four when drilling it, or it becomes a lottery.

### Showing the romanization — read this carefully

The leak runs the **opposite way** from the obvious guess.

- **Risk exists when members DIFFER** in romanization (ལས་ LE / ལམ་ LAM / ནས་ NE).
  The learner can answer from the romanization without ever reading the script,
  which defeats the whole point of the drill. → `hideRomanizationOnPrompt: true`
- **No risk when all members SHARE one romanization** (ཅན་/ཆེན་ both CHEN). It
  cannot disambiguate, and showing it teaches the real lesson: pronunciation
  will not help, read the script. → `hideRomanizationOnPrompt: false`

Honour `hideRomanizationOnPrompt`, not `romanizationsIdentical`.
53 of the 64 groups hide it on the prompt; 11 do not.

**Always show the romanization on the answer side, in every card type.** Once the
answer is revealed there is no test left to protect, and the pronunciation is
part of what is being learned. See `meta.cardGuidance`.

Eleven groups share one romanization across all members: `གཞི་/བཞི་` (ZHI),
`ཅན་/སྤྱན་/ཆེན་` (CHEN), `དུ་/འདུ་` (DU), `སྨིན་/མིན་` (MIN), `སྙམ་/མཉམ་` (NYAM),
`སླ་/ལ་` (LA), `འདའ་བ་/ཟླ་བ་` (DA WA), `བོས་/བོད་` (BÖ), `གོང་/དགོངས་` (GONG),
`ཕྱག་/ཆགས་` (CHAK), `དང་/སྡང་` (DANG). These are the hardest and most valuable
cards.

## clozeCards

One per entry whose headword was locatable in its example sentence.
`{cardId, entryId, tibetan, english, tokens, blank}` — same token/blank shape as
`entry.example`. Sentences repeat across cards with different blanks; that is
intentional, but dedupe by `tibetan` if a session feels repetitive.

---

## Things that will bite you

1. **186 entries have `pronunciationVerified: false`** — supplied by me and checked
   for rule-consistency, but not confirmed by a teacher
   (`pronunciationProvenance: "derived – reviewed"`). The app can exclude them.
2. **Romanization cannot disambiguate.** It is a reading aid, not phonetics — no
   tone, no vowel length. The column follows one convention throughout (Tergar
   liturgy: ཟ→Z, ཞ→ZH, བྱ→J), recorded in `meta.romanizationConvention`. Never
   use it as the answer key on a discrimination card — but do show it on reveal.
3. **Tibetan needs real rendering.** Stacked forms like སྙིང་རྗེ་, སྟོང་པ་ཉིད་,
   བསྒྲུབས་ break under fonts with poor coverage. iOS ships *Kailasa*; verify
   visually on a real iPhone, not just a desktop browser. The NGO6 rows are
   doubly worth eyeballing — their script was reconstructed from printed
   phonetics because the Chariot PDF uses a legacy font with no Unicode mapping.
4. **`""` means unknown, not false.** Empty strings are absent data — only 21
   entries have verb stems, 40 are marked honorific, 107 carry volitionality.
   One false friend (`NGO6-017` → སྙེས་) has an empty gloss; render the chip
   without one rather than assuming a string.
5. **Some entries aren't vocabulary.** 43 are particles or grammatical terms
   (ལ་དོན་, རྫོགས་ཚིག་). They make poor recall cards; filter by `category` if a
   drill feels wrong.
6. **`dateLearned` is null** on 16 contrast entries (`SYL-`) — they were added to
   sharpen a distinction, never taught on a date. Most `SYL-` rows *do* now carry
   a date, so do not treat the source code as a proxy for it.
7. **45 entries have no example sentence**, and in 98 more the headword could not
   be located in its sentence. Both mean no cloze card; `entry.example` is null
   in the first case and `entry.example.blank` is null in the second.
