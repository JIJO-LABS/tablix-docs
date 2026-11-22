# Part 6 · Output

## 22. EXPORT DATA (write the transformed dataset back out) {#export-data}

```mrs
EXPORT DATA "out.file" [AS fmt] [SOURCE_ONLY] [CODEBOOK "book.json"]
```

Writes the current (transformed) dataset to disk — closing the load → clean →
reproduce loop. It runs **in script order**, so it captures the data state at that
point (place it after your transforms).

| Clause | Meaning |
|--------|---------|
| `AS fmt` | Detected from the extension, or forced: `sav` (SPSS, metadata-complete — labels, value labels, missing as ranges, measure), `csv` (plain data), `parquet` (plain data). |
| `SOURCE_ONLY` | Write only the original source columns; drop derived `@columns` (`DERIVE` / `COMPUTE` / `RECODE`-`EDIT … INTO`). |
| `CODEBOOK "f"` | Also write a JSON codebook ([§5 format](data-input.md#source)). Pair with `csv`/`parquet`, which carry no embedded metadata. |

!!! info "Multi-response derived columns — automatic dichotomy expansion"

    A multi-response `DERIVE` column (one `List[Int64]` of matching stub codes per
    respondent) is automatically expanded into N separate `0`/`1` columns named
    `{varname}_{code}` — one per leaf stub — before writing to `.sav` or `.csv`.
    Example: `@brand` with stubs 1 "Colgate", 2 "Sensodyne", 3 "Oral-B" produces
    columns `brand_1`, `brand_2`, `brand_3` in the output file.

    A companion `CODEBOOK` records the dichotomies as individual `multi_binary`
    variables with the stub label as the variable label.

    **`.parquet`** exports the native `List[Int64]` column unchanged (lists are
    lossless there — use parquet when you want the original multi-code structure).

    **`SOURCE_ONLY`** drops the dichotomies along with all other derived columns.

    **A name that is already taken stops the export.** If the data already has a column
    called `brand_1` (a source column, or any other column in the frame), `@brand` cannot
    be written as `brand_1`: the real column would be overwritten by the 0/1 flags. The
    export stops, before anything is written, and names every clash with the line of the
    `EXPORT DATA` statement. Rename the `@` variable (for example `@brand_pick`), or write
    `.parquet`, or use `SOURCE_ONLY`.

```mrs
EXPORT DATA 'clean.sav'                              // full, metadata-complete
EXPORT DATA 'clean.csv' CODEBOOK 'book.json'         // data + sidecar metadata
EXPORT DATA 'original_only.sav' SOURCE_ONLY          // drop derived columns
```

See also the `mrscript export-data` CLI command ([§23](#cli)), which does the same
from the command line.

---

## 23. Output formats and the CLI {#cli}

Six output formats are available: **plain text** (to stdout), **tagged CSV**,
**styled Excel**, an **interactive HTML viewer**, a **charted PowerPoint
topline deck**, and **AI-ready tables** (JSON Lines or Markdown). The CLI `export`
command selects format by output-file extension (`.csv` is the default; `.xlsx`
triggers Excel; `.html` triggers the HTML viewer; `.pptx` triggers the PowerPoint
deck; `.jsonl` / `.md` write the AI-ready tables).

### The same numbers in every format {#same-numbers}

Every format shows **exactly the numbers the Output screen (the plain-text output) shows**: Excel,
CSV, the HTML viewer, JSON Lines, Markdown and PowerPoint. Only the layout differs. A test
compares every base, count, percentage and value of every format with the screen on a wide set of
tables, unweighted and weighted.

The **base block** of a section, in every format:

| Table | Rows, in this order |
|-------|--------------------|
| Unweighted | **Base**: the number of respondents |
| Weighted (`WEIGHT`) | **Base (wtd)**: the sum of the weights, then **Base (unwtd)**: the respondents, then **Effective base** |

`BASE_LABEL "text"` renames the first of these rows (**Base** or **Base (wtd)**) in every format.

**Which base does a number use? The key.** A weighted table prints three bases, so Tablix writes a
short key itself, in the same place as the significance legend (the Percentage sheet, the text and HTML
output, the CSV `SIG_LEGEND` rows, the Markdown and JSON Lines legends, and the slide footnote):

> Percentages are on Base (wtd). Significance is tested on the Effective base.

On a `TYPE SUMMARY` table it reads *"Percentages are on each statement's own weighted base. Significance
is tested on each statement's effective base."* (a statement's percentages are not over the table's
Base row; see `MEASURE base` in [special tables](tables.md#summary)). With `MIN_BASE` a second line says
that cells are masked where **Base (unwtd)** is under the minimum, using the mask symbol you chose. The key
follows a `BASE_LABEL` rename. An unweighted table has one **Base** row and no key. The key is part of the
significance legend, so a table with no `sig` in its `STATS` has neither. It replaces the older line
"Significance computed on the effective base", which only the text, Excel and CSV outputs wrote.

**Under a weight, a count is the weighted count.** A count row (`STATS n` or `STATS weighted_n`; on a
weighted table the two are the same line) holds the weighted count in every format, so a count and its
percentage always agree (144 of a weighted base of 304 is 47%). The respondent number is the
**Base (unwtd)** row. A percentage is always the engine's own figure: for a `TYPE SUMMARY` statement it
is over that statement's own base.

Other rules the formats share: `SUPPRESS` and `BLANK_SUPPRESS` rows and columns are left out; a row
marked `DISPLAY pct_only` / `count_only` shows only that kind of number; a column with no base is blank;
`MIN_BASE` / `CONFIDENTIAL` cells show the mask. The CSV keeps its numbers unrounded (the macro that reads it
owns the decimals), and the PowerPoint charts the values the table shows (`n=` in a slide's header and
series names is the respondent base).

### Plain text (`mrscript run`)

Quantum/MRDCL-style fixed-width tables, written to stdout.

```text
Table N                         sequence number assigned per run
<title>                         from TABLE '...' (or the first stub's label)
Base: <text>                    from the enclosing SCOPE LABEL; else "All respondents"

                      GENDER             AGE          ← banner group bands,
                  --------------   ---------------       one per banner segment,
           Total    Male  Female    6-8 YO  9-10 YO     each underlined; columns
                                                        in different segments are
Base          105      52      53      73       32      gap-separated
              ----   ----- -------   ------ --------
  <stub>       52      52       0      36       16    ← count line
              50%    100%      0%     49%      50%    ← percentage line
```

- **Blank vs zero:** a measured zero (the cell has a base) prints `0` / `0%`; a cell
  whose column has no base, and any undefined summary stat, print blank;
  `MIN_BASE` / `CONFIDENTIAL` suppression prints its mask (`<<` / `**`).
- Counts and percentages print at **0 decimals** by default, means at **2** — change
  with `DECIMALS` or the per-aspect `PCT_DECIMALS` / `COUNT_DECIMALS` /
  `MEAN_DECIMALS`.

### Tagged CSV (`mrscript export … .csv`)

Every row carries a `row_type` flag so an external formatter (Excel macro or openpyxl
script) can apply styling **without parsing content**.

Fixed meta columns in every row:

| Column | Meaning |
|--------|---------|
| `row_type` | Semantic type (see below) |
| `table_n` | Table sequence number (blank for file sentinels) |
| `section_n` | Section index within the table (1-based) |
| `label` | Human-readable label for the row |
| `stat` | Stat name (`col_pct` / `n` / `mean` / …) or blank |
| `stub_level` | Nesting depth of `STUBS BY` chains (0 = top level) |
| `is_heading` | 1 if the row is a HEADING (display-only), else 0 |

Followed by data columns: `Col_1 … Col_N` (one per banner leaf), then a `__END__`
sentinel column.

??? note "Row types"

    | `row_type` | Meaning |
    |------------|---------|
    | `FILE_START` / `FILE_END` | First / last row of the file |
    | `TABLE_START` / `TABLE_END` | Beginning / end of a table block |
    | `TABLE_NUMBER` / `TABLE_TITLE` | Table sequence number / title rows |
    | `BANNER_GROUP` | Outer (spanning) banner group header — only for nested/crossed banners |
    | `BANNER_HEADER` | Column header label row |
    | `SECTION_LABEL` | Variable label at the start of each section |
    | `STUB` | A distribution row (count / pct / sig repeated per stat) |
    | `NET` | A NET row (aggregate of stubs; bold in formatters) |
    | `HEADING` | A display-only heading row (blank data cells) |
    | `BASE` | A base row of the section: one row (`stat` `n`), or on a weighted table `weighted_n` (Base (wtd)), `n` (Base (unwtd)) and `effective_n` (Effective base) — see [the same numbers in every format](#same-numbers) |
    | `STAT_MEAN` / `STAT_STD_DEV` / `STAT_STD_ERROR` / `STAT_SUM` / `STAT_MEDIAN` / `STAT_MODE` / `STAT_QUARTILE` | Summary rows |
    | `SIG_LEGEND` | Significance legend (one row per legend line, per table) |
    | `FOOTER` | Table footer; one row per newline in the FOOTER clause |

All tables are written into one CSV file surrounded by `FILE_START` / `FILE_END`
sentinels. Encoding is UTF-8 with BOM (`utf-8-sig`) for Excel compatibility.

The CSV holds the screen's quantity but not its rounding: values are written unrounded (six
significant digits), and the macro that reads the file sets the decimals. On a weighted table the
count row's `stat` is `weighted_n` (there is no `n` count row; the respondent number is the `BASE`
row with `stat` `n`). Rows and columns the screen hides (`SUPPRESS`, `BLANK_SUPPRESS`, the line a
`pct_only` / `count_only` row hides) are not written; a column with no base is empty, and a
`MIN_BASE` / `CONFIDENTIAL` cell holds the mask.

### Interactive HTML viewer (`mrscript export … .html`) {#html}

A single self-contained `.html` file — no CDN, no external assets, opens completely
offline in any browser. Use it to share results with people who don't have Excel, or
to browse tables in a browser mid-run.

```sh
mrscript export script.mrs report.html
mrscript export script.mrs report.html --data survey.sav
```

The file includes:

- **Left-nav table of contents** — all tables listed by number + title, grouped by
  sheet. Collapses per group; active link highlighted as you scroll.
- **Per-table row filter** — a text input above each table hides non-matching stub
  rows (base rows, headings, and summary rows stay visible).
- **Column sort** — click any banner header to reorder stub rows by that column's
  col\_pct (or n for count-only tables). Click again to reverse.
- **All table kinds** — banner tables (incl. nested group header bands and
  significance rows), GRID, SUMMARY / TURF value-row tables, and cross-table outputs
  (ADDTAB / BANKED / MANIP / INDEX).
- **Same FormatSpec rules** as the text renderer: decimal resolution
  (`PCT_DECIMALS` / `COUNT_DECIMALS` / `MEAN_DECIMALS`), `MIN_BASE` / `CONFIDENTIAL`
  masking, `BLANK_SUPPRESS`, `STATS_ONLY`, and the blank-vs-zero distinction.

Significance letters appear as `(A)` / `(B)` suffixes on banner headers and on a
dedicated sig row below each stub's count / pct rows — matching the text renderer
layout. When two confidence levels are active, UPPERCASE encodes the strict level.

The `--theme` and `--layout` options only apply to `.xlsx`; the HTML viewer has a
fixed single-column, single-file layout.

### Styled Excel (`mrscript export … .xlsx`)

An openpyxl-generated workbook. All tables start with an **Index** sheet (with
hyperlinks to each table), followed by either:

- **`multi_sheet`** (default) — one worksheet per table.
- **`single_sheet`** — all tables split onto a **Count** sheet (`n` /
  `weighted_n` stats) and a **Percentage** sheet (`col_pct` / `row_pct`
  stats); a table with only one kind of stat appears on that sheet alone.
  Mean/Std Dev/… summary rows appear on both sheets. A table that mixes
  count **and** pct stats carries **no significance on its Count-sheet
  copy** (no sig rows, no `(A)`-style header letters, no Mean-row sig) — the
  letters compare column proportions/means, not raw counts, and would
  otherwise exactly duplicate the Percentage sheet's sig rows; the
  Percentage copy keeps sig in full. A table on the Count sheet only (no
  pct stats requested) keeps its own sig.

The `single_sheet` Index has the columns *No.*, *Title*, *Base*, *N*, *Counts* and *Percentages*.
**`N` is the unweighted base the table's Total column shows** for the first question,
and it stays that number when the Total column is hidden (`SHOW_TOTAL false`): it is then the base the
Total column *would* have shown (everyone who answered the first question), not the base of the first
banner column. Example: a concept test where each household sees one of four concepts and the banner is
the four concepts with no Total, 600 households, 150 per concept. A table of everyone now reads
**N = 600** (it used to read 150, the first concept's base). A question asked of one concept only reads
the 150 households that were asked it (it used to read 0 whenever the first concept was not the one asked).
`N` counts what the table counts. On a stacked (`LEVEL`) table that does not use `BASE respondents`, it counts
**rows** (one per evaluation), not people: 400 people who each rate three products read **N = 1,200**. Add
`BASE respondents` to the table to count people (see [Choosing the base on a stacked table](tables.md#stacked-base)).
`GRID` and `BREAKS` tables, and the `ADDTAB`,
`BANKED_TABLE` and `MANIP` outputs, have no single such number and keep showing their first column's
base. The `multi_sheet` Index has no `N` column.

The workbook shows the screen's numbers ([the same numbers in every format](#same-numbers)): under a
weight the Count sheet holds **weighted counts** and the base block is *Base (wtd)*, *Base (unwtd)*,
*Effective base*; `BASE_LABEL` renames the first base row; a `DISPLAY pct_only` / `count_only` row
leaves the other kind blank (single-sheet keeps the row so the two sheets line up) or out
(multi-sheet).

| Theme | Look |
|-------|------|
| `classic` | Grey-on-white (default) |
| `blue` | Blue corporate palette |
| `teal` | Teal / green palette |
| `minimal` | No background colours — black-on-white only |

### Charted PowerPoint deck (`mrscript export … .pptx`) {#pptx}

A different **deliverable** from the other four, not just a different file type.
The Excel/CSV/HTML/text outputs are the full tab book — every stub, every banner
column. The PowerPoint deck is a client-ready **topline presentation**: one chart
per question, not a table pasted onto a slide. Charts are native, editable
PowerPoint objects (built with [python-pptx](https://python-pptx.readthedocs.io/)),
so the client's own team can recolour or restyle them — never a picture of a chart.

```sh
mrscript export script.mrs deck.pptx
mrscript export script.mrs deck.pptx --theme blue
```

**One slide per (STUBS/DISTRIBUTION section × banner segment).** A table with
`STUBS $q1 BANNER $gender, $region` produces two slides — "by Gender" and "by
Region" — each plotting Total plus that segment's columns. A banner-less table
produces one Total-only slide. Each slide carries:

- The table number, title, "by \<segment\>" subheading, and a `Base:` line.
- A native **bar** chart (long or many labels) or **column** chart (few short
  labels), one series per banner column, Total included by default (respects
  `SHOW_TOTAL false`).
- A direct data label on every bar — the percentage (or count, when the table's
  `STATS` has no `col_pct`), bolded and carrying the significance letter(s) when
  that cell is flagged, e.g. `45% B`.
- NET rows render as a **text callout** under the Base line by default (a "NET
  98%" bar beside 20–30% bars would dominate the chart) rather than as bars.
- A footnote naming the confidence level and comparison scope when significance
  is present, and noting when rows or banner columns were trimmed (below).

!!! warning "Only plain banner tables are charted in v1"

    `TYPE GRID`, `TYPE SUMMARY` / `TYPE TURF` value-row tables, numeric sections
    (incl. `INDEX` / `MANIP` computed-value tables), and `STATS_ONLY` tables are
    **skipped** — never rendered badly — with a warning printed after export (and
    shown in the desktop's Problems panel). Those tables still render fully in the
    Excel / CSV / HTML / text outputs; the PowerPoint deck is a curated subset, not
    the complete record.

Two limits keep a chart readable:

| Limit | Default | Behaviour past the limit |
|-------|---------|---------------------------|
| Banner columns charted per segment | 3 (excl. Total) | Falls back to a Total-only chart for that segment, with a footnote pointing to the Excel tab book for the full banner. |
| Stub rows charted per section | 12 | Shows the first 12 (in script / `SORT` order), with a footnote noting how many rows were cut. |

No grammar changes — this is a CLI/renderer feature, so no script edits are needed
to use it. A future `CHART bar|column|stacked` clause (letting the author declare
intent instead of the size heuristics above, and unlocking diverging stacked bars
for Likert scales) is planned but not yet built.

### AI-ready tables (`mrscript export … .jsonl` / `.md`) {#ai}

Hand a finished deck to an AI assistant without it having to decode a layout made
for people. The AI-ready export follows one rule: **the AI sees exactly what you
see — nothing more, nothing less.** Every number is rounded the way the deck rounds
it, every cell hidden by `MIN_BASE` / `CONFIDENTIAL` stays hidden, every row hidden
by `SUPPRESS` or `BLANK_SUPPRESS` stays out, and every significance letter is
translated into the name of the column it points to. (The tagged CSV holds the same
quantities, but unrounded, because an Excel macro does the presentation.)

Two formats, from the same code, so they always agree with each other, and their
numbers match the Output screen and the Excel workbook of the same run
([the same numbers in every format](#same-numbers)):

| Extension | Use it when | Shape |
|---|---|---|
| `.jsonl` | The assistant can run code (pandas, a notebook, an analysis tool) | One JSON record per cell. Every record repeats its table, question, row and column labels, so **no joins** are needed. |
| `.md` | You paste the file, or one table of it, into a chat | One Markdown table per question. Each cell packs the percentage, the count and the significance letters. |

```sh
mrscript export survey.mrst tables.jsonl
mrscript export survey.mrst tables.md
```

In the desktop app: **Export ▸ Export for AI…** (Ctrl+Shift+A). Choose JSON Lines or
Markdown in the save dialog.

#### Worked example

```mrs
SOURCE "survey.sav"

TABLE "Overall satisfaction by gender"
    STUBS $q1
    BANNER $gender
    STATS n, col_pct
END TABLE
```

**Markdown** (`tables.md`) — the table, as it would be pasted into a chat:

```text
## Table 1 · Overall satisfaction by gender

Base: All respondents

|  | Total | Gender › Male | Gender › Female |
|:--|--:|--:|--:|
| Base | 9 | 5 | 4 |
| Strongly Disagree | 0% (0) | 0% (0) | 0% (0) |
| Disagree | 11% (1) | 0% (0) | 25% (1) |
| Neutral | 22% (2) | 20% (1) | 25% (1) |
| Agree | 33% (3) | 40% (2) | 25% (1) |
| Strongly Agree | 33% (3) | 40% (2) | 25% (1) |
```

A cell reads `percentage (count) letters`. With significance on, `58% (58) B` means
58% of that column's base, 58 respondents, significantly higher than column B (the
letters match the `(A)` / `(B)` in the headers). `<<` is a masked cell; an empty cell
has no base. Members of a NET are indented with `–`, and the NET row itself is bold.

**JSON Lines** (`tables.jsonl`) — the *Agree / Male / %* cell, shown over several
lines for reading (in the file each record is one line):

```json
{
  "record": "cell", "table": 1, "title": "Overall satisfaction by gender",
  "base_description": "All respondents",
  "section": 1, "question": "$q1", "question_label": "Overall Satisfaction",
  "row": 5, "row_label": "Agree", "row_kind": "category", "row_level": 0, "row_parent": null,
  "col": 1, "col_label": "Male", "col_var": "$gender", "col_group": ["Gender"], "col_letter": "",
  "stat": "col_pct", "value": 40, "display": "40%",
  "base_n": 5, "base_weighted": null, "masked": false,
  "sig_higher_than": []
}
```

Loading it takes one line, with nothing to join:

```python
import pandas as pd
df = pd.read_json("tables.jsonl", lines=True)
cells = df[df.record == "cell"]
cells[(cells.row_label == "Agree") & (cells.stat == "col_pct")][["col_label", "value"]]
```

#### The JSON Lines file

The first line is a `file` record that describes the format and every field, so an
assistant can read the file with no other documentation. After it, each table is a
`table` record followed by its `cell` records.

| Record | Holds |
|---|---|
| `file` | `format` (`tablix-tables`), `schema_version`, the Tablix version, the number of tables, a plain-English `read_me`, and `fields` (what each cell key means). |
| `table` | Title, base description, the requested `stats`, `weighted` / `stacked` / `grid` flags, every banner `column` (label, letter, variable, outer group, `is_total`), the `sections` (question variable and label), the `significance` settings (confidence level(s), comparison mode, letter scheme, tails, correction, design effect, and, only when they apply, a `paired` object (`SIG_PAIRED`), `markers` (`SIG_MARKERS plus_minus`), `min_base` (`SIG_MIN_BASE`) and `vs_total_columns` — or `null` when `sig` was not requested), `notes` (the significance legend and any caveat) and the `footer`. |
| `cell` | One displayed number. `value` is the number as displayed; `display` is the text the deck shows. |

Useful `cell` fields:

- **`row_kind`** — `base` (respondents), `base_weighted` (sum of weights), `base_effective`
  (Kish effective base), `category`, `net`, `heading`, `value` (a mean-type row), or
  `summary` (Mean / Std Dev / NPS …). `row_parent` names the NET or heading a row belongs
  to, so a NET's members can be grouped without guessing from indentation.
- **`stat`** — `n` (respondents; unweighted tables), `weighted_n` (the count on a weighted
  table, and the sum of weights on `base_weighted`), `effective_n` (`base_effective`),
  `col_pct`, `row_pct`; `value` for value rows; the statistic's name (`mean`, `std_dev`,
  `nps` …) for summary rows. A heading row has one record per column with `stat: null`.
  **`schema_version` 2:** on a weighted table a count cell has `stat: "weighted_n"` and there
  is no respondent count per cell (the respondent number is the `base` row and the cell's
  `base_n`). A program written for version 1 that reads `stat == "n"` finds no count cells in a
  weighted file.
- **`value`** — `null` when the cell is blank or **masked**. A masked cell never
  carries its number: `masked` is `true` and `display` is the mask (`<<`).
- **`sig_higher_than`** — the columns this cell is significantly higher than:
  `[{"col": 2, "label": "GroupB", "letter": "B", "confidence": 95}]`. It is carried once
  per row, on the `col_pct` record (or on the row's first statistic when the table has
  no `col_pct`). `confidence` is the
  level that letter was tested at, so with two levels (`SIG_CONFIDENCE 99, 95`) an
  uppercase letter reads 99 and a lowercase letter 95. A letter that cannot be matched
  to exactly one column is `{"col": null, "label": null, …}` with a note on the table —
  it is never guessed.

**Column-vs-rest markers.** With `SIG_COMPARE total` every column is tested against the rest of the
sample. With `CONFIG SIG_MARKERS plus_minus` the `significance` object gains `"markers": "plus_minus"`, every
column's `letter` is `""`, and a cell names no column: a significantly higher cell lists
`{"col": null, "label": "the rest of the sample", "letter": "+", "confidence": 95}` in `sig_higher_than`,
and a significantly lower cell lists the same with `"-"` in `sig_lower_than` (a key that exists only in these
files; the file's `read_me` and `fields` say so). `significance` also gains `min_base`
(`{"n": 30, "basis": "effective" | "unweighted", "percent_rows_only": true}`) when `SIG_MIN_BASE` is set, and
`vs_total_columns` (labels) when some columns of a `total` table kept the older column-vs-Total test (see
[setup-blocks §8](setup-blocks.md#config)). A weighted table's record gains `"weighted_std_dev": "sum_weights"`
when `WEIGHTED_STD_DEV sum_weights` is set: how its Std Dev and Std Error were derived, which the table itself
does not print. Each key appears only when it applies, so a file that uses none of these is unchanged.

**Paired significance.** With `CONFIG SIG_PAIRED true`, a table's `significance` object gains
`paired`, so a reader (or an AI) knows which test produced the letters:

```json
"paired": {"tests": ["McNemar z", "paired t", "independent z", "Welch t"],
           "pairs": {"paired": 5, "degenerate": 0, "same_rows": 0, "independent": 1,
                     "not_pairable": 0, "weighted": 0, "other": 0, "unpaired_rows": 0}}
```

`pairs` counts **distinct column pairs per section**, never per row; every compared pair lands in
exactly one of: `paired` (a paired statistic), `degenerate` (paired, but no verdict on any row:
no differing responses), `same_rows` (a subgroup beside its total: the overlap test),
`independent` (no respondent in common: exact), `not_pairable` (a column counts a respondent
twice), `weighted` (v1 pairs are unweighted), `other` (a section the paired test does not cover).
`unpaired_rows` additionally counts the pairs whose NPS or response-count rows kept the
independent test. `tests` lists the tests used: `McNemar z`, `overlap-paired z`, `paired t`,
`partially-overlapping t`, `independent z`, `Welch t`, `NPS z`. The key is **absent** when the knob
is off, so a file produced without it is unchanged. The table's `notes` carry the same
sentence the deck prints.

#### What is applied, and what is not

- **Applied, as in the text and HTML outputs:** decimals (`PCT_DECIMALS`, `COUNT_DECIMALS`,
  `MEAN_DECIMALS`, `DECIMALS`, and a row's `DISPLAY DECIMALS`) with half-away-from-zero
  rounding (a weighted value that is exactly on a .5 tie, such as 62.5%, always rounds up, whatever
  the float noise in its last digits, and in every output format); `PCT_SIGN`; `THOUSANDS_SEPARATOR` (display text only); `MIN_BASE` and
  `CONFIDENTIAL` masking; `BLANK_SUPPRESS`; `SUPPRESS`; `BASE_LABEL`; `PCT_ONLY` /
  `COUNT_ONLY` row properties; blank-versus-zero (a measured zero prints
  `0`, a cell with no base is empty).
- **Running rows (`CUMULATIVE`):** the table engine builds the running count, % and letters, so the
  cells already hold them and the view shows them as they are. Excel, CSV and PowerPoint show the
  same numbers.
- **Weighted tables:** the count is the weighted count, as on the screen (JSON Lines stat
  `weighted_n`; in the Markdown, the count in brackets). The base block is *Base (wtd)*, *Base
  (unwtd)* (respondents) and *Effective base*, and the table says it is weighted.
- **Labels are tidied:** surrounding whitespace is dropped and inner runs (tabs, line
  breaks) become one space, so a label stored as `Very Poor`, a tab, then `[1]` reads
  `Very Poor [1]`.
- **Deterministic:** no timestamps, so exporting the same script twice gives
  byte-identical files.
- **Not included:** whether a question is single- or multi-response (percentages on a
  multiple-response question can add to more than 100 — the file's `read_me` says so,
  but does not mark which questions), and the numeric codes behind the labels.
- **Size:** the JSON Lines file is large because every record repeats its context
  (about 30 MB for a 134-table, 22-column deck) — it is meant for code, not for
  pasting. The Markdown file for the same deck is about 0.4 MB (roughly 100,000
  tokens); to give an assistant one table, copy the block under its `## Table N`
  heading.
- `--theme` and `--layout` do not apply.

### Command-line interface

```powershell
mrscript run script.mrs                       # Execute; print text to stdout.
mrscript run script.mrs --data data.sav       # Override the SOURCE file.
mrscript run script.mrs \                     # Override SET values from outside
    --set brand=Careem --set city=2           #   the script (repeatable; §4b).
                                              #   The desktop Sweep panel does
                                              #   this once per row of a
                                              #   parameter table.

mrscript export script.mrs report.csv         # Execute; write tagged CSV.
mrscript export script.mrs report.xlsx        # Execute; write styled Excel.
mrscript export script.mrs report.html        # Execute; write HTML viewer.
mrscript export script.mrs deck.pptx          # Execute; write a charted topline
                                              #   PowerPoint deck.
mrscript export script.mrs tables.jsonl       # Execute; write AI-ready JSON Lines.
mrscript export script.mrs tables.md          # Execute; write AI-ready Markdown.
mrscript export script.mrs report.xlsx --theme blue --layout single_sheet
                                              #   --theme applies to .xlsx/.html/.pptx;
                                              #   --layout is .xlsx only.
mrscript export script.mrs report.csv --data data.sav

mrscript export-data script.mrs clean.sav     # Write the transformed data out.
                                              #   [--data F] [--source-only]
                                              #   [--codebook book.json] [--set N=V]

mrscript project run project.yml              # Batch-run a YAML project of scripts;
                                              #   output format per-entry by extension.
                                              #   [--set N=V] beats every entry's set:.

mrscript build script.mrst                    # Transpile a .mrst authoring file to
                                              #   its .tablix/*.mrs only (--map for a
                                              #   source map; --set N=V pins a #set;
                                              #   --out FILE also writes a copy there,
                                              #   --no-header drops its GENERATED line).
                                              #   run / export also accept .mrst and
                                              #   transpile first.

mrscript health script.mrs                    # Run data health / QC checks; print a
                                              #   grouped text summary to stdout.
mrscript health script.mrs --json r.json      # Also write a JSON report.
mrscript health script.mrs --csv flagged.csv  # Also write a flagged-respondent CSV.
mrscript health script.mrs --fail-on error    # Exit 2 when any errors are found.
                                              # (--fail-on warn: exit 2 on errors or warns)

mrscript run   script.mrs --out-store DIR/    # Save TableStore + audit manifest alongside
mrscript export script.mrs report.csv \       #   output. See §17: Audit Manifest for the
    --out-store DIR/                          #   full out-store spec (audit.json schema,
                                              #   git context, SHA-256 checksums).
```

#### Project files {#project-files}

`mrscript project run project.yml` builds every deliverable of a job in one go. Each
`scripts:` entry is one output file; the same script can appear more than once with
different `set:` values:

```yaml
project: "Anunciar wave 6"
data: "data/W1_6.parquet"        # optional; an entry's own data: wins
set:                              # script values for every entry (optional)
  WAVE: 6
scripts:
  - script: "TABLES.mrst"         # a .mrs or a .mrst (transpiled first, like mrscript run)
    output: "output/RANDOM.xlsx"
    layout: single_sheet          # .xlsx only: multi_sheet (default) | single_sheet
    theme: classic                # .xlsx only: classic (default) | blue | teal | minimal
    set: {RB: 1}                  # this entry's #set / SET values; they win over the top-level set:
  - script: "TABLES.mrst"
    output: "output/BOOSTER.xlsx"
    layout: single_sheet
    set: {RB: 0}
```

Paths are relative to the project file; a relative `SOURCE` in a script resolves
beside that script, as it does for `mrscript run`. `--set NAME=VALUE` on the command
line beats both `set:` maps. A name in an entry's own `set:` that its script never uses
(no `#set`, `SET` or `{NAME}`) fails that entry, so a typo cannot deliver the default variant;
the top-level `set:` is for every script, so some may not use a name. An entry that fails is
reported and the batch carries on.
