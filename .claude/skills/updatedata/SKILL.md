---
name: updatedata
description: Add vocabulary from a PDF (a chant text, course handout, or grammar deck) to the Tibetan vocabulary workbook and regenerate the app's JSON. Use when the user runs /updatedata with a PDF, or asks to add a new text/source/lesson's words to the dictionary or trainer.
---

# /updatedata — add a PDF's vocabulary to the dictionary

Takes a PDF, extracts its vocabulary, writes a **new dated version** of the
workbook, and regenerates `tibetan_trainer_data.json` from it.

`$1` is the PDF path. If none was given, ask for one — do not guess.

The previous workbook is never edited. Each run produces
`YYYYMMDD Tibetan_Vocabulary_Dictionary.xlsx` in the repo root alongside it, so
every version stays as an archive.

---

## The one thing most likely to go wrong

**The Tibetan in these PDFs usually does not extract correctly.** Every source so
far has failed differently: the Tibetan I grammar slides drop subjoined letters,
Nectar of the Path had a corrupted ToUnicode table, the Kagyü Ngöndro uses legacy
Ededris fonts with no Unicode mapping at all, and the Daily Chants book garbles
vowel placement (`སོས་` for `སྤོས་`, `མེ་ཏགོ་` for `མེ་ཏོག་`, `དག་` for `དགྲ་`).

So: **never paste extracted Tibetan in without checking it.** Read the printed
romanization/phonetics on the page and confirm the script matches it. Where the
script cannot be recovered from the text layer, read it from the page image and
say so in the entry's `notes`, the way the NGO6 rows do. If you cannot resolve a
word confidently, leave it out and tell the user which ones you skipped — a wrong
headword is far worse than a missing one.

**Never Unicode-normalize.** Do not call `unicodedata.normalize`, and do not pipe
Tibetan through anything that might. NFD/NFKC/NFKD all corrupt the stacks.

---

## Steps

### 1. Read the PDF

Use `pdftotext -layout`, the `pdf` skill, or `Read` with a page range. Get both
the Tibetan and whatever romanization and English the page prints — you need all
three to cross-check.

### 2. Work out the source

Look at `tools/source_names.json` and the workbook's **About** sheet.

- **Existing source** (more of a text already covered)? Reuse its code and its
  exact column R name.
- **New source**? Choose a code in the established style — `NGO7` continues the
  Ngöndro series, a Daily Chants prayer gets its own short code like `MAN` or
  `SDED`. Confirm the code and the display name with the user before writing.

Ask the user for the **date learned** if it is not obvious. Do not invent one.

### 3. Decide new row vs. append — this is the rule that matters

**The sheet is one row per word.** A word met again in a new text does *not* get
a second row; its existing row gains a source in column R and a lesson in
column S.

Check every word against column B (exact Tibetan, including the trailing tsheg)
of the current workbook before deciding. `add_entries.py` catches duplicates and
converts them to appends, but it is a safety net, not a substitute for looking.

**Common words do not collect sources.** A word already attested in **3 or more**
sources is common enough that another citation says nothing, and column R would
grow without end. `add_entries.py` skips the append for those automatically and
lists them under "already common"; still send them as `append` items and let it
decide. The threshold is `--common-threshold` (0 disables it).

The point of column R is to show where the *rarer* vocabulary was met. ཆོས་ and
དང་ turning up again is not information; ཐུན་མོང་ turning up in a second text is.

### 4. Write the entries file

A JSON list in the scratchpad. Full schema in `tools/add_entries.py`'s docstring.

```json
[
  {"op": "new",
   "tibetan": "ཞིང་ཁམས་", "romanization": "ZHING-KHAM", "wylie": "zhing khams",
   "english": "pure realm; buddha-field", "category": "noun",
   "sanskrit": "kṣetra",
   "exampleTibetan": "…", "exampleEnglish": "…",
   "notes": "…",
   "related":      [["ཞིང་", "field; realm"], ["དག་པ་", "pure"]],
   "falseFriends": [["ཁམས་", "element; constituent"]],
   "lesson": "Ngöndro 7 v.7a",
   "pronCheck": "derived – reviewed"},

  {"op": "append", "tibetan": "སེམས་", "lesson": "Ngöndro 7 v.7c"}
]
```

Paired columns are written as **pair lists**, so the separators cannot be got
wrong by hand. The script renders `/` between items. Never put a `/` inside a
gloss — it would become an item boundary on re-import, and the script rejects it.
`;` inside a gloss is fine and means multiple senses of that one word.

#### Filling the columns

| field | how |
|---|---|
| `english` | senses separated by `;`. Homographs keep every sense — never truncate |
| `romanization` | Tergar liturgy convention: ཟ→Z, ཞ→ZH, བྱ→J. ALL-CAPS style for Tergar sources. It is a reading aid, not phonetics |
| `category` | part of speech, or a Tibetan grammatical class (`particle (ལ་དོན་)`, `particle (terminating — རྫོགས་ཚིག་)`) |
| `verbStems`, `volitionality`, `register` | **only if the source gives them.** Blank means unknown. Do not guess |
| `sanskrit` | only where there is a standard equivalent |
| `exampleEnglish` | for chant texts, your own **literal line-for-line** rendering following Tibetan word order, implied words in `[brackets]`. The published English redistributes content across lines and must not be copied |
| `related` | systematic relations only: word family, antonym, same grammatical class, honorific/ordinary pair, volitional/non-volitional pair |
| `falseFriends` | **leave empty.** See below |
| `pronCheck` | `from source` if the material prints the pronunciation, `from slides` for the grammar deck, otherwise `derived – reviewed` |
| `mastery` | never fill it. It is the learner's column and the app owns progress |

#### Do not fill in false friends

Two reasons, and the second one bites hard.

The About sheet marks the false-friend columns as the learner's own fill-in
columns ("Left blank for Thomas to supply" — the shading means exactly that).

More importantly, **false friends are edges in a graph, and the groups are its
connected components.** One innocuous-looking pair can weld two groups together
and silently destroy a property the drill depends on. A real example: giving
ཆེ་ཆུང་ (CHÉ CHUNG) the false friends ཆེན་ and ཆུ་ merged the `ཅན་/སྤྱན་/ཆེན་`
group — all romanized CHEN, one of the eleven identical-romanization groups that
`README_DATA.md` calls the most valuable cards — into the CHU group. That flipped
`romanizationsIdentical` to false and `hideRomanizationOnPrompt` to true, turning
a prized card type into a seven-member muddle.

If you believe a new word has a genuine false friend, **propose it to the user**
rather than writing it. And after any run, diff the group structure:

```bash
python3 - <<'PY'
import json, subprocess
old = json.loads(subprocess.run(['git','show','HEAD:tibetan_trainer_data.json'],
                                capture_output=True, text=True).stdout)
new = json.load(open('tibetan_trainer_data.json', encoding='utf-8'))
sig = lambda d: {tuple(sorted(g['members'])): (g['romanizationsIdentical'],
                                               g['hideRomanizationOnPrompt'])
                 for g in d['falseFriendGroups']}
o, n = sig(old), sig(new)
print('groups', len(o), '->', len(n))
print('identical-romanization', sum(v[0] for v in o.values()), '->', sum(v[0] for v in n.values()))
print('unchanged:', o == n)
PY
```

A **falling** group count means a merge. Adding entries should only ever raise it
or leave it flat.

### 5. Build the new workbook

```bash
python3 tools/add_entries.py --entries /path/to/entries.json \
    --source-code NGO7 --source-name "Kagyü Ngöndro 7 – Guru Yoga" \
    --source-short "Guru Yoga"
```

`--source-short` is the Look up scope chip; keep it under ~12 characters and
distinct from every existing one. The script registers the code in
`tools/source_names.json`, assigns IDs, copies row styling, and updates the
About sheet's entry count and build date. Add `--dry-run` to preview.

### 6. Regenerate the JSON

```bash
python3 tools/import_dictionary.py
```

It defaults to the newest dated workbook in the repo root — which is the one you
just wrote. It verifies its own output and exits non-zero on failure.

**Read the report it prints.** It lists paired-column mismatches, lesson segments
whose source is missing, and dropped IDs. A dropped ID means orphaned review
history and should never happen from an add — investigate if you see one.

### 7. Verify and report

Serve the app and confirm it loads (see `CLAUDE.md` for how, including the
service-worker cache gotcha). Then tell the user:

- the new workbook's filename, and that the previous one is untouched
- how many rows were added and how many existing rows gained a source
- **every word you were unsure about** — bad extraction, guessed romanization,
  missing gloss, uncertain sense. This matters more than the counts
- anything the importer report flagged

Do not commit unless the user asks.

---

## Stop and ask rather than guess

- the source code or display name for a new text
- the date learned
- whether an ambiguous word is the same lexical item as an existing row, or a
  genuine homograph needing its own entry
- any Tibetan you cannot confirm against the printed romanization
