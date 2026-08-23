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

```mrs
EXPORT DATA 'clean.sav'                              // full, metadata-complete
EXPORT DATA 'clean.csv' CODEBOOK 'book.json'         // data + sidecar metadata
EXPORT DATA 'original_only.sav' SOURCE_ONLY          // drop derived columns
```

See also the `mrscript export-data` CLI command ([§23](#cli)), which does the same
from the command line.

---

## 23. Output formats and the CLI {#cli}

Five output formats are available: **plain text** (to stdout), **tagged CSV**,
**styled Excel**, an **interactive HTML viewer**, and a **charted PowerPoint
topline deck**. The CLI `export` command selects format by output-file extension
(`.csv` is the default; `.xlsx` triggers Excel; `.html` triggers the HTML viewer;
`.pptx` triggers the PowerPoint deck).

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
Total         105      52      53      73       32      gap-separated
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
    | `BASE` | The base (n) row for the section |
    | `STAT_MEAN` / `STAT_STD_DEV` / `STAT_STD_ERROR` / `STAT_SUM` / `STAT_MEDIAN` / `STAT_MODE` / `STAT_QUARTILE` | Summary rows |
    | `SIG_LEGEND` | Significance legend (one row per legend line, per table) |
    | `FOOTER` | Table footer; one row per newline in the FOOTER clause |

All tables are written into one CSV file surrounded by `FILE_START` / `FILE_END`
sentinels. Encoding is UTF-8 with BOM (`utf-8-sig`) for Excel compatibility.

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

An openpyxl-generated workbook. All tables start with an **INDEX** sheet (with
hyperlinks to each table), followed by one sheet per table (`multi_sheet` layout) or
all tables on a single "Tables" sheet (`single_sheet` layout).

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
mrscript export script.mrs report.xlsx --theme blue --layout single_sheet
                                              #   --theme applies to .xlsx/.html/.pptx;
                                              #   --layout is .xlsx only.
mrscript export script.mrs report.csv --data data.sav

mrscript export-data script.mrs clean.sav     # Write the transformed data out.
                                              #   [--data F] [--source-only]
                                              #   [--codebook book.json]

mrscript project run project.yml              # Batch-run a YAML project of scripts;
                                              #   output format per-entry by extension.

mrscript build script.mrst                    # Transpile a .mrst authoring file to
                                              #   its sibling .mrs only (--map for a
                                              #   source map). run / export also
                                              #   accept .mrst and transpile first.

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
