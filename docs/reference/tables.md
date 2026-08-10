# Part 5 · Tables

## 17. TABLE {#table}

```mrs
TABLE ['title']
  clause*
END TABLE
```

One output table. `FORMAT` defaults ([§9](setup-blocks.md#format)) are inherited; any
clause here overrides that setting for this table only. The title is optional
(defaults to the first stub variable's label).

### Row axis — STUBS / DISTRIBUTION / ADD {#row-axis}

At least one row-axis clause is required.

#### STUBS

```mrs
STUBS item [, item ...]
```

Row variables, by their metadata stubs. Multiple items create stacked sections. An
item may nest with `BY` (inner → outer):

```mrs
STUBS $q1                     // one section
STUBS @ageband, $gender       // two sections
STUBS @region BY $gender      // region crossed within gender
```

A `HEADING` group may divide stub items:

```mrs
STUBS HEADING 'Demographics' @ageband, $gender ENDHEADING
```

#### DISTRIBUTION

```mrs
DISTRIBUTION var [, var ...]
```

Row axis built from the **unique codes present in the data** (sorted), rather than the
variable's metadata stubs. Nulls and declared `MISSING` codes are excluded. Each row
**leads with the raw code**: `"1: Male"` when the code has a value label, bare `"99"`
when it doesn't — keeping the data-driven audit view visually distinct from the
label-only `STUBS` table. Reveals codes that `STUBS` would silently drop, and works on
numeric and labelled variables (a derived multi-response var is exploded first).
Requesting a summary stat appends those rows computed over the raw values.

```mrs
DISTRIBUTION $age STATS n, col_pct, mean, std_dev
```

`STUBS` and `DISTRIBUTION` may both appear and compose in source order.

!!! tip "Sentinel codes in a numeric-entry column"

    A numeric-entry field that carries non-numeric escape codes (`998` "Do not
    stock/sell", `999` "Don't know") needs those reported as rows *and* kept out of
    the mean. `MISSING` can't do that — it drops a code from rows, base and stats
    together. Declare
    [`STATS_EXCLUDE`](setup-blocks.md#missing-vs-stats-exclude) on the variable
    instead: the sentinel keeps its own labelled row and its place in the base,
    and only the summary rows skip it.

    ```mrs
    VARIABLE $q5a  STATS_EXCLUDE 998, 999  END VARIABLE
    TABLE 'Q5a' DISTRIBUTION $q5a STATS n, col_pct, mean END TABLE
    ```

#### ADD — pool variables into one section

```mrs
ADD [DISTRIBUTION] var [, var ...] [SECTION LABEL 'text']
```

**Pool** several same-frame variables into **one section** — counts and base **add
up** (response-level): for each row and banner cell, `count = Σ count(var = code)` and
`base = Σ base(var)`. A respondent valid on two of the variables is counted twice
(the classic ADDTAB pooling — distinct from a `NET`, which is a de-duplicated union
with base N, and from a `GRID`, which lays variables side by side as columns).
`SECTION LABEL` names the pooled block (default `"@v1 + @v2"`).

- **Plain `ADD`** pools by stub code: rows are the variables' shared stub frame; NET
  rows and the score frame come from the variables (so the Mean is pooled too).
  Variables must be categorical (numeric / open_end rejected).

  ```mrs
  ADD @q1_brand, @q2_brand SECTION LABEL 'Any mention (Q1 + Q2)'
  ```

- **`ADD DISTRIBUTION`** pools by the data values present — rows are the sorted union
  of distinct codes across the columns (nulls and declared `MISSING` excluded). This
  accepts **numeric** columns too, so it sums a roster of numeric columns (e.g.
  children's ages held one per column) into one frequency table, with a pooled mean.
  Declare the "empty slot" sentinel as `MISSING` so unused columns don't inflate the
  base.

  ```mrs
  VARIABLE $child1_age MISSING 0 END VARIABLE   // ... repeat per column
  ADD DISTRIBUTION $child1_age, $child2_age, $child3_age
    SECTION LABEL 'All children'
  ```

### Column axis — BANNER

```mrs
BANNER item [, item ...]   // inline banner; each item is a variable or a BY-chain
BANNER Name                // reference a named banner (§18)
```

```mrs
BANNER @ageband                // single segment
BANNER @ageband, $gender       // two side-by-side segments
```

#### Nested (crossed) columns — `BANNER $a BY $b [BY $c …]`

Crosses variables into a column hierarchy with stacked header bands, to any depth. As
with `STUBS`, the variable **after** `BY` is the outer/spanning group; the first
(innermost) variable's categories are the leaf columns.

```mrs
BANNER $city BY $gender        // Gender spans; City nested beneath
```

```text
              Male              Female
       Mumbai   Delhi      Mumbai   Delhi
  ...     .       .          .       .
```

Each leaf cell counts the **AND** of its column conditions (e.g. gender=Male AND
city=Mumbai). Significance (`STATS sig`) is tested within the innermost group only.
Crossing operands must be plain categorical variables (no numeric, nets, or
headings).

Omitting `BANNER` gives a Total-only single column. A leading Total column is shown
by default when a banner is present — control it with `SHOW_TOTAL`. (Stacked header
bands render in text/CSV output; Excel is not supported.)

### GRID tables — `TYPE GRID` {#grid-tables}

A `GRID` table renders several variables' **own** single-variable distributions as
side-by-side **columns** — the transpose of a normal table (the rows are different
variables that share one code frame). Use it for brand-imagery grids (statements ×
brands) and rating batteries (scale × statements). It replaces `STUBS` / `BANNER` and
uses `COLUMN`:

```mrs
TABLE 'Brand imagery' TYPE GRID
  COLUMN @brand1 LABEL 'Brand A' [FILTER $aware1 = 1]
  COLUMN @brand2 LABEL 'Brand B'
  COLUMN @brand3 LABEL 'Brand C'
  [ANSWERED_BASE false]
  STATS col_pct, n, mean, sig
END TABLE
```

The rows are the columns' shared layout (leaves + NETs + headings), taken from the
first column and aligned by stub code; a column missing a code shows a blank cell.
**Everything** in a column comes from its variable — its NET rows and its Mean —
nothing is re-declared on the table.

| Clause | Meaning |
|--------|---------|
| `COLUMN var LABEL 'text' [FILTER cond]` | One column = one variable; `LABEL` is the header. An optional `FILTER` scopes that column's base. Variables must be categorical / list. (A `FILTER` right after `LABEL` binds to that column; a table-wide `FILTER` must precede the `COLUMN` list.) |
| `ANSWERED_BASE true \| false` | `true` (default) — a filter-less column bases on respondents who answered. `false` — bases on all in-scope respondents (the "Total" base). |

Significance compares the columns (the same respondents → paired), so the test is
approximate and a non-fatal advisory is emitted — drop the flags with
`CONFIG SUPPRESS_GRID_SIG true`. A `GRID` has no Total column and no `BANNER`.

### Summary / top-box battery tables — `TYPE SUMMARY` {#summary}

A `SUMMARY` table consolidates a **battery** of rating questions (`q1..qN` sharing a
scale) into **one** table. You list the battery with `STATEMENTS` and the summary
**measures** with `MEASURE`; the result is **measure-major** — one labelled block per
measure (Top-2-Box, Mean, …) with **one row per statement** inside it — and it keeps
the usual banner columns (Total + optional demographics) and significance.

```mrs
TABLE 'Brand agreement — summary' TYPE SUMMARY
  STATEMENTS @easy, @value, @recommend   -- the battery (rows); share a 1-5 scale
  SCALE 1..5                              -- shared scale endpoints (see resolution below)
  MEASURE TOP 2     'Top-2-Box'           -- % choosing the top 2 scale points
  MEASURE BOTTOM 2  'Bottom-2-Box'
  MEASURE NET (3)   'Neutral'             -- an explicit code set
  MEASURE mean      'Mean'                -- a score statistic
  MEASURE median    'Median'
  BANNER  $gender                         -- optional; a Total column is always shown
  STATS   col_pct, n, sig
END TABLE
```

| Clause | Meaning |
|--------|---------|
| `STATEMENTS v1, v2, …` | The battery variables — one **row** each, inside every measure block. Each uses its variable label as the row label. Categorical or numeric (not open-end). |
| `MEASURE TOP n ['Label']` | The **n highest** scale points (e.g. `TOP 2` on a 1-5 scale = codes 4,5). |
| `MEASURE BOTTOM n ['Label']` | The **n lowest** scale points (`BOTTOM 2` = codes 1,2). |
| `MEASURE NET (a, b, …) ['Label']` | An **explicit** code set — any box, not just the ends (e.g. `NET (3)` = the neutral midpoint). |
| `MEASURE <stat> ['Label']` | A **score statistic** row — `mean`, `median`, `std_dev`, `std_error`, `sum`, `mode`. Uses the variable's `SCORE` (or code-as-score when none is declared). |
| `SCALE lo..hi` | The shared scale endpoints used by `TOP`/`BOTTOM`. Optional — see resolution. |

**Box rows** (`TOP`/`BOTTOM`/`NET`) show a percentage (and count, if `n` is in
`STATS`) over **each statement's own valid base**, so item-nonresponse on one
statement never distorts the others. **Score rows** (`mean`/`median`/…) show a single
value. The leading **Base** row shows the banner column universe (in-scope
respondents).

**`TOP`/`BOTTOM` scale resolution** (per statement), in precedence:

1. an explicit `SCALE lo..hi` → `TOP n` = the highest `n` of `lo..hi`;
2. else the variable's **declared value codes** (so a labelled 1-5 scale needs no
   `SCALE`);
3. else the distinct values present in the data (data-dependent — prefer `SCALE` or
   `NET` for numeric batteries with no value labels).

Significance runs over the **banner columns** as for a normal table (box rows:
column-proportion *z*; Mean rows: Welch *t*). `SORT` reorders statements within each
block. `LEVEL` (stacked) summary tables are not supported.

**Worked example.** With three 1-5 rating items — `rate_1=[3,4,5,3,2,4]`,
`rate_2=[3,3,4,3,4]` (one non-response), `rate_3=[3,5,3,3,1,4]`:

```mrs
TABLE 'Rating battery — summary' TYPE SUMMARY
  STATEMENTS $rate_1, $rate_2, $rate_3
  SCALE 1..5
  MEASURE TOP 2    'Top-2-Box'
  MEASURE BOTTOM 2 'Bottom-2-Box'
  MEASURE mean     'Mean'
  STATS col_pct, n
END TABLE
```

```
                               Total
Top-2-Box
  Rating item 1                  50%      (3 of 6)
  Rating item 2                  40%      (2 of 5 — over its valid base, not 6)
  Rating item 3                  33%      (2 of 6)
Bottom-2-Box
  Rating item 1                  17%
  Rating item 2                   0%      (a measured zero, base 5)
  Rating item 3                  17%
Mean
  Rating item 1                 3.50
  Rating item 2                 3.40
  Rating item 3                 3.17
```

### TURF analysis — `TYPE TURF` {#turf}

**TURF** (Total Unduplicated Reach & Frequency) answers *"which combination of
items reaches the most people?"* — line-up / claims / SKU optimisation. Given a set
of items, it finds the **best portfolio at each size** and reports its **reach**
(the share who pick at least one item — the *unduplicated* union, not the sum of
parts), the **incremental reach** each added item brings, and the average
**frequency** (depth) of use.

```mrs
TABLE 'Flavour line — TURF' TYPE TURF
  ITEMS  $flav_choc, $flav_van, $flav_straw, $flav_mint   -- the item set
  SIZE   1..3                                             -- best portfolio at each size
  REPORT reach, incremental, frequency                    -- which metric columns to show
  METHOD auto                                             -- exact | greedy | auto (default auto)
  FILTER $aware = 1
  WEIGHT $wgt
END TABLE
```

```
                                       Reach %   Incremental   Frequency
Base                                         5             5           5
Chocolate                                 40.0          40.0        0.40
Chocolate + Strawberry                    80.0          40.0        0.80
Chocolate + Strawberry + Mint             80.0           0.0        1.10
```

Each row is the **best portfolio at that combination size** — the unduplicated reach
curve. The columns are the metrics named in `REPORT` (values are shown without a `%`
sign, like an `INDEX` / `MANIP` computed-value table; the header names the unit).

#### `ITEMS` — three forms

| `ITEMS` form | Items | "Chosen" means |
|--------------|-------|----------------|
| **≥ 2 variables** `$a, $b, $c` | one item **per variable** | `var = 1` (the multi-binary 0/1 convention) |
| **one derived list** `@brands` | one item **per stub code** of a `DERIVE` multi-response var | the respondent's list contains that code |
| **one single_punch** `$fav` | one item **per value code** | `var = code` (TURF over a single-choice question) |

There must be **≥ 2 items**. Item labels come from the variable / value / stub labels.

#### Clauses

| Clause | Meaning |
|--------|---------|
| `ITEMS …` | The item set (required; see the three forms above). |
| `SIZE k` / `SIZE lo..hi` | Combination size(s) to report. `SIZE 3` = the best 3-item portfolio; `SIZE 1..3` = the curve. Omitted ⇒ `1..N`. |
| `REPORT reach[, incremental][, frequency]` | Which metric columns appear. Omitted ⇒ all three. |
| `METHOD exact \| greedy \| auto` | Search strategy (default `auto`). |

Reach is over the **table base** (everyone in scope), honouring `FILTER` / `SCOPE`
and `WEIGHT` (weighted reach % weights both numerator and denominator). Incremental
reach is `reach[k] − reach[k−1]` (always ≥ 0). Frequency is the mean number of
portfolio items a base respondent chose.

#### `METHOD` — exact vs greedy

- **`exact`** enumerates every combination and picks the true maximum-reach
  portfolio. Correct; cost grows as `Σ C(N,k)`.
- **`greedy`** adds one item at a time (the item that most increases reach). Fast for
  large item sets, occasionally sub-optimal.
- **`auto`** (default) uses **exact** when the combination count is small (≤ 200 000),
  else **greedy**. An explicit `METHOD exact` is refused past 2 000 000 combinations
  (use `greedy`). Ties are broken deterministically (smallest item index), so output
  is reproducible.

> **v1 limitations.** No significance, no `LEVEL` (respondent-level only), and no
> segment banner (one base per table) — a reach-by-segment cross is planned. `SORT`
> and `INDEX` do not apply (a TURF table is banner-less).

### STATS

```mrs
STATS [+] stat [, stat ...]
```

Which statistic rows appear ([§28](reference-details.md#stats-values)). Three modes
([§32](reference-details.md#stats-modes)): inherit (no clause), override (`STATS …`),
merge (`STATS + …`).

### Other table clauses

| Clause | Meaning |
|--------|---------|
| `STATS_ONLY` | Render only the summary rows (mean, std dev, …); suppress the distribution rows (still computed internally). |
| `FILTER condition` | Row filter for this table only; AND-ed with any enclosing `SCOPE`. |
| `WEIGHT $weight_var` | Apply probability weights to this table (adds weighted_n / effective base). |
| `LEVEL @stack_name` | Tabulate against a stacked frame ([§12](data-preparation.md#stack)). Optional — inferred from the variable names when omitted; explicit `LEVEL` takes precedence. |
| `BASE respondents` | Unique-respondent base. On a `LEVEL` table it corrects for rotation; on a non-stacked table it de-duplicates by `%RESPID` (which must be declared). |
| `SHEET 'tab name'` | Target worksheet name in Excel output (no effect on text output). |
| `NAME 'handle'` | Register this table in the table store under `handle` instead of its title, so a cross-table op ([§20](#cross-table)) can address it. Names must be unique within the script. |
| `SHOW_TOTAL true\|false\|'Label'` | Show (default), hide, or relabel the leading Total column. The Total column is excluded from significance lettering. |
| `SHOW_SCORES true\|false` | Append each leaf stub's contributing score value in brackets after its label (e.g. `Agree [4]`) — but **only on a table whose `STATS` requests `mean`**; a table without `mean` never shows brackets regardless. The value is the code's declared `SCORE`, or the raw code itself when the variable has no `SCORE` declared anywhere; a code left unscored on a partially-scored variable shows no bracket. NETs and HEADINGs are never annotated. Default **true**. |

Other `FORMAT` directives may also appear at table level (overriding the `FORMAT`
default here): `BASE_LABEL`, `BASE_DESCRIPTION` ([§19 Overriding the Base: line](#base-description)),
`FOOTER`, `THOUSANDS_SEPARATOR`, `MIN_BASE`,
`CONFIDENTIAL`, `BLANK_SUPPRESS`, `SUPPRESS_EMPTY`, `AUTONUMBER`, `RANKING`,
`SORT` ([§17 Sorting rows](#sorting)), `MAX_COL_WIDTH`, `DECIMALS`, `PCT_DECIMALS`,
`COUNT_DECIMALS`, `MEAN_DECIMALS`, `PCT_SIGN`.

```mrs
TABLE 'T7. Oral-care concerns by age'
  STUBS  @concerns
  BANNER @ageband
  STATS  n, col_pct, sig
  RANKING        descending
  AUTONUMBER     true
  BLANK_SUPPRESS row
  SHOW_TOTAL     'All adults'
  BASE_LABEL     'Total respondents'
END TABLE
```

### Sorting rows — SORT {#sorting}

`SORT` orders a table's stub rows by the value in **any banner column**, in either
direction, while keeping structure intact — nets and headings stay anchored, and
summary (Mean / Std) rows always sit at the bottom. The reorder happens on the
table itself, so **text and Excel output and persisted tables all reflect it**.

```mrs
SORT [col_pct | n | row_pct] [ASC | DESC] [ON $var = code | TOTAL]
```

| Part | Default | Meaning |
|------|---------|---------|
| sort key | `col_pct` (falls back to `n`) | which distribution stat to read from each cell |
| direction | `DESC` | `DESC` high→low, `ASC` low→high (`descending` / `ascending` also accepted) |
| `ON` column | the **Total** column | which banner column supplies the value |

Columns are named by **variable + code** (`ON $region = 1`) — the same condition
grammar as `FILTER` — never by display-label text (labels are easy to mistype and
can be renamed). For a crossed banner, AND the parts: `ON $city = 3 AND $gender = 1`
(operand order doesn't matter). Omit `ON`, or write `ON TOTAL`, to sort by the
Total column.

`SORT` is valid in the global `FORMAT` block or per `TABLE` (table overrides
global). `RANKING ascending|descending` is the simple shorthand for "sort by the
Total column" — exactly `SORT col_pct ASC|DESC ON TOTAL`.

**Worked example.** Order brands by their score in the *Female* column, high→low:

```mrs
TABLE 'Brand awareness'
  STUBS  $brand
  BANNER $gender
  STATS  col_pct, n
  SORT   col_pct DESC ON $gender = 2   // $gender = 2 is the Female column
END TABLE
```

Suppose the unsorted table's Female column reads Acme 18%, Brava 42%, Cosma 31%:

```
Before (script order)          After (SORT … ON $gender = 2)
  Brand    Total  Female         Brand    Total  Female
  Acme      …      18%           Brava     …      42%
  Brava     …      42%           Cosma     …      31%
  Cosma     …      31%           Acme      …      18%
```

The rows now run Brava → Cosma → Acme, even though the Total or Male columns might
rank them differently. Ties keep their original script order; a no-base cell sorts
last.

**Structure is respected:**

- A **NET** row stays glued to its members; the members sort *within* the net, and
  sibling nets sort by their net row's value.
- A **HEADING** row stays atop the block it labels; heading groups keep their
  script order.
- **Summary rows** (Mean / Std) are never reordered — they always anchor at the bottom.

> Out of scope (v1): sorting whole *sections* relative to each other (each section
> sorts independently; section order is preserved) and sorting by a summary-row value.

---

### Index / profile tables — INDEX {#index}

`INDEX` re-expresses every cell in a finished table as an **index vs a reference
banner column** — 100 = parity, >100 over-indexes, <100 under-indexes. It is a
post-tabulation clause (like `SORT`): the data are already tabulated, and `INDEX`
simply rescales the result.

```mrs
INDEX [ON $var = code | ON TOTAL]
```

| Part | Default | Meaning |
|------|---------|---------|
| reference column | the **Total** column | divide every cell by this column's value |
| `ON $var = code` | — | use the named banner column as reference |
| `ON TOTAL` | — | explicit form of the default |

**Cell math** is identical to `MANIP … INDEX`: `cell ÷ reference × 100`, None-safe
and ÷0-safe (a zero-base reference yields a blank cell). The reference column itself
always reads **100** (or blank when its value is 0). See also [§21 MANIP](#manip).

**What changes / what stays the same:**

| | Behaviour |
|---|---|
| Cells | Column % replaced by the index value (a plain number, no `%`) |
| Base rows | Inherited unchanged — still show the real unindexed column bases |
| NET rows | Indexed normally (NET value ÷ reference NET value × 100) |
| HEADING rows | Blank — no value to index |
| Summary rows (Mean / Std) | Dropped — index of a std dev is not meaningful |
| Significance | Cleared — a ratio has no single base to test |
| Stats shown | Rendered as `mean` (value-row path); use `MEAN_DECIMALS` or `DECIMALS` to control decimal places (recommend `DECIMALS 0` for whole-number indices) |

**Restrictions:** `INDEX` requires a BANNER (at least the Total column). It is not
supported on `TYPE GRID` or `TYPE SUMMARY` tables.

**Worked example.** Profile satisfaction (`$q1`) by gender, indexed to the Total:

```mrs
TABLE 'Satisfaction profile — indexed'
  STUBS   $q1
  BANNER  $gender
  STATS   col_pct, n
  INDEX                    // reference = Total (default)
  DECIMALS 0
END TABLE
```

Suppose 60% of the Total, 50% of Males, and 80% of Females answer "Satisfied":

```
                     Total   Male (A)   Female (B)
Satisfied              100        83         133
```

Male under-indexes (83 < 100); Female over-indexes (133 > 100). The Total column
always reads 100 because it is the reference. Bases beneath the index rows are the
real unindexed respondent counts.

**Combine with SORT.** `SORT` runs before `INDEX`, so you can order rows by the
pre-index rate and then re-express them as an index:

```mrs
TABLE 'Brand profile'
  STUBS  $brand
  BANNER $gender
  STATS  col_pct, n
  SORT   col_pct DESC            // order by Total % before indexing
  INDEX  ON $gender = 2          // index Female column to Female base
  DECIMALS 0
END TABLE
```

**Using a non-Total reference.** `INDEX ON $gender = 2` uses the Female column as
the reference base; the Female column itself reads 100, and all other columns are
expressed relative to it.

### Total column {#total-column}

When a `BANNER` is present, a leading **Total** column is prepended by default.
`SHOW_TOTAL` accepts three forms (table-level or in the global `FORMAT` block; table
overrides global):

- `SHOW_TOTAL false` — hide it.
- `SHOW_TOTAL true` — show it (default), labelled "Total".
- `SHOW_TOTAL 'All Adults'` — show it with a custom label (implies show).

A banner-less table's single column is already the Total, so `SHOW_TOTAL` is a no-op
there. The Total column is **excluded from significance lettering/testing** — banner
columns are lettered A, B, C… starting at the first real column.

---

## 18. BANNER (named, reusable banners) {#named-banner}

```mrs
BANNER Name var [, var ...] END BANNER
```

Defines a reusable banner referenced by name in a `TABLE` or `FORMAT` clause
(`BANNER Name`). Keeps a common column structure in one place.

```mrs
BANNER Demographics @ageband, $gender, $region END BANNER

FORMAT  BANNER Demographics  END FORMAT     // default for all tables

TABLE 'Awareness' STUBS @aware BANNER Demographics END TABLE
```

---

## 19. SCOPE (pre-filtering tables) {#scope}

```mrs
SCOPE WHERE condition [LABEL 'text']
  statement*
ENDSCOPE
```

Pre-filters every `TABLE` inside the `SCOPE`. The `SCOPE` condition is AND-ed with
each table's own `FILTER`. `SCOPE`s may nest; conditions AND at each level.

```mrs
SCOPE WHERE $gender = 1 LABEL 'Males'
  TABLE 'Q1 — Males'    STUBS $q1   END TABLE
  TABLE 'Brands — Males' STUBS @brands END TABLE
ENDSCOPE

SCOPE WHERE $AGE_CAT IN (2, 3) LABEL 'Young adults'
  SCOPE WHERE $AGE_CAT = 2 LABEL '20–29 only'
    TABLE 'Frequency — youngest' STUBS $S12b END TABLE
  ENDSCOPE
ENDSCOPE
```

!!! note "Notes"

    - Data-preparation statements (`DERIVE`/`EDIT`/`RECODE`/…) inside a `SCOPE` still
      apply to the **whole dataset** — the `SCOPE` only filters which respondents
      count in its tables.
    - `SCOPE LABEL` is shown as the `Base: …` line in each enclosed table's text
      output (nested labels join outer→inner with `; `). Tables with no enclosing
      labelled `SCOPE` default to `Base: All respondents`.

### Overriding the Base: line — BASE_DESCRIPTION {#base-description}

`BASE_DESCRIPTION 'text'` sets the `Base: …` line explicitly instead of relying on
`SCOPE LABEL`. It works like every other `FORMAT`/`TABLE` directive: declare it once
in the global `FORMAT` block to default every table to it, or on a specific `TABLE`
to override just that one. Precedence (highest wins): **table `BASE_DESCRIPTION`** →
**global `FORMAT BASE_DESCRIPTION`** → **enclosing `SCOPE LABEL`(s)** → `All respondents`.

```mrs
FORMAT
  BASE_DESCRIPTION 'All qualified respondents'
END FORMAT

SCOPE WHERE $gender = 1 LABEL 'Males'
  TABLE 'Q1 — Males' STUBS $q1 END TABLE                          -- Base: All qualified respondents
  TABLE 'Brands — Males, opted in'
    STUBS @brands
    BASE_DESCRIPTION 'Males who opted into brand tracking'        -- table wins over both
  END TABLE
ENDSCOPE
```

Distinct from `BASE_LABEL`, which renames the base **row**'s left-hand label
(default "Total") — `BASE_DESCRIPTION` renames the identity **line** under the
table title instead. A table's own `FILTER` clause never feeds `Base: …`; only
`SCOPE LABEL` and `BASE_DESCRIPTION` do.

---

## 20. Cross-table operations {#cross-table}

Cross-table operations post-process tables that have **already been tabulated** —
they read finished `TABLE` results out of the table store and never re-read the
data. Each references its sources by **name**: the `NAME 'handle'` clause on a
`TABLE` ([§17](#table)), or the table's title when no `NAME` is given. A source
must be declared **earlier** in the script.

They all produce ordinary tables that render exactly like any other (text or
Excel), appended after the regular tables and numbered sequentially. Significance
flags are **not** carried over — they were computed over the source bases; re-add
`STATS sig` only if you mean to test the combined result.

The three operations are `ADDTAB` (wave merge), `BANKED_TABLE` (side-by-side
tracker), and `MANIP` (cell arithmetic — derived tables).

### ADDTAB — wave merge {#addtab}

```mrs
ADDTAB 'T1', 'T2' [, …] [TITLE 'text'] [NAME 'handle']
```

Adds the cell counts of several **same-layout** tables (same stubs × same banner)
into one combined result — the classic roll-up of monthly waves into a quarter.
Counts and weighted counts add; percentages are **recomputed** from the combined
counts and bases (not averaged); means/standard deviations re-derive correctly
from the summed sufficient statistics. Median / mode / quartile rows blank out on
merge (a pooled distribution can't be rebuilt from summary statistics) — re-run
those on the combined data if you need them.

- `TITLE` — title of the merged table (default: the source titles joined with `+`).
- `NAME` — store handle for the merged table (default: its title).
- All sources must share the same sections, stub order, and banner columns —
  otherwise the merge raises an error.

```mrs
TABLE 'Satisfaction — Jan' NAME 'Jan' STUBS $q1 BANNER $region STATS col_pct, n END TABLE
TABLE 'Satisfaction — Feb' NAME 'Feb' STUBS $q1 BANNER $region STATS col_pct, n END TABLE

ADDTAB 'Jan', 'Feb' TITLE 'Satisfaction — Q1 roll-up' NAME 'Q1'
```

### BANKED_TABLE — side-by-side tracker {#banked-table}

```mrs
BANKED_TABLE 'Stub' 'T1' [, 'T2' …] [TITLE 'text'] [NAME 'handle']
```

Places several tables (same stubs, different banners) next to each other as one
wide table — the "tracker" view of one question across periods or geographies.
The **first** name is the *stub source*: it supplies the row layout only. The
remaining names are the tables whose banner columns are concatenated, left to
right. To include the stub source's own columns, **list it again** among the
sources.

Duplicate column labels (e.g. "Total" in every wave) are disambiguated with the
source table's title, e.g. `Total (Satisfaction — Jan)`. All sources must share
the stub source's row layout.

```mrs
TABLE 'Satisfaction — Jan' NAME 'Jan' STUBS $q1 BANNER $region STATS col_pct, n END TABLE
TABLE 'Satisfaction — Feb' NAME 'Feb' STUBS $q1 BANNER $region STATS col_pct, n END TABLE

BANKED_TABLE 'Jan' 'Jan', 'Feb' TITLE 'Satisfaction tracker'
```

!!! tip "Simulating waves in one dataset"

    The engine tabulates one dataset per run, so the wave roll-up pattern works
    on data that already carries a wave indicator: `APPEND` the wave files (or add
    a `wave` column), then give each wave its own `TABLE … FILTER $wave = n NAME …`
    before the `ADDTAB`/`BANKED_TABLE`.

### MANIP — derived tables (cell arithmetic) {#manip}

```mrs
MANIP 'A' <op> 'B' [ON measure] [TITLE 'text'] [NAME 'handle']
```

Builds a new table by combining two **same-layout** tables (same stubs × same
banner) **cell by cell** with one arithmetic operation — the "table maths" that
`ADDTAB` and `BANKED_TABLE` don't do: *this wave minus last wave*, *segment
indexed to total*, *brand A as a share of the category*.

| `<op>` | Result of each cell | Default `ON` measure |
|--------|---------------------|----------------------|
| `'A' + 'B'` | sum of the chosen measure | `col_pct` |
| `'A' - 'B'` | difference (wave-on-wave Δ) | `col_pct` |
| `'A' * 'B'` | product | `col_pct` |
| `'A' / 'B'` | ratio | `col_pct` |
| `'A' INDEX 'B'` | `A ÷ B × 100` — **index, 100 = parity** | `col_pct` |
| `'A' SHARE 'B'` | `A ÷ B × 100` — A as a **% share** of B | `n` |

- **`ON measure`** picks which stored statistic of each source cell is read —
  `col_pct`, `n`, `weighted_n`, `mean`, or `row_pct`. `INDEX` and `SHARE` are the
  same `÷ × 100` formula with different defaults (a rate-index reads percentages,
  a volume-share reads counts); both are overridable with `ON`.
- A `MANIP` result is a **computed-value table**: each cell shows one number (the
  result of the op), rendered like a mean/numeric table — no `%` sign. A
  *difference* of percentages is in **percentage-points**, an `INDEX` is a
  ratio × 100; the unit is conveyed by the title, not a symbol. Decimals follow
  the **left** source's `DECIMALS` / `MEAN_DECIMALS` (default 2).
- NET rows are computed like any other row; HEADING rows stay blank; the base row
  is inherited from the **left** source. A cell whose divisor is 0, or where
  either source cell is blank (no base / not applicable), renders **blank**.
- Both sources must be declared **earlier** and share the same sections, stub
  order, and banner columns — otherwise the op raises an error.
- **Chaining:** a derived table's value lives in the `mean` slot, so a later
  `MANIP` reads it with `ON mean`. Feed derived results back in to build longer
  expressions (both operands of the second op must be derived tables).

**Worked example — wave-on-wave change.** Two awareness tables, then their
percentage-point difference:

```mrs
TABLE 'Awareness — 2025' NAME 'A25' STUBS $brand BANNER $region STATS col_pct, n END TABLE
TABLE 'Awareness — 2024' NAME 'A24' STUBS $brand BANNER $region STATS col_pct, n END TABLE

MANIP 'A25' - 'A24' ON col_pct TITLE 'Awareness Δ (2025 vs 2024)' NAME 'AwDelta'
```

If `A25` reads `Brand X = 62%` in the North column and `A24` reads `55%`, the
`AwDelta` table shows `Brand X = 7.0` there (a 7-point gain). A region where a
brand fell shows a negative number. To index this year's rate against last year's
instead (100 = no change), use `MANIP 'A25' INDEX 'A24'` → `62 ÷ 55 × 100 ≈ 112.7`.

---

## 21. Auto-tabulation — AUTOTAB / VARS() {#auto-tab}

`AUTOTAB` generates **one banner table per variable** for all — or a filtered
subset of — your dataset's **codebook** variables, so you never have to hand-write
a `TABLE … END TABLE` block for every question in a survey.

```mrs
SOURCE "survey.sav"
%RESPID = $respondent_id

BANNER Demographics @age_group, $gender, $region END BANNER

FORMAT
    STATS  col_pct, n, sig
    BANNER Demographics
END FORMAT

AUTOTAB VARS()          -- one crosstab per tabulatable codebook variable
END AUTOTAB
```

That two-line block is the classic *"tab the whole survey by the standard banner"*
job: each generated table is an ordinary banner table — `STUBS <variable>` plus the
banner — titled from the variable's **label**, carrying the `STATS` / `BANNER` /
`WEIGHT` from `FORMAT`. Because each one is a normal table, **significance,
weighting, `SORT`, `INDEX`, `MIN_BASE`, decimals, `SHEET`, text + Excel rendering,
and persistence all work unchanged** — `AUTOTAB` is purely an authoring shortcut
that expands into N tables after the data is loaded.

### What `VARS()` selects

`VARS()` (empty) selects every **source variable** that is meaningfully
crosstabbable:

- **Included:** `single_punch`, `multi_binary`, and `numeric` source variables.
- **Excluded:** `open_end` (free text), the `%RESPID` variable, and weight
  variables.
- **Order:** **codebook / source order** — the order the questions appear in the
  data file, so the run reads top-to-bottom like the questionnaire.

> Derived (`@`) variables are **not** auto-tabbed — `AUTOTAB` reads the *codebook*
> (the source variables). Tab derived nets/recodes with explicit `TABLE` blocks.

### Selecting a subset — the `VARS(...)` filter

Put a comma-separated list of selector terms inside the parentheses:

| Term | Meaning |
|------|---------|
| `$q1` | **explicit pick** — include this exact variable (sets listed order) |
| `TYPE single_punch` | restrict to this variable type (repeat for more: `TYPE single_punch, TYPE numeric`) |
| `LIKE "att_*"` | restrict to vars whose **name** matches this glob (case-insensitive) |
| `EXCLUDE $q99` | drop this variable |
| `EXCLUDE LIKE "*_oe"` | drop vars whose name matches this glob |

They compose: the candidate set is your explicit picks (in listed order) — or the
whole default universe if you give none — then `TYPE` and `LIKE` narrow it and
`EXCLUDE` removes from it. An empty result is an error (loosen the filter).

```mrs
AUTOTAB VARS($q1, $q5, $q10)                 -- just these three, in this order
    BANNER $gender
    STATS  col_pct, n
END AUTOTAB

AUTOTAB VARS(TYPE single_punch, LIKE "att_*", EXCLUDE $att_open)
    BANNER Demographics                       -- AUTOTAB clauses override FORMAT
    SORT   col_pct DESC
    SHEET  "Attitudes"
END AUTOTAB
```

### Inheritance

An `AUTOTAB` block accepts the shared (non-row-axis) `TABLE` clauses — `BANNER`
(inline or named), `STATS` (incl. `STATS +`), `WEIGHT`, `FILTER`, `SHEET`, `SORT`,
`INDEX`, `STATS_ONLY`, and the FORMAT directives (`MIN_BASE`, `DECIMALS`,
`SHOW_TOTAL`, …). Every clause you put on the block applies to **all** generated
tables; a clause you omit falls back to the global `FORMAT` block exactly as it
would for a hand-written table with no such clause. So an `AUTOTAB` clause
*overrides* `FORMAT` for the generated tables, and anything you leave off is
inherited from `FORMAT`.

The **row-axis / TYPE clauses** — `STUBS`, `DISTRIBUTION`, `ADD`, `COLUMN`,
`TYPE GRID`, `TYPE SUMMARY`, `STATEMENTS`, `MEASURE`, `SCALE` — are **not** allowed
inside `AUTOTAB` (the validator rejects them): `VARS()` *is* the row axis, and every
generated table is a plain `STUBS <variable>` banner table. An `AUTOTAB` inside a
`SCOPE` inherits that scope's filter and base label like any table.

### Worked example

With the data above (`gender`, `age`, `q1`, `region`, plus the `%RESPID`
`respondent_id`), `AUTOTAB VARS()` produces **four** tables — *Gender*, *Age*,
*Overall Satisfaction*, *Region* (`respondent_id` is the `%RESPID` and is skipped) —
each crossed by the `Demographics` banner from `FORMAT`. To restrict the run to the
single-punch attitude battery and drop the open-end follow-up:

```mrs
AUTOTAB VARS(TYPE single_punch, LIKE "att_*", EXCLUDE $att_other)
    BANNER $gender
    STATS  col_pct, n, sig
END AUTOTAB
```

→ one significance-tested *att_1 … att_N* table per matching variable, all on the
default sheet, in codebook order.
