# Part 2 · Data input

## 5. SOURCE {#source}

```mrs
SOURCE [name] "file" [AS fmt] [DATA "companion"] [CODEBOOK "book"] [SCHEMA "layout"]
```

Declares a data file. A script may declare one `SOURCE` (the common case) or several
named `SOURCE`s combined with `APPEND` / `JOIN` (see [§7](#append--join)).

### Clauses

| Clause | Meaning |
|--------|---------|
| `name` | Optional dataset name (an unquoted identifier). Required only when more than one `SOURCE` is declared, so `APPEND` / `JOIN` can refer to each file by name. |
| `AS fmt` | Force the loader format instead of detecting it from the file extension (see table below). |
| `DATA "file"` | Companion data file for split formats (Triple-S / MDD-DDF), where metadata and case data live in separate files. |
| `CODEBOOK "file"` | Sidecar metadata file (JSON) supplying labels, value labels, missing codes, types, and scores for code-only data. Applied first; inline `VARIABLE` blocks ([§10](setup-blocks.md#variable)) then override it (inline wins). |
| `SCHEMA "file"` | Fixed-width column layout file for the `ascii` format. |

### Formats

| `fmt` | Format | Status |
|-------|--------|--------|
| `spss` | SPSS `.sav` | **implemented** |
| `csv` | comma-separated | **implemented** |
| `triple_s` | Triple-S XML + data file | **implemented** |
| `ascii` | fixed-width + JSON schema | **implemented** |
| `mdd` | Dimensions `.mdd`/`.ddf` | deferred (convert-first strategy) |

> `mdd` is registered but its reader is not yet built — using it raises a clear
> error. The planned approach is convert-first: export from Dimensions / SurveyToGo
> to Parquet + codebook JSON, then load via the existing path.

**Format detection** is by file extension (`.sav`→`spss`, `.csv`→`csv`,
`.sss`→`triple_s`, `.mdd`→`mdd`) unless `AS` overrides it. ASCII has no standard
extension — always use `AS ascii SCHEMA "layout.json"`.

### Examples

```mrs
SOURCE 'C:\Projects\Toothpaste\data.sav'                        // SPSS, auto-detected
SOURCE 'data/survey.csv'                                         // CSV, auto-detected
SOURCE "raw/codes.csv" CODEBOOK "meta/book.json"                 // coded CSV + codebook
SOURCE "data.txt" AS csv                                         // force CSV on a .txt file
SOURCE "survey.sss" AS triple_s DATA "survey.dat"                // Triple-S (fixed-width data)
SOURCE "survey.sss" AS triple_s DATA "survey.csv"                // Triple-S (CSV data)
SOURCE "raw.dat"    AS ascii SCHEMA "layout.json"                // fixed-width ASCII + schema
```

!!! note "Notes"

    - Source variable names come from the file's column names.
    - SPSS variable labels and value labels load automatically as defaults; all are
      overridable in `VARIABLE` blocks ([§10](setup-blocks.md#variable)) or a `CODEBOOK`.
    - SPSS missing-range metadata is **not** auto-applied — declare missing codes in
      the script ([§31](reference-details.md#missing-values)) so scripts behave
      identically across formats.
    - Triple-S `missing="true"` codes in the SSS are similarly not auto-applied.
    - The CLI flag `--data FILE` overrides the `SOURCE` path for single-source
      scripts (see [§23](output.md#cli)).

---

## 5a. Triple-S format {#triple-s}

Triple-S (`.sss` + companion data file) is the standard interchange format for survey
data. Tablix parses the XML metadata file and the companion data file (fixed-width or
CSV). Both Triple-S v1.1 and v2.0/2.0.1 are supported.

### Variable type mapping

| SSS type | DataFrame column | Tablix type |
|----------|-----------------|-------------|
| `single` | one coded column | `single_punch` (if has values) or `numeric` |
| `multiple` | N binary columns `{name}_{code}` | `multi_binary` per column |
| `quantity` | one numeric column | `numeric` |
| `character` | one text column | `open_end` |
| `logical` | treated as `single` | `single_punch` or `numeric` |

**Multiple-response variables** are expanded into N individual `0`/`1` columns — one
per code — named `{variable}_{code}` (e.g. `media_1`, `media_2`, `media_3`). A
`VariableGroup` named after the SSS variable links all the columns.

### Data file auto-detection

Tablix detects the data format by extension:

- Extension `.csv` or `.tsv` → **CSV path**: columns matched by SSS variable order,
  `multiple` variables expanded to N consecutive columns.
- Any other extension → **fixed-width path**: character positions sliced by the `<position
  start="N" finish="M"/>` element.

### Example

```mrs
SOURCE "survey.sss" AS triple_s DATA "survey.dat"
%RESPID = $resp_id

VARIABLE $gender MISSING 9 END VARIABLE

TABLE "Gender × Region"
    STUBS  $gender
    BANNER $region
    STATS  n, col_pct, sig
END TABLE

// Multiple-response channels — each binary column tabulates independently:
TABLE "Media reach"
    STUBS $media_1, $media_2, $media_3
    STATS n, col_pct
END TABLE
```

### Parquet sidecar cache

On first load Tablix writes `{data_file}.tss.cache.parquet` (and an `.md5` checksum
file). Subsequent loads hit the cache for fast startup. The cache key is the data
file's MD5 — the SSS metadata is re-parsed each load (fast) and updates the
`VariableStore` from the freshly-read XML.

### Missing codes

Codes marked `missing="true"` in the SSS are loaded raw and visible in the data — not
automatically excluded. Declare them in the script so behaviour is explicit and
portable:

```mrs
VARIABLE $gender
    MISSING 9   // "Not stated" flagged in the SSS
END VARIABLE
```

---

## 5b. ASCII fixed-width format {#ascii}

Load a fixed-width data file (`.dat`) with a JSON schema describing the column layout.
The schema is supplied as `SCHEMA "layout.json"` on the `SOURCE` clause.

### Schema format

```json
{
  "columns": [
    {"name": "resp_id",  "start": 1,  "width": 5},
    {"name": "gender",   "start": 6,  "width": 1,
     "label": "Gender",
     "values": {"1": "Male", "2": "Female"}},
    {"name": "score",    "start": 7,  "width": 5, "decimals": 2,
     "label": "Score (0.00–99.99)"},
    {"name": "age",      "start": 12, "width": 3, "label": "Age"}
  ]
}
```

**Column spec fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Column name (becomes the `$` source variable). |
| `start` | Yes | 1-indexed character start position. |
| `width` | Yes | Number of characters to read. |
| `label` | No | Variable label (defaults to `name`). |
| `decimals` | No | Implied decimal places — raw integer divided by 10^d (e.g. `decimals=2`, raw `"04525"` → `45.25`). Default `0`. |
| `values` | No | Value-label dict, string keys → string labels. Columns with value labels become `single_punch`. |
| `missing` | No | List of integer missing codes. Loaded raw — not auto-applied (declare via `VARIABLE … MISSING`). |

**Positions** are 1-indexed and inclusive. A blank field (all spaces) becomes `null`.

### Type detection

| Column shape | Detected type |
|---|---|
| Has `values` dict | `single_punch` |
| String / text content | `open_end` |
| Only `0` / `1` values | `multi_binary` |
| Any other numeric | `numeric` |

Decimal columns (`decimals > 0`) are always `numeric` (float).

### Example

```mrs
SOURCE "raw.dat" AS ascii SCHEMA "layout.json"
%RESPID = $resp_id

VARIABLE $gender MISSING 9 END VARIABLE

TABLE "Gender breakdown"
    STUBS  $gender
    STATS  n, col_pct
END TABLE
```

### The codebook JSON format

Used by `CODEBOOK` and by the codebook written by `EXPORT DATA` ([§22](output.md#export-data)):

```json
{
  "variables": {
    "$gender": {"label": "Gender", "type": "single_punch",
                "values": {"1": "Male", "2": "Female"}},
    "$q1":     {"label": "Satisfaction",
                "values": {"1": "Low", "5": "High"},
                "missing": [99], "scores": {"1": 1, "5": 5}}
  }
}
```

---

## 6. %RESPID — canonical respondent key {#respid}

```mrs
%RESPID = $source_var
```

Binds the reserved constant `%RESPID` to the variable that uniquely identifies a
respondent. One declaration per script; the variable must exist and not be
open-ended text.

**Effects**

- Enables `BASE respondents` on a **non-stacked** table — counts de-duplicate by the
  real respondent key (useful when raw data has multiple rows per respondent).
  Without `%RESPID`, `BASE respondents` on a non-stacked table is a validation error.
- On a `STACK`ed (`LEVEL`) table, unique-respondent counts follow the true
  respondent across exposures, instead of a positional index.
- Is the key used by `JOIN … ON %RESPID` ([§7](#append--join)).

`%RESPID` is **optional**. A job that tabulates without it still runs, but emits a
non-fatal advisory.

```mrs
SOURCE 'survey.sav'
%RESPID = $respondent_id
```

---

## 7. APPEND / JOIN (combining multiple files) {#append--join}

Declare several **named** `SOURCE`s, then combine them with exactly one `APPEND` or
`JOIN` into a single working dataset. Everything downstream (transforms, tables,
export) is unchanged — it just sees one combined dataset.

### APPEND — stack rows (waves / more respondents)

```mrs
APPEND name1, name2 [, name3 ...]
```

Concatenates the rows of the named datasets, unioning columns (a column missing from
one file is null-filled there). Variable metadata is merged; the first file's
definition wins on shared columns.

```mrs
SOURCE w1 'wave1.sav'
SOURCE w2 'wave2.sav'
APPEND w1, w2
TABLE 'Gender (both waves)' STUBS $gender END TABLE
```

### JOIN — add columns (profiling / more variables)

```mrs
JOIN left WITH right ON %RESPID|$keyvar [TYPE left|inner]
```

Matches rows of the two datasets on a key column and adds the right file's non-key
columns. The key is `%RESPID` (requires a `%RESPID` declaration) or an explicit
`$variable` present in both files. `TYPE` is `left` (default — keep all left rows) or
`inner` (matched rows only).

A non-key column present in **both** files is an error: rename, drop, or recode one
side first (only the key may be shared).

```mrs
SOURCE main 'respondents.sav'
SOURCE prof 'demographics.sav'
%RESPID = $respondent_id
JOIN main WITH prof ON %RESPID
TABLE 'Income (from profile file)' STUBS $income END TABLE
```

!!! note "Rules"

    - When more than one `SOURCE` is declared, each must be named and exactly one
      `APPEND`/`JOIN` must reference them.
    - One combine operation per script (chained append-then-join is not yet
      supported).

### MERGE — join an auxiliary file onto the working frame, in script order {#merge}

```mrs
MERGE "file" [AS fmt] [SHEET "s"] ON %RESPID|$key
             [KEY "filecol"] [PREFIX name] [TYPE left|inner]
```

Unlike `APPEND`/`JOIN` (a one-time assembly step, done once before any cleaning),
`MERGE` is a **data-preparation statement** — it runs **in script order**, wherever
you write it (after `%RESPID`, after cleaning, anywhere), and it is **chainable**:
write as many `MERGE` statements as you need, e.g. to pull in several sheets of an
open-end coding workbook one at a time. The file is read through the same loader
registry as `SOURCE` (any format: csv / parquet / excel / sav), then left-joined onto
the current working data on the respondent key.

| Clause | Meaning |
|--------|---------|
| `ON %RESPID\|$key` | Join key on the **working frame** (needs a `%RESPID` declaration, or an existing `$var`). |
| `KEY "filecol"` | The matching column's name **inside the file being merged**, when it differs from the working-frame key. |
| `PREFIX name` | Prefix every added column with `name_` — essential when several merged files/sheets share column names (e.g. `Code1..Code10` across coding sheets). Referenced later as `$name_Code1`. |
| `TYPE` | `left` (default — keep every working-frame row; non-matches get blanks) or `inner` (matched rows only). |

The join key's data type is coerced to match the working frame's automatically (an
Excel key read as text/float still matches an integer id). A merged column that
clashes with an existing one, with no `PREFIX`, is an error.

```mrs
SOURCE "survey.sav"
%RESPID = $SbjNum
MERGE "coding.xlsx" SHEET "Q4a_likes" ON %RESPID PREFIX q4a
SPREAD @likes FROM $q4a_Code1, $q4a_Code2, $q4a_Code3
TABLE "Likes" STUBS @likes END TABLE
```

**Which one should I use?** Two waves of the *same* questionnaire, stacked → `APPEND`.
A one-time profiling file for the same respondents, needed at the top of the script →
`JOIN`. An open-end coding sheet (or several) you want to pull in at whatever point
makes sense, possibly more than once → `MERGE`.

## 7a. AGGREGATE — roll exposure/diary rows up to respondent level {#aggregate}

Survey data is sometimes held at the **exposure / diary / transaction level** — one
row per item bought, per media contact, per shopping trip — when the analysis unit is
the **respondent**. `AGGREGATE` collapses that file to **one row per respondent**, in
script, so the whole load → roll-up → tabulate loop stays in one replayable script.
(It is the inverse of `STACK`, which goes wide→long.)

```mrs
AGGREGATE TO respondent
    BY     $respondent_id        // grouping key (a $var; usually the %RESPID var)
    COLUMN $spend   SUM          // total spend per respondent
    COLUMN $trips   COUNT        // number of non-null rows (trips) per respondent
    COLUMN $brand   FIRST        // the first row's brand per respondent
    COLUMN $rating  MEAN         // mean rating
    COLUMN $rating  MIN          // lowest rating
    COLUMN $rating  MAX          // highest rating
END AGGREGATE
```

The block groups the working frame by the `BY` key and builds one **output column**
per `COLUMN` directive. It runs **in script order**, in the same pass as `EDIT` /
`RECODE` / `COMPUTE` ([Part 4](data-preparation.md)), so everything downstream
(`%RESPID`, `DERIVE`, `TABLE`, `EXPORT DATA`) sees the rolled-up frame.

### Aggregate functions

| Function | Result | Output type |
|----------|--------|-------------|
| `SUM`   | sum of the column over the group | `numeric` |
| `COUNT` | count of **non-null** values in the group | `numeric` |
| `MEAN`  | arithmetic mean | `numeric` |
| `MIN`   | minimum value | `numeric` |
| `MAX`   | maximum value | `numeric` |
| `FIRST` | the **first** row's value (data order) | **inherited** from the source variable |
| `LAST`  | the **last** row's value (data order) | **inherited** from the source variable |

`SUM`/`COUNT`/`MEAN`/`MIN`/`MAX` produce a plain `numeric` column (value labels are
dropped). `FIRST`/`LAST` keep one value per group and **inherit the source variable's
type, value labels, stubs, missing codes, and scores** — ideal for metadata that is
constant per respondent but repeated on every exposure row (a brand, a demographic, a
segment).

### Which columns survive

The analyst declares **everything they want**: the `BY` key is kept as-is, and only
the columns named by a `COLUMN` directive are produced. **Any other column is
dropped.** The variable store is rebuilt from just those columns.

### Output column names

An output column takes the **bare source name** (`COLUMN $spend SUM` → `$spend`). When
the **same source variable carries more than one directive**, each output is suffixed
with the function name so they don't clash:

```mrs
COLUMN $rating MEAN    // → $rating_mean
COLUMN $rating MIN     // → $rating_min
COLUMN $rating MAX     // → $rating_max
```

Reference the rolled-up columns by these names downstream.

### Example

```mrs
SOURCE "media_diary.sav"

AGGREGATE TO respondent
    BY     $respondent_id
    COLUMN $minutes  SUM         // total viewing minutes
    COLUMN $channel  FIRST       // first channel watched (keeps its labels)
    COLUMN $rating   MEAN
END AGGREGATE

%RESPID = $respondent_id
TABLE 'Total viewing minutes' DISTRIBUTION $minutes STATS n, mean END TABLE
TABLE 'First channel'         STUBS $channel        STATS col_pct, n END TABLE
```

!!! note "Rules & limits (v1)"

    - The `BY` variable and every `COLUMN` variable must exist in the data; the
      computed output names must be unique and must not collide with the `BY` key
      (all validator-enforced).
    - The `BY` variable should be the respondent key (declare it with `%RESPID`);
      one rollup is one *level* — chained multi-level rollups are not modelled.
    - Because `AGGREGATE` **drops** the un-aggregated columns, a later `TABLE` that
      references a dropped column fails at run time, not at validation (the validator
      is not yet grain-aware). Declare every column you intend to tabulate.
