# 16 · Table-Run Diff

**`mrscript table-diff A B`** compares **two sets of produced tables** — this
week's run vs last week's, a script before and after an edit — and reports what
changed: tables added or removed, structural changes (banner columns, stub rows,
stats, base description), and value shifts (counts, percentages, means, standard
deviations and the base rows) that exceed configurable thresholds.

This is **not** a data diff (`mrscript diff` — Feature #10 — compares two
*datasets*). `table-diff` compares two *output runs*: the `TableResult`s that a
script produces.

```
$ mrscript table-diff last_week/ this_week/

Comparing: last_week  (4 tables) → this_week  (5 tables)

── TABLES ─────────────────────────────────────────────────────
  error  Table 4 'Age 18-34' present in 'last_week' but not in 'this_week'
  error  Table 5 'Awareness' present in 'this_week' but not in 'last_week'

── STRUCTURE ──────────────────────────────────────────────────
  warn   Table 1 'Overall' — Banner column 'Under-30s' removed
  warn   Table 1 'Overall' — Banner column 'Working Adults' added

── CELL SHIFTS ────────────────────────────────────────────────
  warn   Table 1 'Overall'  row 'Agree' / col 'Total'   col_pct: 34.0% → 41.0% (+7.0 pp)
  warn   Table 1 'Overall'  row 'Agree' / col 'Male'    col_pct: 55.0% → 62.0% (+7.0 pp)
  info   Table 1 'Overall'  row 'Agree' / col 'Female'  col_pct: 32.0% → 33.0% (+1.0 pp)

2 error(s), 3 warn(s), 1 info(s)
```

---

## Inputs: stored runs vs live scripts

`A` and `B` can be either:

| Input kind | Example |
|------------|---------|
| Saved `TableStore` directory (contains `manifest.json` + `cells.parquet`) | `last_week/` |
| A `.mrs` script (run on-the-fly, needs `--data-a` / `--data-b` if the source file moved) | `survey_v1.mrs` |

When a `.mrs` script is given, `mrscript table-diff` runs the script through the
engine and then diffs the resulting stores — equivalent to `mrscript run` followed
immediately by a diff. A saved store is loaded directly with no re-tabulation.

Persist a run for later comparison with the `--out-store DIR` flag on `mrscript run`
or `mrscript export`.

A store keeps the numbers and what is needed to print the tables again (row types,
column headings, significance settings). A store saved by **Tablix 0.10.2 or earlier**
has no column headings for a `GRID`, `TURF` or `BANKED_TABLE` table, so those cells
cannot be matched: the report says **Cells NOT compared** for that table, as an error.
Save such a store again. (Up to 0.10.2 these tables were reported as having no
differences, whatever the numbers.)

---

## Table matching cascade

Tables are matched greedy one-to-one in A's script order:

| Step | Match on | Notes |
|------|----------|-------|
| 1 | Store key (case-insensitive) | The `NAME "handle"` given in `TABLE … NAME`; or the title when no name given |
| 2 | `Table N` sequence number | Exact integer match |
| 3 | Normalised title | Lowercase + punctuation stripped (e.g. `"Overall:"` ↔ `"Overall"`) |

**No fuzzy matching** — a structural diff needs exact matches; a false-positive match
between different tables produces meaningless cell comparisons. Unmatched A-tables
are *removed*; unmatched B-tables are *added*.

---

## Report findings

### Table findings

| Kind | Level | When |
|------|-------|------|
| `added` | `error`* | A table exists in B but not in A |
| `removed` | `error`* | A table exists in A but not in B |
| `renumbered` | `info` | Matched by name or title; sequence numbers differ |

*Configurable via `--missing-severity` and `--extra-severity`.*

### Structure findings (within matched tables)

| Kind | Level |
|------|-------|
| `row_added` / `row_removed` | `warn` |
| `col_added` / `col_removed` | `warn` |
| `section_added` / `section_removed` | `warn` |
| `section_label_changed` | `warn` |
| `stats_changed` | `info` |
| `base_changed` | `info` |
| `group_changed` | `warn` |
| `row_changed` | `warn` |
| `cells_not_compared` | `error` |

`group_changed` means rows or columns were found by name under another heading (a
renamed `MEASURE` label or banner variable). Their numbers are still compared.
`row_changed` means a line is a heading on one side only (a `HEADING` turned into a
`NET`, or back). `row_added` / `row_removed` also cover the summary rows under a
table (`Mean`, `Std Dev`, `Median` …), so a renamed one shows as removed and added.

### How rows and columns are matched {#matching}

A row or column is identified by its **heading**, its **label** and its **order**, not
by its label alone, because labels repeat: a `SUMMARY` table lists its statements again
under every measure, a nest (`STUBS $q BY $g`) repeats the answers under every outer
answer, and a nested banner repeats them under every group.

1. Same heading, label and order: the same row or column, wherever it moved to.
2. Otherwise the same label, taken in order (a renamed heading, or a store with no
   banner headings saved by Tablix 0.10.2 or earlier).
3. What is left is reported as added or removed.

The report writes the heading before a label only when the label alone would not say
which one is meant: `row 'Lowest › q1' / col 'Total'`.

Sections (one per `STUBS` variable) are matched by position.

!!! warning "Tablix 0.10.2 and earlier"

    Rows and columns were matched by label, so only one of each repeated label was
    compared, and base rows and `Std Dev` rows were not compared at all. A `SUMMARY`
    table with two or more measures could change and still report **no differences**.

### Cell shifts (within matched rows × columns)

| Stat | Threshold | Severity |
|------|-----------|----------|
| `col_pct`, `row_pct` (only when `STATS` prints it) | `--pct-threshold` (default 2.0 pp) | `warn` if > threshold; `info` if ≤ threshold but a real change (float noise is ignored) |
| `n` | `--n-threshold` (default 0 = any change) | `warn` |
| `weighted_n` | `--weighted-n-threshold` (default 0.5) | `warn` |
| `mean`, `std_dev` (number tables, `SUMMARY` value rows, summary rows) | `--mean-threshold` (default 0.1) | `warn` |
| `base_n` (the `Base` row) | `--n-threshold` | `warn` |
| `base_weighted_n` (`Base (wtd)`), `base_effective_n` (only when printed) | `--weighted-n-threshold` | `warn` |

A value that one side has and the other leaves blank is flagged
`appeared` / `disappeared` (level `warn`).

---

## CLI reference

```
mrscript table-diff A B [options]

Positional:
  A                  Run A: saved TableStore dir or .mrs script
  B                  Run B: saved TableStore dir or .mrs script

Data options:
  --data-a FILE      Dataset for run A when A is a script (overrides SOURCE)
  --data-b FILE      Dataset for run B when B is a script (overrides SOURCE)

Threshold options:
  --pct-threshold N  col_pct shift warn level in pp (default: 2.0)
  --n-threshold N    n diff warn level (default: 0 = any change)
  --mean-threshold N mean/summary shift warn level (default: 0.1)

Output options:
  --json FILE        Write full report to FILE as JSON
  --csv  FILE        Write cell shifts to FILE as CSV (always written when flag given)
  --fail-on error|warn  Exit 1 when findings at that severity or higher exist
```

---

## Python API

```python
from mrscript.table_diff import TableDiffConfig, TableDiffer, TableDiffReporter

cfg = TableDiffConfig(pct_threshold=5.0)
report = TableDiffer(cfg).compare(store_a, store_b, a_label="Week 1", b_label="Week 2")

print(TableDiffReporter().text(report))

if not report.ok:
    for f in report.table_findings + report.structure_findings:
        print(f.level, f.message if hasattr(f, "message") else f.detail)
    for c in report.cell_shifts:
        print(c.stat, c.row_label, c.col_label, c.delta)
```

`compare()` takes two `TableStore` objects (from `JobRunner.run(..., return_store=True)`
or `table_store_io.load(path)`).

`TableDiffReport` properties:

| Property | Type | Description |
|----------|------|-------------|
| `ok` | `bool` | True when no error or warn findings |
| `summary` | `dict[str, int]` | `{"error": N, "warn": N, "info": N}` |
| `table_findings` | `list[TableFinding]` | Added / removed / renumbered tables |
| `structure_findings` | `list[StructureFinding]` | Banner / row / stats / base changes |
| `cell_shifts` | `list[CellShift]` | Per-cell value changes |

---

## Worked example

**Script before edit (`v1.mrs`):**
```mrs
SOURCE "survey.sav"
TABLE "Overall Satisfaction"
    STUBS $q1
    BANNER $gender
    STATS col_pct, n
END TABLE
```

**Script after edit (`v2.mrs`)** — adds a banner column, changes a stub label:
```mrs
SOURCE "survey.sav"
TABLE "Overall Satisfaction"
    STUBS $q1
    BANNER $gender, $ageband
    STATS col_pct, n
END TABLE
```

```
$ mrscript table-diff v1.mrs v2.mrs --data survey.sav

Comparing: v1.mrs  (1 tables) → v2.mrs  (1 tables)

── STRUCTURE ──────────────────────────────────────────────────
  warn   Table 1 'Overall Satisfaction' — Banner column '18-34' added
  warn   Table 1 'Overall Satisfaction' — Banner column '35-54' added
  warn   Table 1 'Overall Satisfaction' — Banner column '55+' added

── CELL SHIFTS ────────────────────────────────────────────────
  (none — same data, same stubs, same existing columns)

3 warn(s)
```

Use `--fail-on warn` in CI to gate a release on no structural changes:

```bash
mrscript table-diff baseline/ new_run/ --fail-on warn
```

---

## Notes

- Reordering banner columns or stub rows does not create cell shifts (see
  [How rows and columns are matched](#matching)).
- Summary rows (Mean, Std Dev, …) are compared against the `mean_threshold`.
- The diff reads already-produced `TableResult` objects; it does not re-run the
  tabulation engine, apply weighting, or recompute significance.
- Significance letters are **not** compared (they depend on base sizes that may
  naturally drift between waves), so two runs that differ only in their letters, for
  example after a `SIG_CONFIDENCE` change, report no differences.
- Every table kind is compared: banner, `SUMMARY`, `GRID`, `TURF`, `DISTRIBUTION` and
  the cross-table outputs.

!!! warning "The report compares the stored numbers, not the printed page"

    It also reports changes in numbers a table does **not** print: rows hidden by
    `SUPPRESS`, the distribution rows of a `STATS_ONLY` table, the unweighted cell
    counts of a weighted table, and **cells masked by `MIN_BASE` or `CONFIDENTIAL`,
    whose real figures appear in the report**. Do not pass a diff report to anyone who
    may not see those figures.

    The other way round, a change of display settings alone is not reported:
    `SUPPRESS`, `DISPLAY pct_only`, `MIN_BASE`, `CONFIDENTIAL`, decimals, or a renamed
    table-level `HEADING`.
