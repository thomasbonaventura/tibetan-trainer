# Tibetan Trainer

A personal Tibetan vocabulary trainer. Installable PWA, no build step, no
dependencies, no framework — plain ES modules served as static files. Written
for one user studying Tergar/Kagyü liturgy and Tibetan I grammar.

**Do not add a build step, a bundler, or a runtime dependency** unless asked.
The whole thing is meant to be openable by double-clicking `index.html` and
deployable by pushing.

---

## Two things to know before touching anything

**1. This repo is public and GitHub Pages serves the repo root.**
`https://thomasbonaventura.github.io/tibetan-trainer/` is live, and anything
committed at root is downloadable — including `tibetan_trainer_data.json` and
the `.xlsx`. There has already been one cleanup commit for leaked authoring
notes. Do not add anything to this repo you would not publish.

**2. Never Unicode-normalize Tibetan.**
Tibetan stacks are sequences of separate codepoints (subjoined U+0F90–U+0FBC).
NFD, NFKC and NFKD all corrupt this data — verified against the workbook. Do not
call `unicodedata.normalize` or `String.prototype.normalize` on Tibetan text.
(`search.js` does use NFD, but only to fold É/Ö/Ü in the *romanization* column —
never on the Tibetan.)

---

## The data pipeline

```
YYYYMMDD Tibetan_Vocabulary_Dictionary.xlsx   ← hand-authored, content-authoritative
        │  tools/add_entries.py               ← adds rows, writes a NEW dated workbook
        ▼
tools/import_dictionary.py                    ← the ONLY thing that parses the xlsx
        ▼
tibetan_trainer_data.json                     ← the ONLY thing the app reads
        ▼
js/data.js → the app                          localStorage ← progress lives here
```

- The **spreadsheet is content-authoritative**; the **app is progress-authoritative**.
  Review progress (Leitner boxes) lives in localStorage keyed on `entry.id` and
  is never in the JSON. Column T (`Mastery`) is the learner's own column and is
  empty; it is not the app's progress field.
- **`entry.id` is a permanent key.** Never renumber, reuse, or change one — that
  orphans review history. The importer reports dropped IDs; that should never
  happen from an add.
- Regenerating is just replacing the JSON: `data.js` fetches it `no-cache` and
  the service worker is network-first for that path.

Full data contract: **`README_DATA.md`**. Read it before changing anything that
consumes the JSON.

### Commands

```bash
python3 tools/import_dictionary.py                     # newest workbook in repo root
python3 tools/import_dictionary.py --dry-run           # report only
python3 tools/import_dictionary.py --sample-ids TIB1-041,NGO6-017
python3 tools/add_entries.py  --entries new.json --source-code NGO7 \
    --source-name "…" --source-short "…"               # add words
python3 tools/edit_entries.py --edits fixes.json --dry-run   # correct words
```

All need `openpyxl` (`pip3 install openpyxl`). There is no `requirements.txt`
and no venv; it is installed globally on the author's machine.

Use the skills rather than driving these by hand: **`/updatedata`** to add a
PDF's vocabulary, **`/fixdata`** to correct an existing entry. They encode the
extraction hazards, the column conventions, and the checks that matter.

Neither script edits a workbook in place. Each writes the next dated version
(`YYYYMMDD …`, or `YYYYMMDD HHMM …` for a second one the same day) and leaves
the previous as the archive. `entry.id` is never rewritten.

**A gloss lives in more than one place.** A word's English is in its own row and
repeated in every row that lists it as a related word or false friend. Correct it
with `edit_entries.py`'s `regloss`, never by editing one cell — otherwise the
copies go stale and nothing flags it.

**False friends are graph edges; the groups are connected components.** Adding a
pair can merge two groups, removing one can split a group. A merge that collapses
an identical-romanization group destroys the app's most valuable card type. After
any change to that column, diff the group structure — both skills show how.

**Common words stop collecting sources.** A word already in 3+ sources does not
gain another when it turns up again (`--common-threshold`, default 3). Column R
exists to show where the *rarer* vocabulary was met; ཆོས་ appearing in a sixth
text is not information.

### A card must have exactly one right answer

`drills/discrimination.js` filters out group members that share an English gloss
before building options. Without it, ཡིད་ and སེམས་ (both "mind") appear as two
identical buttons and whichever the learner picks, one is marked wrong — a bug in
the card, not a mistake by the learner. It bites in both directions: in `en-ti`
the *prompt* "mind" matches two of the Tibetan options.

Entries whose only group partners share their gloss drop out of the drill
entirely. That is correct, but it means **an imprecise gloss silently costs you a
card** — fix the gloss and the card comes back.

### Adding a source

`tools/source_names.json` maps source code → `{name, short}`. `add_entries.py`
registers new codes automatically. Nothing in Python or JS needs editing when a
source is added — if you find yourself hardcoding a source code anywhere, that
is a bug.

---

## App architecture

Entry point `index.html` → `js/main.js`. Everything is an ES module; there is no
framework and no state library. `main.js` owns the mode switching, the filter
sheet, and a `ctx` object it hands to each view.

| module | role |
|---|---|
| `data.js` | fetches the JSON, builds lookup Maps (`entriesById`, `groupsById`, `clozeByEntryId`) |
| `storage.js` | localStorage: Leitner boxes (`ProgressStore`), filters, settings. Box intervals 0/0/1/3/7/14 days |
| `filters.js` | source / date-learned / unverified-pronunciation filtering; backfills filter state when the data gains a new source |
| `queue.js` | shared "what's next": due-and-new first, random not-yet-due as fallback so a drill never dead-ends |
| `session.js` | *within-session* scheduling for recall — a relearning queue and a cohort of N words, so a missed word comes back instead of vanishing into 500 others |
| `search.js` | Look up matching. Three normalizers, because romanization, English and Tibetan each fail differently |
| `entry-view.js` | shared entry rendering, used by Look up and the discrimination drill |
| `lookup.js` | Look up mode, incl. the source scope chips |
| `drills/discrimination.js` | false-friend groups → "which is correct?" |
| `drills/cloze.js` | fill the blank in an example sentence |
| `drills/recall.js` | plain recall, driven by `session.js` |

### The romanization rule — get this right

It is a reading aid, not phonetics. On **discrimination** cards it must be
hidden on the prompt when a group's members are told apart *by* their
romanization (`hideRomanizationOnPrompt: true`), because otherwise the learner
answers without reading the script. Where all members share one romanization it
is safe and useful to show.

Honour `hideRomanizationOnPrompt`, not `romanizationsIdentical`. **Always show
it on the answer side, in every drill.** See `meta.cardGuidance` and the longer
explanation in `README_DATA.md`.

---

## Gotchas that have already cost time

1. **Changing anything in `js/` requires bumping `SHELL_CACHE` in `sw.js`.**
   Shell files are cache-first; an installed PWA will serve the old module
   forever otherwise. The data file is exempt — it is network-first.
2. **The browser also caches ES modules.** When testing locally, a stale module
   can survive a service-worker unregister. Serve on a fresh port to be sure.
3. **`""` means unknown, not false.** Only 21 entries have verb stems, 40 are
   honorific. Render nothing rather than assuming a string is present.
4. **Not every entry is drillable.** 45 have no example sentence, 98 more have
   an example whose headword could not be located (so no cloze card), and 43 are
   particles or grammatical terms that make poor recall cards.
5. **Spreadsheet separators are not what they look like.** In the paired columns
   `/` separates items and `;` separates senses *within* one item. Splitting on
   `;` truncates homographs like ལས་. Sources split on `;`, lessons on `|`.
6. **Tibetan rendering needs a real font.** Stacks like སྙིང་རྗེ་, བསྒྲུབས་ break under
   poor coverage. iOS ships *Kailasa*; the sheet uses *Kokonor*. Verify on a real
   iPhone, not just a desktop browser.

---

## Verifying a change

There are no tests. Verify by running it:

```bash
python3 -m http.server 8731
```

Then load `http://localhost:8731/`, and check **all four modes** — Discriminate,
Cloze, Recall, Look up — with the console open. Most regressions here show up as
a thrown error in one mode only, because each drill reaches into different parts
of the data.

After a data change, `import_dictionary.py` self-verifies (round-trip and
lesson-preservation assertions) and exits non-zero on failure — read its report
rather than assuming success.

---

## Conventions

- Match the surrounding style: comments explain *why*, not what, and several
  say why an obvious-looking alternative is wrong. Keep that.
- Prose in the UI and in data files uses real typographic characters (– — “ ” …).
- Do not commit unless asked. Do not push unless asked.
