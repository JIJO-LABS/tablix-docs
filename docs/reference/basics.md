# Part 1 · Basics

## 1. Script structure

A script is a flat sequence of top-level statements processed top-to-bottom. There
is no mandatory ordering, but the logical convention is:

```mrs
SOURCE   'file.sav'                  // data input (one or more)
%RESPID  = $respondent_id            // optional respondent key

CONFIG  ...  END CONFIG              // execution settings
FORMAT  ...  END FORMAT              // display defaults

VARIABLE $var ... END VARIABLE       // metadata overrides

// Data preparation — materialized in SCRIPT ORDER, interleaved:
DERIVE  @var ... END DERIVE          // computed variables
EDIT    $var SET n WHERE cond        // conditional value edit
RECODE  $var (...) INTO @new         // value remap
COMPUTE @x = $a / $b                 // arithmetic
DROP ROWS WHERE cond                 // row filter
STACK   @name ... END STACK          // wide → long reshape

TABLE 'title' ... END TABLE          // output tables
SCOPE WHERE cond ... ENDSCOPE        // pre-filtered table groups

EXPORT DATA 'clean.sav'              // write the cleaned data back out
```

Data-preparation statements (`DERIVE`, `EDIT`, `RECODE`, `KEEP`/`DROP ROWS`,
`COMPUTE`) run in the exact order written. A later statement sees the effect of every
earlier one — e.g. an `EDIT` can clean a column that a later `DERIVE` reads. The
script is, in effect, the reproducible transformation log: re-running it reproduces
the cleaned dataset exactly.

---

## 2. Comments

```mrs
// Line comment — everything after // to end of line is ignored

/* Block comment — everything between the delimiters
   can span multiple lines */

SOURCE 'data.sav'   // load the fieldwork file

/* ── Gender split analysis ─────────────────────
   Tables T1–T3 cover demographic profiling.
   ──────────────────────────────────────────── */
```

Inside a `.mrst` authoring file there is an additional comment form for the `#`-directive
layer — see [Authoring-layer comments](#authoring-layer-comments) in §4c below.

---

## 3. Variable naming conventions

| Prefix | Meaning | Examples |
|--------|---------|----------|
| `$name` | **Source** variable — a column from the data file (SPSS / CSV column) | `$gender`, `$q1`, `$AGE_CAT`, `$A_S13_1` |
| `@name` | **Derived** variable — created in the script by `DERIVE`, `STACK`, `COMPUTE`, or a `RECODE`/`EDIT … INTO @new` clause | `@ageband`, `@concerns`, `@trial`, `@bmi` |
| `%NAME` | **Reserved** constant. Currently only `%RESPID` exists (see [§6](data-input.md#respid)) | `%RESPID` |

Names are **case-sensitive**. `$` and `@` are mandatory prefixes — they distinguish
source from derived variables and let both share the same stem (e.g. `$brand` and
`@brand` are different variables). The engine strips the prefix to get the underlying
column name (`$gender` → column `gender`).

**Naming rules**

- First character after the prefix must be a letter or underscore.
- Subsequent characters may be letters, digits, or underscores.
- No spaces in variable names.

---

## 4. String literals and quoting

Strings are used for titles, labels, footer text, file paths, mask strings, etc.

| Form | Syntax | When to use |
|------|--------|-------------|
| Single-quoted | `'text'` | Standard form |
| Double-quoted | `"text with an apostrophe's"` | Use when the text contains a `'` |
| Empty string | `''` or `""` | Explicit blank label |

```mrs
LABEL "Children's toothpaste"      // apostrophe inside double quotes
SOURCE 'data/survey.sav'           // file path
FOOTER "Source: Survey 2025"
```

---

## 4b. Preprocessor (SET substitution & DEFINE / CALL macros)

Two text passes run **before** the parser, so they apply anywhere in the script
(titles, paths, column refs, sheet names, conditions). Order: `SET` first, then
`DEFINE`/`CALL`.

### SET — text substitution

```mrs
SET name = value
```

Defines a substitution: every `{name}` in the rest of the script is replaced by
`value` (a literal text swap). The value may be quoted (single/double — the outer
quotes are stripped) or bare; the `SET` line itself is removed. Use it to
parameterise a wave year, a brand stem, a column prefix, a cut code, etc.

```mrs
SET brand = Uber
SET city  = 1

TABLE '{brand} Awareness'
  STUBS  ${brand}_Q1             // → $Uber_Q1
  FILTER $QCITY = {city}         // → $QCITY = 1
END TABLE
```

A `SET` value can also be overridden from **outside** the script, without
editing the file — the `SET` line stays as the default, and a caller supplies
a different value for one particular run:

```bash
mrscript run script.mrs --set brand=Careem --set city=2   # repeatable
```

In the desktop app, the **Sweep** panel (sidebar) runs one script once per row
of a parameter table, each row overriding a different set of `SET` values (and
optionally a different data file per row) — "run this script with N different
parameter sets," one output file per row. See [Output formats & the
CLI](output.md#cli).

### Reusing a clause bundle across many tables {#clause-bundles}

`SET` substitutes raw text, so a value can be a **group of table clauses**, not
just a word. That gives you one place to change how a whole family of tables is
based, levelled or scored — instead of repeating the clauses on every `TABLE`:

```mrs
SET PB      = LEVEL @EVAL BASE respondents
SET PBSCALE = LEVEL @EVAL BASE respondents  STATS n, col_pct, mean, std_dev

TABLE 'S2. Location'   STUBS $S2    {PB}       END TABLE
TABLE 'Q7. Colour'     STUBS @K_Q7  {PBSCALE}  END TABLE
```

This is the shortcut for a deck where some tables run at respondent level and
others at product / exposure level. Combine it with the two facts that make the
repetition avoidable in the first place:

* Put the **most common banner in [`FORMAT`](setup-blocks.md#format)**. A global
  `FORMAT` applies to *every* table regardless of where the block sits in the
  file — a table written above `FORMAT` gets the same defaults as one below it —
  so those tables need no `BANNER` clause at all.
* Give each *other* family a `SET` bundle, as above.

A 50-table deck then carries one short token per table and one place to edit.

Two rules:

* **A `SET` value must not reference another `SET`.** Substitution is a single
  pass in declaration order, so `SET B = {A} …` only resolves when `A` is
  declared *after* `B` — which is the opposite of what you would expect. Write
  each bundle out in full instead.
* The text is inlined verbatim, so keep the clauses valid for every table that
  uses the bundle.

`DEFINE` / `CALL` (below) does the same job when the bundle spans several lines;
`SET` is the better fit for a one-line clause tail because it keeps the whole
`TABLE … END TABLE` on one line.

### DEFINE / CALL — macro inlining

```mrs
DEFINE block_name
  … any MRScript statements …
END DEFINE

CALL block_name                  // on its own line
```

The `DEFINE` body is inlined verbatim at every `CALL` site — reuse a common stub
list, banner, or table block without copy-paste. Macro bodies may use `SET` variables
(`SET` runs first). `DEFINE` / `END DEFINE` and `CALL` must each sit on their own
line; an unknown `CALL` leaves an error comment. Nesting (`DEFINE` inside `DEFINE`,
or `CALL` inside a body) is not supported.

```mrs
DEFINE std_demos
  STUBS @ageband, $gender, $region
END DEFINE

TABLE 'Awareness'
  CALL std_demos                 // → STUBS @ageband, $gender, $region
  BANNER $wave
END TABLE
```

---

## 4c. Authoring layer (.mrst)

The authoring layer is an **optional** superset that sits above MRScript. You write a
`.mrst` file — mostly ordinary MRScript with a little control flow mixed in — and it
is transpiled to a plain `.mrs` that the engine runs unchanged. It removes repetition:
generate a battery of near-identical tables, drive tables from an Excel / CSV "tab
plan", share fragments across a tracker, and switch tables on by wave or country.

```text
report.mrst  ──[transpile]──►  report.mrs  ──►  engine  ──►  tables
 (meta + native)               (pure native, on disk)
```

### Running it

```powershell
mrscript run   report.mrst          # Transpile to report.mrs, then run it.
mrscript build report.mrst          # Transpile only (write report.mrs, no run).
mrscript build report.mrst --map    # Also write report.mrs.map (source map).
```

`run` / `export` / `export-data` all accept either `.mrst` or `.mrs`. A `.mrst`
always (re)writes its sibling `.mrs` beside it, headed
`// GENERATED FROM <file> — do not edit`; that `.mrs` is the reproducible artifact
(commit it).

### Two rules

1. A line whose first non-blank character is `#` is a **directive** (control flow).
   Every other line is literal MRScript, emitted verbatim. (Native MRScript never
   begins a line with `#`.) Write `##` to emit a literal leading `#`.
2. `{name}` interpolates a value into a line — the same `{…}` substitution `SET` uses
   (§4b), extended to loop variables, spreadsheet columns, and loop counters.

How it relates to §4b: the authoring layer runs **first** and produces the `.mrs`;
the `SET` / `DEFINE`-`CALL` preprocessor then runs on that `.mrs`. Any `{token}` the
authoring layer does not recognise is passed through untouched.

### Directives

| Directive | Purpose |
|-----------|---------|
| `#for NAME in <source>` … `#endfor` | Loop; nestable |
| `#if <cond>` … `#endif` | Conditional |
| `#elif <cond>` / `#else` | Extra branches within an `#if` |
| `#set NAME = <value>` | Bind a value (scalar or comma list); `= [ … ]` may span lines ([below](#set-brackets)) |
| `#include "file.mrst"` | Inline another `.mrst` file |
| `#// comment text` | Authoring-layer comment (see below) |

Each block has its **own typed closer** — `#endfor` for `#for`, `#endif` for `#if`.
There is no generic `#end`; a mismatched closer is an error, so nesting stays
unambiguous. A `#set` scalar is read as `{NAME}`; a comma value
(`#set brands = coke, pepsi`) is a list that `#for` can iterate; a quoted value keeps
its commas (`#set t = "A, B"` is one scalar).

### Long lists across several lines — `#set NAME = [ … ]` {#set-brackets}

A list of 13 statement labels on one physical line is unreadable and unreviewable in a
diff. Wrap the value in brackets and it may span as many lines as you like:

```mrs
#set Q41_LABELS = [
  "Easy to open",             // one item per line
  "Comfortable to hold",      // each with its own trailing comment
  "Right size for my fridge"  #// '#//' works here too
]
```

The lines are joined with single spaces into **exactly the string a one-line `#set`
would have held**, so nothing downstream needs to know the bracket form exists — `#for`
iteration and `{NAME[i]}` indexing behave identically. Three things to know:

* **Each item carries its own comma.** The join adds spaces, not commas — a line
  without a trailing comma is glued onto the next item.
* **A bare `//` is a comment here**, unlike anywhere else in a `#set` value. An ordinary
  one-line `#set` treats `//` as data, because the value may legitimately be a URL or a
  UNC path (`#set u = https://x.test/a`); a bracketed list holds plain label text, where
  a stray `// note` is far more likely than a literal `//`. Quoted items are still
  protected, so `"a // b"` survives intact.
* Closing is by a line **ending in `]`**, not real bracket matching, so a literal
  `[` or `]` inside an item isn't supported. `[ … ]` all on one line is accepted too,
  as a purely cosmetic wrapper.

### Authoring-layer comments {#authoring-layer-comments}

Ordinary `//` and `/* */` comments apply to the **MRScript lines** in a `.mrst` file.
For the `#`-directive lines themselves, use `#//`:

```mrs
#// This whole line is a comment — stripped at transpile time, never reaches .mrs

#set market = IN   #// inline: the value is just IN, the #// and everything after is removed
#for p in 1..3   #// loop over three concept positions
TABLE 'Concept {p}' STUBS @c{p} END TABLE
#endfor
```

Two forms:

| Form | Syntax | Effect |
|------|--------|--------|
| Whole-line | `#// comment` | The entire line is dropped from the generated `.mrs` |
| Inline | `#set x = 5   #// note` | The `#//` and everything after it is removed from the directive; the directive runs normally |

`#//` is used instead of `//` because directive values legitimately contain `//`
(URLs, UNC paths like `//server/share`). The inline form only cuts at a `#//`
preceded by whitespace, so values with `://` in them are preserved. Quoted values
are also protected — `#set url = 'https://example.com'  #// a comment` correctly
keeps the full URL.

### Loop sources (what `#for` iterates)

| Source | Example | Yields |
|--------|---------|--------|
| inline list | `#for q in q1, q2, q3` | each item, as `{q}` |
| `#set` list | `#set bs = a,b` … `#for b in bs` | each item, as `{b}` |
| range `lo..hi` | `#for n in 1..20` | each integer, as `{n}` |
| `SHEET("f","Tab")` | `#for row in SHEET("plan.xlsx","Tabs")` | one row per sheet row |
| `CSV("f")` | `#for row in CSV("plan.csv")` | one row per CSV row |

Range bounds may be interpolated (`1..{hi}`) and may count down (`5..1`). SHEET / CSV
paths resolve relative to the `.mrst` file; reading `.xlsx` needs openpyxl (CSV does
not). In a tab plan the first row is the header; column names are normalised to
identifiers (lower-cased, runs of non-letters → `_`), so a "Table Title" column is
read as `{row.table_title}`. An empty cell is the empty string (false in `#if`); a
fully blank row is skipped; integer cells drop a trailing `.0`.

### Interpolation `{…}`

| Token | Meaning |
|-------|---------|
| `{name}` | a `#set` or `#for` variable |
| `{row.column}` | a tab-plan cell (dotted access into the row) |
| `{loop.index}` | 1-based position in the nearest `#for`; also `{loop.count}`, `{loop.first}` / `{loop.last}` ("1" when true, "" when false) |

Unknown `{tokens}` pass through unchanged. `{loop.index}` is the table-numbering
counter.

!!! note "A comma in a `#set` value makes it a list — and a bare `{name}` pastes it back"

    `#set` splits on commas to build the lists `#for` iterates. A bare `{name}`
    (no `[INDEX]`) re-joins that list with `", "`, which is the text you wrote:

    ```
    #set SCALE = STATS n, col_pct, mean      // → a 3-item list
    TABLE 'T' STUBS $q1 {SCALE} END TABLE    // → STATS n, col_pct, mean
    ```

    So a clause bundle round-trips, and `#set` is fine for one. Only the
    whitespace around each comma is normalised.

    **The one thing that does not survive: quotes.** Each item is unquoted when
    it is stored, so pasting the whole list back loses them — and a quoted item
    that itself contains a comma becomes indistinguishable from two items:

    ```
    #set LABELS = "First one", "Second, with comma", "Third"
    // {LABELS}     → First one, Second, with comma, Third   ← 4 commas, quotes gone
    // {LABELS[2]}  → Second, with comma                     ← intact
    ```

    Label lists are therefore addressed by index (`{LABELS[{i}]}` inside a `#for`),
    and MRScript's own **`SET`** ([above](#clause-bundles)) remains the better fit
    when a value must stay byte-identical, since it is a plain text swap with no
    list semantics at all. Because unknown `{tokens}` pass through the transpiler
    untouched, a `SET` written in a `.mrst` survives into the generated `.mrs` and
    is resolved there — so both layers coexist.

### Conditions (`#if` / `#elif`)

- Comparison: `=  !=  <  <=  >  >=`  ·  Membership: `in`  ·  Boolean: `and  or  not`
- Parentheses group; a bare value is true when non-empty and non-zero. Operands are
  `{name}`, a number, or a `'quoted string'` (bare words are reserved for operators).
  Numeric operands compare numerically, otherwise as text.

```mrs
#if {wave} >= 2 and {country} in 1, 2, 3   …   #endif
```

### Scope (sequential)

A `#set` is visible to following lines and to nested blocks. A `#set` inside the
chosen `#if` branch — or inside an `#include` — leaks out to later siblings (the
"pick a value per wave" pattern). A `#for` body runs in its own copy, so its `#set`s
and loop variable stay loop-local.

### `#include` (shared fragments / trackers)

Inlines another `.mrst` at that point, expanded in the **same** scope. Paths are
relative to the including file; cycles are detected and reported. Use it for one
shared base plus thin per-wave / per-market files.

### Errors & source map

Transpile errors carry the file and line; an error inside an `#included` file names
**that** file (e.g. `banner.mrst:3`). `build --map` writes `report.mrs.map` (JSON) —
a (file, line) origin for every generated line, tracing back through loops and
includes. (Engine errors still report against the generated `.mrs`; open it to
inspect.)

### Example — drive tables from a CSV tab plan

```text
plan.csv:
    var, title,                    stats
    q1,  Overall Satisfaction,     "col_pct, n"
    q2,  Likelihood to Recommend,  "col_pct, n, mean"
```

```mrs
SOURCE "survey.sav"
BANNER TheBanner $age, $gender END BANNER
#for row in CSV("plan.csv")
TABLE "{row.title}" STUBS @{row.var} BANNER TheBanner
    STATS {row.stats}
END TABLE
#endfor
// →  one TABLE block per row of the plan, written to report.mrs.
```

### Example — battery + conditional (a tracker fragment)

```mrs
#include "common/banner.mrst"      // shared BANNER definition
#for n in 1..10
TABLE "Statement {n} (table {loop.index})" STUBS @s{n} BANNER Std
    STATS col_pct, n
#if {n} <= 5
    SHOW_TOTAL "Top block"
#endif
END TABLE
#endfor
```
