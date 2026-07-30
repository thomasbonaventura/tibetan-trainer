#!/usr/bin/env python3
"""Propose false-friend candidates for words, WITHOUT changing anything.

Suggestions only. The false-friend columns are the learner's to fill, so this
prints a ranked table for a human to accept or reject; nothing is written.

    python3 tools/suggest_false_friends.py --entries staged.json   # before adding
    python3 tools/suggest_false_friends.py --ids TWD-001,TWD-005   # already added
    python3 tools/suggest_false_friends.py --source TWD            # a whole source

WHAT MAKES A FALSE FRIEND HERE
A pair worth drilling is one the eye confuses on the page. Two signals carry
almost all of it:

  same romanization   ཤི་ / གཤིས་ both SHI. The strongest signal there is: the
                      words are indistinguishable by sound, so only the script
                      tells them apart, which is the entire drill.
  near-identical script  གཞི་ / བཞི་ differ by one codepoint. The eye slides
                      straight past the difference.

WHY IT REPORTS GROUP IMPACT
False friends are edges in a graph and the groups the drill uses are its
connected components, so one new pair can weld two groups into one. That is not
hypothetical: linking ཆེ་ཆུང་ to both ཆེན་ and ཆུ་ once merged the ཅན་/སྤྱན་/ཆེན་
group — all romanized CHEN, one of the eleven identical-romanization groups that
README_DATA.md calls the most valuable cards — into the CHU group, flipping it
out of that category. Every candidate below therefore says what it would do to
the group structure, and MERGE candidates are flagged for extra scrutiny.
"""

import argparse
import collections
import json
import pathlib
import re
import sys
import unicodedata

DATA = pathlib.Path(__file__).resolve().parent.parent / "tibetan_trainer_data.json"
MAX_SUGGESTIONS = 4


def fold_romanization(s):
    """'SÖL-WA' and 'solwa' both fold to 'solwa'."""
    stripped = "".join(c for c in unicodedata.normalize("NFD", (s or "").lower())
                       if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", stripped)


def syllables(tibetan):
    """Tibetan split on the tsheg, punctuation dropped."""
    cleaned = (tibetan or "").strip().strip("།༎ ")
    return [s for s in cleaned.split("་") if s]


def edit_distance(a, b):
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def score(new, other):
    """(rank, reason) for a candidate pair, or None if not worth proposing."""
    if new["tibetan"] == other["tibetan"]:
        return None

    a, b = new["tibetan"].rstrip("་"), other["tibetan"].rstrip("་")
    dist = edit_distance(a, b)
    same_rom = (fold_romanization(new["romanization"])
                == fold_romanization(other["romanization"])
                and fold_romanization(new["romanization"]))
    # Only compare words of similar shape; ཆོས་ and a four-syllable phrase are
    # never mistaken for one another however many letters they share.
    if abs(len(syllables(new["tibetan"])) - len(syllables(other["tibetan"]))) > 1:
        return None

    if same_rom and dist <= 3:
        return (0, f"identical romanization ({new['romanization']}), {dist} letter(s) apart")
    if dist == 1:
        return (1, "one letter apart")

    # Two letters apart is only meaningful when the difference is in the ROOT.
    # Most Tibetan nouns end in the same nominaliser (པ་ / བ་ / མ་), so without
    # this ཐེག་པ་ "collides" with རིག་པ་, དག་པ་ and ཉེས་པ་ — words sharing nothing
    # but a suffix, which no reader has ever confused.
    if dist == 2:
        root_a = syllables(new["tibetan"])[0] if syllables(new["tibetan"]) else ""
        root_b = syllables(other["tibetan"])[0] if syllables(other["tibetan"]) else ""
        root_dist = edit_distance(root_a, root_b)
        same_shape = len(syllables(new["tibetan"])) == len(syllables(other["tibetan"]))
        if root_dist == 0:
            return (2, "two letters apart, same root syllable")
        if root_dist == 1 and same_shape:
            return (2, "two letters apart, roots one letter apart")
    return None


def first_sense(entry):
    return (entry.get("english") or "").split(";")[0].strip().lower()


def gloss_clash(a, b):
    """Whether a pair is undrillable because the two mean the same thing.

    A false friend must look alike but MEAN something different. If the glosses
    match, the discrimination drill has no single right answer and filters the
    pair out again (see drills/discrimination.js), so proposing it is wasted
    effort — worse, it can drag a good group into uselessness.
    """
    ea, eb = (a.get("english") or "").strip().lower(), (b.get("english") or "").strip().lower()
    if ea and ea == eb:
        return "identical gloss — the drill cannot use this pair"
    if first_sense(a) and first_sense(a) == first_sense(b):
        return f"same leading sense (“{first_sense(a)}”) — near-synonyms, weak as a card"
    return None


def components(entries, extra_edges=()):
    """Connected components over the false-friend relation."""
    by_tibetan = collections.defaultdict(list)
    for e in entries:
        by_tibetan[e["tibetan"]].append(e["id"])
    parent = {e["id"]: e["id"] for e in entries}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for e in entries:
        for ff in e["falseFriends"]:
            for other in by_tibetan.get(ff["tibetan"], []):
                union(e["id"], other)
    for a, b in extra_edges:
        if a in parent and b in parent:
            union(a, b)

    groups = collections.defaultdict(set)
    for eid in parent:
        groups[find(eid)].add(eid)
    return {frozenset(v) for v in groups.values() if len(v) > 1}


def group_impact(entries, new_id, other_id, by_id):
    """What adding this edge would do to the group structure."""
    before = components(entries)
    after = components(entries, extra_edges=[(new_id, other_id)])
    if before == after:
        return "no change"

    def identical_rom(group):
        roms = {by_id[i]["romanization"] for i in group}
        return len(roms) == 1

    lost = [g for g in before if g not in after]
    gained = [g for g in after if g not in before]
    merged = [g for g in lost if len(g) > 1]

    if len(merged) >= 2:
        damaged = [g for g in merged if identical_rom(g)]
        note = f"MERGES {len(merged)} existing groups"
        if damaged:
            words = ", ".join(by_id[i]["tibetan"] for g in damaged for i in g)
            note += f" — and DESTROYS an identical-romanization group ({words})"
        return note
    if merged:
        size = len(gained[0]) if gained else 0
        return f"joins an existing group (now {size} members)"
    return "creates a new 2-member group"


def load_targets(args, data):
    by_id = {e["id"]: e for e in data["entries"]}
    if args.ids:
        missing = [i for i in args.ids.split(",") if i.strip() and i.strip() not in by_id]
        if missing:
            sys.exit(f"unknown ids: {missing}")
        return [by_id[i.strip()] for i in args.ids.split(",") if i.strip()], False
    if args.source:
        found = [e for e in data["entries"] if e["sourceCode"] == args.source]
        if not found:
            sys.exit(f"no entries with sourceCode {args.source!r}")
        return found, False
    with open(args.entries, encoding="utf-8") as fh:
        staged = json.load(fh)
    # Staged rows are not in the data yet; give them a placeholder id so the
    # graph simulation can reason about them.
    out = []
    for i, item in enumerate(staged):
        if item.get("op", "new") != "new":
            continue
        out.append({"id": f"STAGED-{i:03d}", "tibetan": item.get("tibetan", ""),
                    "romanization": item.get("romanization", ""),
                    "english": item.get("english", ""), "falseFriends": [],
                    "sourceCode": "STAGED"})
    return out, True


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--entries", help="staged entries JSON, before adding")
    src.add_argument("--ids", help="comma-separated entry ids already in the data")
    src.add_argument("--source", help="every entry with this source code")
    ap.add_argument("--max", type=int, default=MAX_SUGGESTIONS,
                    help=f"suggestions per word (default {MAX_SUGGESTIONS})")
    args = ap.parse_args()

    with DATA.open(encoding="utf-8") as fh:
        data = json.load(fh)
    targets, staged = load_targets(args, data)

    entries = data["entries"]
    if staged:
        entries = entries + targets
    by_id = {e["id"]: e for e in entries}

    any_found = False
    for target in targets:
        ranked = []
        for other in data["entries"]:
            if other["id"] == target["id"]:
                continue
            existing = {ff["tibetan"] for ff in target.get("falseFriends", [])}
            if other["tibetan"] in existing:
                continue
            result = score(target, other)
            if result:
                ranked.append((result[0], result[1], other))
        ranked.sort(key=lambda r: (r[0], r[2]["id"]))

        print(f"\n{target['tibetan']}  {target['romanization']}  "
              f"— {target['english'][:52]}")
        if not ranked:
            print("    (no candidates)")
            continue
        any_found = True
        for rank, reason, other in ranked[:args.max]:
            impact = group_impact(entries, target["id"], other["id"], by_id)
            clash = gloss_clash(target, other)
            flag = "  ⚠" if ("MERGE" in impact or "DESTROYS" in impact or clash) else ""
            print(f"    {other['tibetan']:14} {other['romanization']:12} "
                  f"{other['english'][:34]:36} [{other['id']}]")
            print(f"        {reason}; {impact}{flag}")
            if clash:
                print(f"        ⚠ {clash}")

    print("\n" + "-" * 72)
    print("Suggestions only — nothing was written." if any_found else
          "No candidates found — nothing to review.")
    print("Accept by adding the pairs to the staged entries' \"falseFriends\", "
          "then run add_entries.py.")


if __name__ == "__main__":
    main()
