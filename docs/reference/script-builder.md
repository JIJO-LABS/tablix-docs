# 19 · Script Builder

The Script Builder writes a Tablix script for you. You open a data file, tick the questions to
tabulate, and Tablix generates a plain `.mrs` script, checks it, and runs it. Nobody has to type
MRScript.

There are two ways in:

- the **Build** mode of the desktop app (see the [tutorial](../tutorial/build-tables.md)), and
- the command **`mrscript generate`**, described below.

Both use the same **job file** and the same rules.

---

## The job file (`.tbjob`)

A job records what you ticked. It does **not** store the question list: that is read from the data
each time the job is opened, so the job stays small and follows the data.

The file is JSON (UTF-8). Questions are named by their **question name** (`S8`), never by column
position (`A_S8_1`), so a job still works when the final data replaces the dummy data.

```json
{
  "format": "tablix-job",
  "version": 1,
  "data": {"path": "../Data/survey.sav", "respid": "RespID", "weight": "wgt"},
  "tables": ["gender", "age_group", "Q3", "Q4", "Q5", "Q6"],
  "banner": ["gender", "age_group"],
  "reversed": ["Q5"],
  "total": {"show": true, "label": "Total"},
  "sig": {"on": true, "levels": [95]},
  "export": {"layout": "single_sheet", "theme": "classic"},
  "last_written": {"script": "survey.mrs", "sha256": "…"}
}
```

| Field | Meaning |
|-------|---------|
| `format`, `version` | `"tablix-job"`, and `1`, or `2` when the job has `edits`. A job made by a newer Tablix is refused with a clear message. That includes a version 2 job opened in an older Tablix, which would otherwise ignore your changes and write a different script. |
| `data.path` | The data file. A relative path is relative to the **job's folder**. |
| `data.respid` | The respondent ID column, or `null`. Written as `%RESPID`. |
| `data.weight` | The weight column, or `null`. Written as `WEIGHT` in `FORMAT`: every table is weighted. |
| `tables` | Question names ticked as **Table**. |
| `banner` | Question names ticked as **Banner**. Single, multi-select and scale questions only. |
| `reversed` | Scales where code 1 is the **best** point. See [Rating scales](#rating-scales). |
| `edits` | Optional. What you changed from what Tablix found, by question name. See [Changing what Tablix found](#changing-what-tablix-found). Makes the file version 2. |
| `total.show`, `total.label` | Show the Total column, and its label. |
| `sig.on`, `sig.levels` | Significance letters, and one or two confidence levels (between 50 and 100). Two levels give UPPERCASE / lowercase letters. Needs a banner. |
| `export.layout` | `single_sheet` (default: **Index**, **Count**, **Percentage** sheets) or `multi_sheet`. Used by the desktop Export. |
| `export.theme` | Kept in the file. The desktop uses the theme from **Settings ▸ Excel Output Format…**. |
| `last_written` | The name and SHA-256 of the script this job last wrote **beside the job** (its own `.mrs`). Used by the [overwrite guard](#the-overwrite-guard). |
| `also_written` | Optional. Copies written somewhere else with `-o`: the script's path (relative to the job's folder, or absolute) and its SHA-256. Also used by the overwrite guard. |

Unknown top-level keys are kept when the job is saved again. Unknown keys *inside* `data`, `total`, `sig` or
`export` are not. The file is written atomically.

The order of `tables` and `banner` does not matter: the script always follows the order of the
questions in the data file.

---

## How questions are found

Every guess is shown on the Build screen, and you can change it.

| Kind | How it is recognised |
|------|----------------------|
| **Respondent ID** | A column named like an ID (`SbjNum`, `respid`, `id`, `serial` …) whose values are all different and never blank. |
| **Weight** | A column the file marks as a weight, or a numeric, unlabelled column named `weight`, `wgt` or `wt…`. |
| **System column** | An interview-data column from SurveyToGo (`Srvyr`, `Duration`, `Latitude`, `StopQ` …). Hidden, cannot be ticked. |
| **Multi-select** | Two or more neighbouring columns `<stem>_<k>` that hold only 0, 1 or blank. `A_S8_1 … A_S8_99` become one question `S8` (a leading `A_` is dropped). The answer code is `k`. The answer label is the column's label for code 1 (SurveyToGo) or, for a `{0 "No", 1 "Yes"}` column, the part of the column title that differs ("Q7. Seen ads (TV)" → `TV`). |
| **Scale** | 3 to 11 labelled codes in a row, with scale words in the labels (or a numeric variable). A few extra codes (98, 99 "Don't know") are allowed. |
| **Numeric** | A numeric column with no value labels (age, spend, counts). A table with mean, std dev and n. Cannot be a banner. |
| **Open end** | A text column. Hidden by default, cannot be ticked. |
| **Single** | Everything else with value labels. |

Titles and labels have runs of spaces collapsed and the SurveyToGo line-break token (`@@_@@`) removed.
Nothing else is rewritten.

**Pre-ticked as Table:** every single, multi-select, scale and numeric question, except one with more
than 100 answers (a labelled serial number, for example) and one whose column name Tablix cannot use yet
(below). A question nobody answered is ticked too; it prints a table with a `Base` row of 0.

**Names Tablix cannot use yet.** A script refers to a column as `$name`, and the script language allows only
ASCII letters, digits and `_` (not starting with a digit). SPSS allows more, for example `Q1.a`, `Q#3`, `Q$4`,
`Qé5`. A question built on such a column (any of its columns, for a multi-select) cannot be a table or a banner
column. It is greyed out on the Build screen with a note in the **Notes** column, left out of the starter job
(`mrscript generate --new` lists them), and named in the Problems panel if a job ticks it anyway. Rename the
column in the data file to use it. The same applies to the respondent ID and weight columns.

## Changing what Tablix found

Detection is a guess. On the Build screen, **right-click a question** (or double-click its **Type**) to change it,
or use **New multi-select…**. A changed question is **bold with a `*`** in the Type column, and its Notes say what Tablix
had found. **Undo my change** puts it back.

| Change | When | What you get |
|--------|------|--------------|
| **This is not a scale: make it a single question** | a scale | plain answers: no TOP 2 / BOTTOM 2 BOX, no mean |
| **This is a rating scale: choose its points…** / **Scale points…** | a single with 3 or more coded answers / a scale | the house scale layout over the points you choose (3 to 11, whole-number codes, every point an answer). Answers outside the points, for example `9 Not applicable`, are listed but not scored. |
| **Edit the columns of this multi-select…** | a multi-select | one multi-select over exactly the 0/1 columns you tick, with the title you type. A column you leave out becomes its own question (not ticked). |
| **New multi-select…** / **Put this column into a multi-select…** | any 0/1 column | a multi-select made by hand: a name (letters, digits and `_`), a title, and the columns. It takes the place of its first column. A column moves out of the group or the split it was in. |
| **Split into one question per column** | a found multi-select | each column becomes the plain question it would have been alone (a Yes / No table against everyone). Not a one-answer multi-select: its base would be only the people who ticked it, so it would always read 100%. |

Only a column that holds **only 0, 1 or blank** can be an answer of a multi-select. The respondent ID and the weight
cannot. Every problem is named; a change that cannot be made changes nothing.

In the job file the changes are `edits`, keyed by question name:

```json
"edits": {
  "q10":    {"type": "single"},
  "kids":   {"type": "scale", "points": [1, 5]},
  "Q5":     {"type": "multi", "columns": ["A_Q5_1", "A_Q5_2"], "left_out": ["A_Q5_99"], "title": "Brands bought"},
  "MEDIA":  {"type": "multi", "columns": ["use_tv", "use_radio"], "title": "Media used"},
  "Q7":     {"type": "split", "columns": ["Q7_1", "Q7_2"]}
}
```

| Edit | Keys |
|------|------|
| `single` | none |
| `scale` | `points`: `[lowest, highest]` |
| `multi` | `columns` (in the order shown), optional `title`, optional `left_out` (columns of a *found* group you removed on purpose) |
| `split` | `columns`, optional `left_out` |

An unknown type or key is refused, not ignored.

**When the data changes.** Edits follow the data like ticks do. Every column or question an edit names that the data
lacks is listed at once. And if the final data has an **extra answer column in a group you changed** (the final data
adds `A_Q5_4`), that column is **never silently lost**: it appears as its own question, not ticked, with a warning, until
you add it to the group or leave it out on purpose.

---

## What is written

The generated script is plain `.mrs`: no loops, no `#` directives. An expert can read it as it is.
Its parts, in order:

1. A header: `GENERATED by Tablix Script Builder from <job> — do not edit.`
2. `SOURCE` and `%RESPID`.
3. `CONFIG` with `SIG_CONFIDENCE` (only when significance is on and there is a banner).
4. A `DERIVE` for each **multi-select** and each **scale** that is a table.
5. `BANNER Main`, then `FORMAT` (`STATS`, `BANNER`, `SHOW_TOTAL`, `WEIGHT`).
6. One `TABLE` per ticked question.

| Question | As a table | As a banner section |
|----------|------------|---------------------|
| **Single** | `STUBS $col` | its answers |
| **Multi-select** | a `DERIVE @name` with one `STUB k WHERE $col = 1` per answer, then `STUBS @name` | its answers (they can overlap) |
| **Scale** | a `DERIVE @name_scale` in the layout below, with `STATS + mean, std_dev, std_error` | its scale points, from the source column, with no box columns |
| **Numeric** | `STUBS $col` with `STATS mean, std_dev, n` | not allowed |

A derived name is never the same as a data column. (`@x` and `$x` share one column, so a `DERIVE @S8`
next to a source column `S8` would silently overwrite it.) A name that would clash gets a suffix.

The builder never writes a `FOOTER`, a note or a caveat on a table. (With significance on, the engine adds its own
one-line legend under each table that has letters; it is not a `FOOTER`, and it disappears when significance is off.)

**Weighted jobs.** The detected weight is written as `WEIGHT` in `FORMAT`, so every table is weighted: percentages,
means, std dev, std error and counts use the weights, and every output format shows the numbers the Output tab shows
(base rows *Base (wtd)*, *Base (unwtd)*, *Effective base*; see [the same numbers in every
format](output.md#same-numbers)). Only the answer list on the Build screen, before you run, counts people. See the
[tutorial](../tutorial/build-tables.md#weighted-counts-what-you-see-where).

### Rating scales

```mrscript
DERIVE @Q4_scale
    LABEL "Q4. How satisfied are you with your usual coffee?"
    SCORE 1 = 1 SCORE 2 = 2 SCORE 3 = 3 SCORE 4 = 4 SCORE 5 = 5
    STUB 1  "Very dissatisfied" WHERE $Q4 = 1
    …
    STUB 5  "Very satisfied" WHERE $Q4 = 5
    STUB 99 "Don't know" WHERE $Q4 = 99
    STUB 97 "TOP 2 BOX" WHERE $Q4 IN (4, 5)
    STUB 98 "BOTTOM 2 BOX" WHERE $Q4 IN (1, 2)
END DERIVE
```

- Scale points come first, **in code order**, with their own labels.
- **TOP 2 BOX** and **BOTTOM 2 BOX** follow as two plain rows. Mean, Std Dev and Std Error come last.
- `SCORE` is on the scale points only. The box rows and off-scale codes (Don't know) carry **no score**, so they
  never enter the mean. They still count in the base, as in the source variable.
- Only scales with **4 or more points** get box rows. A 3-point scale gets a mean only.
- The box rows use stub codes 97 and 98, or the next two free codes if the question already has them.

**Reversed** (code 1 is the best point): the boxes come from the other ends (TOP 2 BOX = the two
**lowest** codes), and each code is scored `lo + hi − code`, so **a higher mean is always better**.
The scale points still print in code order. Tablix pre-ticks Reversed when code 1's label reads as the best
point ("Excellent", "Strongly agree", "Definitely would buy"…) and the last point's label does not. If it
sees that in a job where you did not tick it, `mrscript generate` prints a warning and the Build screen shades
the box, because TOP 2 BOX would then hold the worst answers.

---

## Checks

### Problems

The Problems panel (and `mrscript generate`) separates:

- **Errors**, which stop the script: a question the job names is not in the data (with where it is used:
  *table*, *banner*, *reversed*, *respondent ID*, *weight*), a question that cannot be what it is ticked as, or a change you
  made that does not fit the data (a column it names is missing, is not a 0/1 column, a scale point is not an answer …).
  **Every** such item is listed, not just the first.
- **Warnings**, which do not: a scale that reads as reversed but is not marked, no tables ticked, or an answer column the
  final data adds to a group you changed ([see above](#changing-what-tablix-found)).

### Validation

The builder validates every script it writes against your data before it is saved. If Tablix rejects a
script the builder wrote, that is a bug in the builder, and the message says so.

### The overwrite guard

The job stores the hash of the script it last wrote beside the job (`last_written`), and the hash of every copy
it wrote elsewhere with `-o` (`also_written`, one entry per path). Writing a copy never changes the record of the
job's own script, so it cannot make that script look edited. Before writing again, the builder compares the
recorded hash with the file on disk (ignoring line-ending style and a byte-order mark):

| Status | Meaning | What happens |
|--------|---------|--------------|
| free | no file there | written |
| ours | the file is exactly what this job last wrote | replaced |
| edited | this job wrote it, then it was changed by hand | **asked first** (`--force` in the command) |
| foreign | a file this job never wrote is in the way | **asked first** (`--force` in the command) |

---

## `mrscript generate`

```text
mrscript generate JOB.tbjob [-o OUT.mrs] [--data FILE] [--force]
mrscript generate --new DATA [-o JOB.tbjob] [--force]
```

| Option | Meaning |
|--------|---------|
| `JOB.tbjob` | The job to build a script from. |
| `-o`, `--out` | Where to write. Default: the `.mrs` beside the job. With `--new`: the `.tbjob`. |
| `--data FILE` | Use this data file instead of the one the job names. The job's `data.path` is not changed. (The job still records the hash of the script it wrote, as with any run.) |
| `--new` | Write a **starter job** for a data file: the respondent ID and weight it found, every table ticked, scales that look reversed marked, no banner. Default name: `<data name>.tbjob` in the current folder. |
| `--force` | Replace a script that was edited by hand, a foreign file, or an existing job. |

What it does: open the job and the data, stop if the job names anything the data does not have, write the
script (validated), record its hash in the job. Warnings go to the screen and do not stop it.

Exit code `0` on success, `1` on any error. Messages go to the error stream.

**`SOURCE` path.** The script names the data as the job does when it sits beside the job. With `-o` in another
folder the path is rewritten relative to the script's folder. With `--data` it is the absolute path.
`--new` stores a relative data path only when it climbs at most three folders; otherwise it is absolute.

```powershell
mrscript generate --new survey.sav            # survey.tbjob
# edit survey.tbjob: "banner": ["gender", "age_group"]
mrscript generate survey.tbjob                # survey.mrs
mrscript run survey.mrs
```

---

## In the desktop app

- **Right-click a question** (or double-click its Type) to change what Tablix found; **New multi-select…** makes a group by hand.
  See [Changing what Tablix found](#changing-what-tablix-found).
- **Build** is the third mode in the bar (Script · Output · Build). **File ▸ New Build Job from Data File…** and
  **File ▸ Open Build Job…** open it. Opening a `.tbjob` anywhere else (**File ▸ Open Script…**) also goes to Build.
- A job that has a file is saved after every change.
- **Generate & Run** and **F5** run the script the builder just wrote. The text output is written beside the job as
  `<job>_output.txt`. The Script editor's own output file is not touched.
- **Export Excel…** renders the tables on screen if they come from the current script, otherwise it runs the script
  first. It then lists the workbook's sheets. For `single_sheet` they must be **Index**, **Count**, **Percentage**,
  or a warning is shown.
- The other exports in the **Export** menu (CSV, HTML, PowerPoint, AI-ready) write the tables on screen: run the job first.
- **Open as script** saves a copy (default `<job>_edit.mrs`) with a header that says it can be edited freely, and opens
  it in the Script editor. It is one way: the job is not changed and the builder cannot read the copy back.

---

## Limits

The builder covers the common first pass. Not in it yet: editing titles, answer labels and missing codes, NET rows, filters and base text on a table, banner
columns defined by a condition, summary tables (one row per statement), product tests with stacked exposures,
RIM weighting, grid tables, TURF, reading an existing script back into the builder. Use **Open as script** for those.

A job names one data file and cannot carry a codebook. Data with no value labels (a plain CSV) shows coded
answers as numeric questions and text columns as open ends. Use an SPSS file to get labelled answers.
