---
name: fixdata
description: Correct a mistake in the Tibetan vocabulary data — a wrong gloss, romanization, category, note, or false-friend pairing — and regenerate the app's JSON. Use when the user reports an error in the dictionary or spreadsheet, says a word's meaning is wrong, or asks to fix or change an existing entry.
---

# /fixdata — correct existing vocabulary entries

Corrections go through `tools/edit_entries.py`, which writes a **new dated
version** of the workbook. The previous version is never edited, and `entry.id`
never changes, so review progress in localStorage survives every correction.

---

## Why not just edit the spreadsheet by hand

**A gloss is stored in more than one place.** `དེ་` carries its English in its own
row, and every *other* row that lists དེ་ as a related word or a false friend
repeats that gloss in its own paired column. Fixing the headword by hand leaves
the copies stale, and the Look up chips go on showing the old meaning — a silent
inconsistency that nothing will flag.

`regloss` rewrites all of them in one operation and prints every change.

---

## How the user will report it

In prose, usually terse, often several at once — "DE means that but NOT those".
That is fine and expected. Do not ask them to use a format. Your job is to turn
it into operations, and to notice what is missing.

Three things make a report actionable without a follow-up question:

| | example | if missing |
|---|---|---|
| **which entry** | `TIB1-019`, or `དེ་`, or "the DE that means that" | ask — never guess between two entries |
| **which field** | "the meaning", "the pronunciation", "the note" | usually inferable from what they quote |
| **what it should say** | "just 'that'" | **ask** — do not invent replacement wording |

An **entry id** or the **Tibetan** identifies a row exactly. A **romanization
alone does not** — the whole premise of this dictionary is that different words
share one romanization (ཅན་, སྤྱན་ and ཆེན་ are all CHEN). If a report names only
a romanization and more than one entry matches, list the matches and ask.

If the user says something is wrong but not what it should be, research it and
**propose** wording rather than leaving it or inventing it silently.

### Batch them

Every run costs one workbook version, one import and one verification pass,
regardless of how many cells change. Ten corrections in one run cost the same as
one. If the user reports a mistake and is likely to find more, say so and offer
to collect them — but never sit on a correction they asked for now.

## Steps

### 1. Find the true extent of the mistake

Before writing anything, find **every** place the wrong text appears.

```bash
python3 - <<'PY'
import json
d = json.load(open('tibetan_trainer_data.json', encoding='utf-8'))
WORD = 'དེ་'          # the headword being corrected
for e in d['entries']:
    if e['tibetan'] == WORD:
        print('HEADWORD', e['id'], repr(e['english']))
    for kind in ('related', 'falseFriends'):
        for it in e[kind]:
            if it['tibetan'] == WORD:
                print(f"  {e['id']:9} {kind:12} = {it['english']!r}")
PY
```

Report the full list to the user before changing it. A correction that looks like
one cell is usually six.

### 2. Confirm the exact wording

Users describe corrections in shorthand — "DE means that but NOT those". Do not
guess the replacement text. Confirm the exact string, and ask whether related
entries are affected too. Watch for entries that are *correctly* different:
`དེ་དག་` legitimately means "those (plural)" and must not be swept up in a fix to
`དེ་`.

### 3. Write the edits file

```json
[
 {"op": "set",     "id": "TIB1-019", "english": "that"},
 {"op": "regloss", "tibetan": "དེ་", "from": "that; those", "to": "that"},
 {"op": "unlink",  "id": "NEC-026", "column": "falseFriends", "tibetan": "དེ་"}
]
```

**Always pass `from` on a regloss.** It restricts the rewrite to cells whose gloss
matches exactly, and the tool reports every cell it skipped. Without it you can
silently overwrite wording that was deliberately different.

`set` accepts any column by short name; `related` and `falseFriends` take pair
lists and replace the whole column. Full reference in the script's docstring.

### 4. Dry run, then apply

```bash
python3 tools/edit_entries.py --edits fixes.json --dry-run   # prints every before/after
python3 tools/edit_entries.py --edits fixes.json
python3 tools/import_dictionary.py
```

Read the dry run properly. The `!!` lines list cross-references left alone
because they did not match `from` — check each one is genuinely already correct
rather than differently wrong.

### 5. Check the false-friend groups did not shift

Only needed when a correction touches the `falseFriends` column, but cheap:

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

False friends are edges in a graph and the groups are its connected components,
so **removing** an edge can split a group and **adding** one can merge two. A
merge that collapses an identical-romanization group destroys the most valuable
card type in the app — see `README_DATA.md`. If the count moved, say so and
explain which groups changed.

### 6. Verify and report

Confirm zero stale references remain (re-run the step-1 query), then serve the
app and check Look up renders the corrected entry. Report:

- every cell changed, old → new
- anything the `from` guard skipped
- any group-structure change
- the new workbook filename, and that the previous one is untouched

Do not commit unless the user asks.

---

## Housekeeping

Each run adds a dated workbook. Several in one day is normal while iterating —
the format is `YYYYMMDD HHMM …` after the first of the day. Intermediate versions
that were never committed can be deleted; suggest it rather than doing it.
