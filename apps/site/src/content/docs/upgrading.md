---
title: Upgrading ShipBench
description: Bring a project's scaffolded .shipbench/AGENTS.md and README.md up to date after upgrading ShipBench, without losing the edits you made to them.
group: Guides
order: 4
updated: 2026-11-23
---

Most of a project needs nothing after you upgrade ShipBench. `config.json` is read over the built-in defaults, so new settings arrive without an edit. Task files and `layout.json` need no migration.

The exceptions are `.shipbench/AGENTS.md` and `.shipbench/README.md`. `shipbench init` writes them once and never rewrites them, while the template behind them changes in most releases, usually to document a new command. An out-of-date `AGENTS.md` matters more than an out-of-date README, because an agent follows it. It won't use a command the file doesn't mention, and it keeps following guidance that has since changed.

Both files are yours to edit, and most projects do edit `AGENTS.md`. Replacing it with the new template would throw those edits away, so updating it is a merge.

## Is a file behind?

Run `shipbench init` in the project after upgrading. On an existing project it writes nothing and names each scaffolded file that is behind:

```text no-copy
ShipBench is already initialized for "my-app".
.shipbench/AGENTS.md was written by ShipBench 0.11.0; this is 0.12.0.
To update without losing your edits, see https://shipbench.dev/docs/upgrading/
```

`init` reads this from a stamp on the first line of both files, recording the version that wrote them:

```markdown no-copy
<!-- shipbench-scaffold 0.11.0: keep this line. … -->
```

Keep that line, and keep it first. With it, you can regenerate the exact text your file started from. Files written before 0.11.0 have no stamp, and `init` says the file "records no ShipBench version" instead. See [Files without a stamp](#files-without-a-stamp).

## Updating a stamped file

You need two versions and the project name:

- **The base**: the version in the stamp, here `0.11.0`.
- **The current version**: `shipbench --version`, here `0.12.0`.
- **The name**: `name` in `.shipbench/config.json`. The template uses it in the heading.

### 1. Regenerate both templates

The scaffold depends only on the version and the name, so any published version regenerates its exact text. Run each `init` in a new, empty directory outside the project:

```bash
mkdir ../sb-base ../sb-current
cd ../sb-base && npx shipbench@0.11.0 init --name my-app
cd ../sb-current && npx shipbench@0.12.0 init --name my-app
cd ../my-app
```

You now have three copies of each file: yours, the base it started from, and the current template.

### 2. Replace a file you never edited

Compare your file with its base:

```bash
git diff --no-index --ignore-cr-at-eol .shipbench/README.md ../sb-base/.shipbench/README.md
```

`--ignore-cr-at-eol` matters on Windows, where Git may check the file out with CRLF line endings while `init` writes LF. Without it, every line differs.

If Git shows no diff, the file is still exactly what `init` wrote. Copy the current template over it:

```bash
cp ../sb-current/.shipbench/README.md .shipbench/README.md
```

### 3. Merge a file you edited

```bash
git merge-file -L yours -L "shipbench 0.11.0" -L "shipbench 0.12.0" \
  .shipbench/AGENTS.md ../sb-base/.shipbench/AGENTS.md ../sb-current/.shipbench/AGENTS.md
```

`git merge-file` applies every change between the two templates to your file, in place. Your edits stay, and the stamp moves to the new version.

The command exits with the number of conflicts. A conflict means you and the template changed the same lines, and the file holds both versions between `<<<<<<< yours` and `>>>>>>> shipbench 0.12.0` markers. Edit each one down to the text you want. Expect few: the template keeps each paragraph on one line, so most edits replace whole lines and merge cleanly.

### 4. Read the whole result

A clean merge only means no two changes touched the same lines. New template text can still contradict a rule you wrote somewhere else in the file. For example, if your `AGENTS.md` says finished work goes to `review` and a new paragraph says to move it to `done`, both survive the merge and an agent gets two instructions.

So read the merged file from top to bottom. Wherever new template text contradicts a rule of yours, rewrite it to match the rule. Then review `git diff .shipbench/` and commit. Delete the two directories when you're done.

## Files without a stamp

A file written before 0.11.0 has no stamp, so start by finding out which version wrote it.

**Look for a published version that matches.** Two commands narrow down which versions to try:

```bash
git log --diff-filter=A --format=%as -- .shipbench/AGENTS.md   # when the file was added
npm view shipbench time                                        # when each version was published
```

Regenerate each candidate and compare it with your file as in step 2.

Both files come from the same `init` run, so a `README.md` you never edited also dates your `AGENTS.md`. The README doesn't change every release, so a match can point to several versions. Pick the one that was current when the file was added.

- **A version matches your file exactly.** You never edited it. Replace it with the current template.
- **A version matches your README but not your `AGENTS.md`.** Use that version as the base and merge as in step 3.
- **Nothing matches.** The base is unknown.

**When the base is unknown, don't merge against a guess.** A merge reads every line the base has and your file lacks as one you deleted on purpose. If the guessed base is newer than your file's real one, the lines added since then are missing from your file, so the merge keeps them out. Compare against the current template instead:

```bash
git diff --no-index --ignore-cr-at-eol .shipbench/AGENTS.md ../sb-current/.shipbench/AGENTS.md
```

Sort each difference by hand. If it's template text that has changed since, take the current wording. If it's a rule your project added, keep it. Then start from the current template, reapply your rules, and read the whole result as in step 4. The new file carries a stamp, so the next upgrade can use a merge.

## Doing it with an agent

Each step runs from a shell, so an agent can do the update. Give it this page or the steps, and ask it to list every project rule it kept and every conflict it resolved. Then check that list against the diff yourself. The contradiction check in step 4 is the part that needs judgment, whoever runs the rest.

## Keeping updates small

Every rule you write into `.shipbench/AGENTS.md` is a line the next merge has to carry. Rules about how your project works, rather than how to operate the board, can go in your repository's root `AGENTS.md`, which ShipBench never writes. See [Where conventions live](/docs/workflows/#where-conventions-live).
