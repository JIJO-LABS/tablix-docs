# How-to recipes

Task-oriented snippets for things DP users do all the time. Each is a complete,
copy-pasteable fragment — adapt the variable names to your data. For the full rules
behind any clause, follow the links into the [reference](../reference/index.md).

!!! tip "How to use this page"

    Find the task that matches what you need, copy the block, swap in your variable
    names. These are the same patterns you'll reach for again and again.

---

## Profile table (counts + %, masked small bases)

A clean sample-profile table with a low-base mask.

```mrs
FORMAT
  STATS      n, col_pct
  BASE_LABEL 'Respondents'
  MIN_BASE   20 MASK 'n<20'
END FORMAT

TABLE 'Sample profile'
  STUBS @age_group, $gender, $region
END TABLE
```

`STUBS a, b, c` stacks three sections in one table. See
[STUBS](../reference/tables.md#row-axis).

---

## Crosstab with significance

```mrs
TABLE 'Brushing frequency by age'
  STUBS  $q5
  BANNER @age_group
  STATS  n, col_pct, sig
END TABLE
```

Configure the test with [`CONFIG SIG_CONFIDENCE / SIG_COMPARE / SIG_CORRECTION`](../reference/setup-blocks.md#config).

---

## Choose a significance strategy (one-tailed / FDR / exact-t / design effect)

Tune *how* the test runs with four composable `CONFIG` knobs — useful for directional
hypotheses, many-column banners, small-base means, and clustered samples:

```mrs
CONFIG
  SIG_CONFIDENCE  95
  SIG_TAILS       1          -- one-tailed: only flag a column that is HIGHER
  SIG_MEAN_TEST   exact_t    -- exact Student-t for Mean rows (the default)
  SIG_CORRECTION  bh         -- Benjamini–Hochberg FDR (more power than bonferroni)
  SIG_DEFF        1.5        -- clustered design: inflate the SE by √1.5
END CONFIG

TABLE 'Agreement by region'
  STUBS  $agree
  BANNER $region
  STATS  col_pct, n, mean, sig
END TABLE
```

- **`SIG_TAILS 1`** — directional test (cut drops to `z₀.₀₅ = 1.645` at 95%).
- **`SIG_MEAN_TEST exact_t`** (default) — honest at tiny bases (df 2 needs `t = 4.30`,
  not `z = 1.96`); use `normal` for the old z-approximation.
- **`SIG_CORRECTION bh`** — controls the false-discovery rate; sits between `none`
  (most flags) and `bonferroni` (fewest) when several differences are real.
- **`SIG_DEFF 1.5`** — a rough complex-sample correction (deflates the effective bases).

Full reference: [`CONFIG` §8](../reference/setup-blocks.md#config) ·
[Significance strategy](../reference/reference-details.md#sig-strategy).

---

## Sort a table by a banner column

Order rows by the value in any banner column — here, brands ranked by their share
in the *Female* column, high→low. Columns are named by **variable + code**, not by
label.

```mrs
TABLE 'Brand awareness by gender'
  STUBS  $brand
  BANNER $gender
  STATS  col_pct, n
  SORT   col_pct DESC ON $gender = 2   // Female column; omit ON to sort by Total
END TABLE
```

`SORT` keeps structure intact — `NET` and `HEADING` rows stay anchored and summary
rows (Mean / Std) stay at the bottom. `RANKING descending` is the shorthand for
"sort by the Total column". Full options in [§17 Sorting rows](../reference/tables.md#sorting).

---

## Clean, label and tabulate a coded CSV

CSV columns carry no labels, so label them yourself (or supply a `CODEBOOK`).

```mrs
SOURCE 'raw.csv' CODEBOOK 'book.json'
DROP ROWS WHERE $status != 1               // completes only
EDIT $age SET 999 WHERE $age > 120         // flag impossible ages
VARIABLE $age MISSING 999 END VARIABLE     // then exclude them

TABLE 'Age distribution'
  DISTRIBUTION $age
  STATS n, col_pct, mean
END TABLE
```

`DISTRIBUTION` builds rows from the **actual codes present** in the data — handy for
auditing. See [DISTRIBUTION](../reference/tables.md#row-axis).

---

## Top-2-Box via RECODE

When you just need a quick collapse (no NET sub-rows), `RECODE` is the fastest route.

```mrs
RECODE $q1 (1,2,3 -> 1 "Bottom 3") (4,5 -> 2 "Top 2") INTO @q1_t2b

TABLE 'Satisfaction (T2B)'
  STUBS  @q1_t2b
  BANNER @region
END TABLE
```

For a T2B that keeps its member rows visible, use a `NET` inside `DERIVE` (see the
[tutorial, Step 7](../tutorial/first-crosstab.md#step-7-add-net-rows-top-2-box)).

---

## Export multi-response variables

`EXPORT DATA` on a script that includes a `DERIVE` automatically expands each
multi-response `@` variable into N separate `0`/`1` columns — one per leaf stub code —
before writing. No extra keywords required.

```mrs
SOURCE 'survey.sav'

DERIVE @brand
    STUB 1 'Colgate'   WHERE $q_colgate = 1
    STUB 2 'Sensodyne' WHERE $q_sensodyne = 1
    STUB 3 'Oral-B'    WHERE $q_oralb = 1
END DERIVE

TABLE 'Brand usage'
    STUBS @brand
    STATS n, col_pct
END TABLE

// Export produces brand_1, brand_2, brand_3 columns (0/1 Int)
EXPORT DATA 'clean.sav'
EXPORT DATA 'clean.csv' CODEBOOK 'brand_meta.json'
```

The companion codebook records each dichotomy as a `multi_binary` variable with the
stub label as the variable label — ready to re-apply on a future `SOURCE … CODEBOOK`.

**Notes:**

- `SOURCE_ONLY` drops the dichotomies (they are still `source_format = "derived"`).
- `.parquet` exports the native `List[Int64]` column unchanged — use it when you
  need the original multi-code structure.
- NET and HEADING stubs do not produce dichotomy columns (only leaf stubs do).

---

## Computed index

```mrs
COMPUTE @bmi = $weight / ($height * $height)

TABLE 'BMI'
  DISTRIBUTION @bmi
  STATS mean, std_dev
END TABLE
```

See [COMPUTE](../reference/data-preparation.md#compute).

---

## Profile a table against the total (INDEX)

`INDEX` re-expresses every distribution cell as an index versus a reference banner
column (100 = parity, >100 over-indexes, <100 under-indexes). The default reference
is the Total column; use `ON $var = code` to pick a specific column.

```mrs
TABLE 'Brand consideration — profile'
  STUBS   $brand
  BANNER  $gender
  STATS   col_pct, n
  INDEX                   // reference = Total column
  DECIMALS 0              // whole-number indices read more cleanly
END TABLE
```

The Total column always reads 100 because it is the reference. Base rows are
inherited unchanged (real respondent counts). NET rows are indexed normally; HEADING
rows stay blank; significance is cleared (a ratio has no single base to test).

Combine with `SORT` to order rows by the pre-index rate before rescaling:

```mrs
TABLE 'Brand profile — sorted then indexed'
  STUBS  $brand
  BANNER $gender
  STATS  col_pct, n
  SORT   col_pct DESC      // order by Total % first
  INDEX                    // then re-express as index
  DECIMALS 0
END TABLE
```

To index to a specific column instead of the Total, use `ON`:

```mrs
  INDEX ON $gender = 2     // Female column = 100; other columns vs Female
```

See [Index / profile tables](../reference/tables.md#index).

---

## Combine waves, then tabulate (APPEND)

Stack the rows of two files into one dataset.

```mrs
SOURCE w1 'wave1.sav'
SOURCE w2 'wave2.sav'
APPEND w1, w2

TABLE 'Awareness (pooled)'
  STUBS  $aware
  BANNER $wave
END TABLE
```

**Or tag each wave as you append** (produces an auto-generated @wave variable):

```mrs
SOURCE w1 'wave1.sav'  LABEL 'January'   CODE 1
SOURCE w2 'wave2.sav'  LABEL 'February'  CODE 2
APPEND w1, w2 AS @wave

TABLE 'Awareness by wave'
  STUBS  $aware
  BANNER @wave         // ready to use — no extra recoding
  STATS  col_pct, n
END TABLE
```

The `LABEL` and `CODE` clauses on each source define how rows are tagged. The
`APPEND … AS @wave` produces a `single_punch` variable directly usable in tables.

---

## Wave-on-wave change with MANIP

Tabulate the same question for two periods, then subtract them cell by cell for a
percentage-point delta table (positive = up, negative = down). `MANIP` reads
stored tables — never the data — so the two sources just need the same layout.

```mrs
TABLE 'Awareness — 2025' NAME 'A25' STUBS $brand BANNER $region STATS col_pct, n END TABLE
TABLE 'Awareness — 2024' NAME 'A24' STUBS $brand BANNER $region STATS col_pct, n END TABLE

MANIP 'A25' - 'A24' ON col_pct TITLE 'Awareness Δ (2025 vs 2024)' NAME 'AwDelta'
```

Swap the operator for other table maths: `'A25' INDEX 'A24'` (index this year to
last, 100 = no change), or `'BrandA' SHARE 'Category'` (a brand's count as a % of
the category). See [MANIP](../reference/tables.md#manip).

---

## Wave-on-wave significance (SIG_COMPARE prior)

When the waves sit side by side in **one banner**, `SIG_COMPARE prior` tests each
column against the one immediately before it — the "is this wave significantly
up/down on the last?" read — instead of the full round-robin.

```mrs
CONFIG
  SIG_CONFIDENCE 95
  SIG_COMPARE    prior      -- each wave vs the wave before it
END CONFIG

TABLE 'Awareness by wave'
  STUBS  $brand
  BANNER $wave              -- Q1 (A)  Q2 (B)  Q3 (C)  Q4 (D)
  STATS  col_pct, n, sig
END TABLE
```

A rise is flagged on the later wave (Q2 carrying **A** = up vs Q1); a fall is
flagged on the higher/earlier wave (Q3 carrying **D** = awareness dropped into Q4).
Only adjacent waves are compared — Q3 never carries Q1's letter. The two columns are
treated as **independent samples** (correct for a fresh-sample tracker); for a
same-respondent panel read the flags as approximate, or set `SUPPRESS_WAVE_SIG true`.
See [SIG_COMPARE](../reference/setup-blocks.md#config).

---

## Add profiling variables by JOIN

Match a profile file onto your main file by respondent key.

```mrs
SOURCE main 'respondents.sav'
SOURCE prof 'profile.sav'
%RESPID = $respondent_id
JOIN main WITH prof ON %RESPID

TABLE 'Brand by income'
  STUBS  $brand
  BANNER $income
END TABLE
```

See [APPEND / JOIN](../reference/data-input.md#append--join).

---

## Statistics card (summary only)

Show just the mean/std/median rows, hiding the distribution.

```mrs
TABLE 'Q1 mean by segment'
  STUBS  $q1
  BANNER @age_group
  STATS + mean, std_dev, std_error, median
  STATS_ONLY
END TABLE
```

---

## Rotated concept test (STACK)

Reshape three rotated concept slots into one long frame, then tabulate at that level.

```mrs
STACK @trial
  POSITIONS 1..3
  MAP @product = $I_#_Product_Shown
  MAP @overall = $I_#_Q1
  MAP @pos     = POSITION            // 1/2/3 — which exposure this row is
END STACK

TABLE 'Liking by product'
  LEVEL @trial  STUBS @overall  BANNER @product
END TABLE

TABLE 'Liking by product — first exposure only'   // order-effect check
  LEVEL @trial  STUBS @overall  BANNER @product  FILTER @pos = 1
END TABLE

TABLE 'Reach (unique respondents)'
  LEVEL @trial  STUBS @product  BASE respondents
END TABLE
```

Note which tables carry `BASE respondents`: the reach table counts people, the liking
tables count evaluations, and that is a per-table decision — see
[Choosing the base on a stacked table](../reference/tables.md#stacked-base).

See [STACK](../reference/data-preparation.md#stack).

---

## Clean and export a reproducible dataset

```mrs
SOURCE 'raw.sav'
DROP ROWS WHERE $speeder = 1
RECODE  $q1 (1,2 -> 1) (3,4,5 -> 2) INTO @q1_grp
COMPUTE @score = ($q1 + $q2 + $q3) / 3

EXPORT DATA 'clean.sav'                       // metadata-complete SPSS
EXPORT DATA 'clean.csv' CODEBOOK 'book.json'  // portable data + metadata
```

See [EXPORT DATA](../reference/output.md#export-data).

---

## Diary / nested-loop data (day × occasion)

```mrs
SOURCE 'diary.sav'
%RESPID = $RESPID

STACK @diary
  AXIS day      1..2
  AXIS occasion 1..2
  MAP @day      AT day      FROM $DAY_1, $DAY_2
  MAP @beverage AT occasion FROM $BEV_1_1, $BEV_1_2, $BEV_2_1, $BEV_2_2
  DROP EMPTY @beverage = NULL, 99            // remove unfilled occasions
END STACK

// @day_n, @occasion_n, @diary_slot auto-emitted

TABLE 'Beverages by day'
  STUBS @beverage  BANNER @day_n  LEVEL @diary
END TABLE

TABLE 'Beverage penetration (unique respondents)'
  STUBS @beverage  LEVEL @diary  BASE respondents
END TABLE
```

See [Multi-axis STACK](../reference/data-preparation.md#stack).

---

## Roll up diary data before tabulating (AGGREGATE)

When the raw file is **one row per exposure / trip / transaction** but you tabulate at
the respondent level, `AGGREGATE` collapses it to one row per respondent first — sum
the spend, count the trips, average the rating, and keep the (constant-per-respondent)
brand and demographics with `FIRST`.

```mrs
SOURCE 'shopper_trips.sav'        // many rows per shopper

AGGREGATE TO respondent
  BY     $respondent_id
  COLUMN $spend   SUM             // total spend       → $spend (numeric)
  COLUMN $trip    COUNT           // number of trips    → $trip  (numeric)
  COLUMN $basket  MEAN            // mean basket value  → $basket
  COLUMN $segment FIRST           // keeps its labels   → $segment (categorical)
END AGGREGATE

%RESPID = $respondent_id

TABLE 'Total spend'   DISTRIBUTION $spend STATS n, mean END TABLE
TABLE 'Trips'         DISTRIBUTION $trip  STATS n, mean END TABLE
TABLE 'Spend by segment'
  STUBS $segment  STATS col_pct, n, mean
END TABLE
```

`SUM`/`COUNT`/`MEAN`/`MIN`/`MAX` become numeric columns; `FIRST`/`LAST` inherit the
source variable's labels (so `$segment` still tabulates by its categories). Two
aggregates of the **same** column are suffixed — `COLUMN $rating MEAN` + `COLUMN
$rating MAX` → `$rating_mean`, `$rating_max`. Columns you don't name are dropped, so
declare everything you want to keep.

See [AGGREGATE](../reference/data-input.md#aggregate).

---

## Rating battery as a GRID

Several rating statements side-by-side as columns, each showing its own
distribution + NETs + mean.

```mrs
DERIVE @s1
  NET 'Top 2 Box'    STUB 5 'Strongly agree' WHERE $s1 = 5
                     STUB 4 'Agree'          WHERE $s1 = 4   ENDNET
  STUB 3 'Neutral'   WHERE $s1 = 3
  NET 'Bottom 2 Box' STUB 2 'Disagree'          WHERE $s1 = 2
                     STUB 1 'Strongly disagree' WHERE $s1 = 1  ENDNET
  SCORE 1=1 SCORE 2=2 SCORE 3=3 SCORE 4=4 SCORE 5=5
END DERIVE
// ... @s2, @s3 defined the same way ...

TABLE 'Agreement battery' TYPE GRID
  COLUMN @s1 LABEL 'Statement 1'
  COLUMN @s2 LABEL 'Statement 2'
  COLUMN @s3 LABEL 'Statement 3'
  STATS col_pct, mean
END TABLE
```

See [GRID tables](../reference/tables.md#grid-tables).

---

## Top-box summary of a rating battery (SUMMARY)

Consolidate a whole battery into one table: a block per measure (Top-2-Box, Mean, …),
one row per statement, with demographic banner columns and significance. No need to
pre-derive nets — `MEASURE` builds the boxes from the scale.

```mrs
TABLE 'Agreement battery — summary' TYPE SUMMARY
  STATEMENTS $s1, $s2, $s3
  SCALE 1..5                       -- shared scale; or omit if the vars carry value labels
  MEASURE TOP 2    'Top-2-Box'
  MEASURE BOTTOM 2 'Bottom-2-Box'
  MEASURE mean     'Mean'
  BANNER  $gender
  STATS   col_pct, n, sig
END TABLE
```

Each statement's box % is over its own valid base; significance compares the banner
columns. See [Summary tables](../reference/tables.md#summary).

---

## Find the best product line with TURF (`TYPE TURF`)

Which few flavours / claims / SKUs together reach the most buyers? A TURF table finds
the **best portfolio at each size** and reports its unduplicated **reach**, the
**incremental** lift each added item brings, and the average **frequency** of use.

```mrs
TABLE 'Flavour line — TURF' TYPE TURF
  ITEMS  $flav_choc, $flav_van, $flav_straw, $flav_mint   -- 0/1 "would buy" flags
  SIZE   1..3                                             -- the reach curve
  REPORT reach, incremental, frequency
  METHOD auto                                             -- exact for small sets, else greedy
END TABLE
```

```
                                       Reach %   Incremental   Frequency
Chocolate                                 40.0          40.0        0.40
Chocolate + Strawberry                    80.0          40.0        0.80
Chocolate + Strawberry + Mint             80.0           0.0        1.10
```

`ITEMS` can also be a single multi-response `@list` (one item per code) or a single
categorical `$var` (one item per value). Reach honours `FILTER` / `SCOPE` and `WEIGHT`
(weighted reach). See [TURF analysis](../reference/tables.md#turf).

---

## Report NPS with significance (`nps`)

Add the `nps` stat to any table on a 0–10 recommend question — it appends a signed
**NPS** row (%promoters[9–10] − %detractors[0–6], passives in the base), and with
`sig` it tests columns using the correct difference-of-proportions variance.

```mrs
TABLE 'Likelihood to recommend' STUBS $recommend
  BANNER $gender
  STATS  col_pct, n, nps, sig
END TABLE
```

```text
  NPS                              0          40         -40
                                               B
```

Bands default to 0–10; override with `NPS PROMOTERS 9..10 DETRACTORS 0..6` (e.g. for a
1–10 scale) and set `NPS_DECIMALS 1` if you want a decimal place. NPS also works as a
`TYPE SUMMARY` measure (`MEASURE nps "NPS"`) and wave-merges under `ADDTAB`. See
[NPS](../reference/reference-details.md#nps).

---

## Pool two questions into one section (ADD)

When two questions share a code frame and you want their responses to **add up**.

```mrs
TABLE 'Total brand awareness (Q1 + Q2)'
  ADD    @q1_brand, @q2_brand SECTION LABEL 'Any mention'
  BANNER $gender
  STATS  col_pct, n, sig
END TABLE
```

See [ADD](../reference/tables.md#row-axis).

## Tab the whole survey (AUTOTAB)

Generate one banner table per codebook variable, instead of hand-writing a `TABLE`
block for every question.

```mrs
%RESPID = $respondent_id

FORMAT
  STATS  col_pct, n, sig
  BANNER $gender, $region
END FORMAT

AUTOTAB VARS()          -- every tabulatable variable, crossed by the FORMAT banner
END AUTOTAB
```

Filter to a themed subset and override the banner just for that block:

```mrs
AUTOTAB VARS(TYPE single_punch, LIKE "att_*", EXCLUDE $att_other)
  BANNER @age_group
  SORT   col_pct DESC
  SHEET  "Attitudes"
END AUTOTAB
```

`VARS()` selects source variables in codebook order (`open_end`, the `%RESPID` and
weights excluded); each generated table is a normal banner table that inherits
`FORMAT` and any clause you put on the block. See
[AUTOTAB / VARS()](../reference/tables.md#auto-tab).

---

## Draft a table from plain English (`assist`)

When you know *what* you want but not the exact clause spelling, let the assistant
write the block — it is grounded on your dataset's variables and validates its own
output through the real parser before showing it.

```
mrscript assist "tab q1 by gender and region with col%, n, sig and the mean" --data survey.sav
```

```mrs
TABLE "Overall Satisfaction"
    STUBS $q1
    BANNER $gender, $region
    STATS col_pct, n, sig, mean
END TABLE
```

It also writes `DERIVE` blocks (`--type derive`), and `--out FILE` saves the snippet:

```
mrscript assist "derive age groups under 35, 35-54, 55+" --type derive --out age_group.mrs
```

`assist` needs an AI provider: set `ANTHROPIC_API_KEY` for Anthropic's API, or
`MRSCRIPT_ASSIST_URL` (+ `MRSCRIPT_ASSIST_MODEL`) to use a **local model** (Ollama,
LM Studio) with no key and no cost. With no provider it prints a clear error and
exits — the rest of `mrscript` is unaffected. See [NL
Assistant](../reference/assist.md).

## Suggest nets/recodes from value labels (`suggest`)

When a variable's grouping is *implied by its labels* — a 5-point scale wants
top/bottom-box nets, a brand list wants themed nets — let `suggest` read the labels
and propose a validated `DERIVE`. You name the variable; it picks the grouping.

```
mrscript suggest $q1 --data survey.sav
```

```mrs
DERIVE @q1_grp
    NET "Agree (Top 2 Box)"
        STUB 4 WHERE $q1 = 4
        STUB 5 WHERE $q1 = 5
    ENDNET
    STUB 3 "Neutral" WHERE $q1 = 3
    NET "Disagree (Bottom 2 Box)"
        STUB 1 WHERE $q1 = 1
        STUB 2 WHERE $q1 = 2
    ENDNET
END DERIVE
```

It auto-detects whether the variable is an ordered **scale** (→ top/bottom-box) or
**nominal** (→ thematic nets); force it with `--kind scale|nominal`. `suggest` shares
the same AI-provider setup as `assist` (Anthropic or a local model) and validates the
DERIVE against your data before printing it. See [Recode
Suggester](../reference/suggest.md).

## Code open-ends into themes (`code`)

Turn a free-text verbatim column into countable themes. Write a small **frame** of
themes, then `code` reads the verbatim straight from the survey data and writes a
0/1 matrix (one column per theme) plus a codebook you can re-`SOURCE`.

```csv
code,label
1,Price / value for money
2,Taste / flavour
3,Health / natural ingredients
4,Brand trust / reputation
```

```
mrscript code survey.mrs $why_brand --frame frame.csv \
      --out coded.csv --codebook coded.json --ai
```

`--ai` suggests initial assignments via the same provider setup as `assist`; drop it
for an all-zero **manual shell** you fill in yourself. The output re-imports as a
labelled multi-response group — close the loop and tabulate the themes:

```mrs
SOURCE "coded.csv" CODEBOOK "coded.json"

TABLE "Reasons for choice"
    STUBS $why_brand_1, $why_brand_2, $why_brand_3, $why_brand_4
    BANNER $gender
    STATS n, col_pct
END TABLE
```

The verbatim variable must be `open_end`; to net a *categorical* use
[`suggest`](#suggest-netsrecodes-from-value-labels-suggest) instead. See [Open-End
Coding](../reference/coding.md).

## Drill a cell to its respondents (`provenance`)

When a client asks *"who are the 2 people in the Strongly-Agree / Male cell?"*, drill
the cell back to its respondent IDs — no dropping into SPSS to rebuild the filter:

```
mrscript provenance survey.mrs --table 1 --row 5 --col "$gender = 1" --data survey.sav
```

```
Table 1 - Overall Satisfaction
  Cell:  Strongly Agree (code 5)  x  Male (A)
  Base:  5 in column        Count: 2

  Contributing respondents (%RESPID):
    respondent_id    weight     row
    5                -          4
    10               -          9
```

Address the cell by `--table N` (or a table `NAME`/title), `--row` (a stub code,
stub label, or **NET** label), and `--col` (a column **label**, sig **letter**,
0-based **index**, a `"$var = code"` **condition**, or omit it for the **Total**).
Add `--out worklist.csv` to write the full respondent list (with weights). Weighted
tables report the weighted count Σw; stacked (`LEVEL`) tables list the exposure rows
with the real respondent behind each. See [Cell Provenance](../reference/provenance.md).

---

## Reproducible runs and audit trails (`--out-store`)

When you need to prove *exactly* what script and data produced a set of tabs —
for QC, for a client, or for a future `table-diff` — add `--out-store DIR` to any
`mrscript run` or `mrscript export` invocation:

```bash
# Monday: produce and archive
mrscript run survey.mrs --out-store archive/week22/

# Thursday: corrected script, re-run
mrscript run survey_v2.mrs --out-store archive/week22_v2/

# Diff the two runs; provenance header shows which scripts + commits were used
mrscript table-diff archive/week22/ archive/week22_v2/
```

`--out-store DIR` saves two things to `DIR`:

- The `TableStore` (`manifest.json` + `cells.parquet`) — a replayable snapshot of
  all produced tables, loadable by future `mrscript table-diff` without re-running.
- An **`audit.json`** — records the script SHA-256, data file SHA-256, git commit /
  branch / dirty flag, mrscript version, Python version, and the effective `CONFIG`
  values used for the run.

For `mrscript export`, `--out-store` is additive: the formatted output (CSV or
Excel) is still written as usual, and the store + audit are also saved.

When you later diff two archived runs, `mrscript table-diff` reads the
`audit.json` from each side and prepends a provenance summary:

```
Provenance A:  script survey.mrs   sha 9c3a7b…  run 2026-06-16T09:30:00Z  git main@f3a1b2c
Provenance B:  script survey_v2.mrs  sha 4e1d0f…  run 2026-06-19T14:12:05Z  git main@0dc8e3f

Comparing: week22  (12 tables) → week22_v2  (12 tables)
...
```

Different `sha` values confirm the script changed between runs; `git dirty: true`
warns that there were uncommitted edits at run time.

See [Audit Manifest](../reference/audit-manifest.md) for the full `audit.json`
schema and all CLI options.

---

## Load a Triple-S file

Triple-S (`.sss` + companion data file) is the standard interchange format exported
by most fieldwork platforms (Confirmit, Decipher, SurveyToGo, Forsta, Nebu). Point
Tablix at the `.sss` metadata file and supply the companion data file with `DATA`.

```mrs
SOURCE "survey.sss" AS triple_s DATA "survey.dat"
%RESPID = $resp_id

// Declare missing codes from the SSS (not auto-applied)
VARIABLE $gender MISSING 9 END VARIABLE

TABLE "Gender"
    STUBS  $gender
    BANNER $region
    STATS  n, col_pct, sig
END TABLE
```

The data file is detected as **fixed-width** (`.dat`, `.asc`) or **CSV** (`.csv`,
`.tsv`) by extension. No other change is needed — everything downstream (DERIVE,
STACK, tables, output) works identically to SPSS data.

**Multiple-response variables** in the SSS expand automatically. A `multiple` variable
named `media` with codes 1/2/3 creates columns `$media_1`, `$media_2`, `$media_3`
(each `multi_binary`):

```mrs
SOURCE "survey.sss" AS triple_s DATA "survey.dat"

TABLE "Media channels"
    STUBS  $media_1, $media_2, $media_3
    STATS  n, col_pct
END TABLE
```

See [Triple-S format](../reference/data-input.md#triple-s) for the full variable
type mapping and caching behaviour.

---

## Load a fixed-width ASCII file

Fixed-width `.dat` files (legacy MRDCL / Quantum / government datasets) need a JSON
schema describing the column layout. Pass the schema with `SCHEMA`.

**layout.json** (create this alongside your `.dat` file):
```json
{
  "columns": [
    {"name": "resp_id", "start": 1,  "width": 5, "label": "Respondent ID"},
    {"name": "gender",  "start": 6,  "width": 1, "label": "Gender",
     "values": {"1": "Male", "2": "Female"}},
    {"name": "score",   "start": 7,  "width": 5, "decimals": 2,
     "label": "Score"},
    {"name": "age",     "start": 12, "width": 3, "label": "Age"}
  ]
}
```

**script.mrs:**
```mrs
SOURCE "raw.dat" AS ascii SCHEMA "layout.json"
%RESPID = $resp_id

VARIABLE $gender MISSING 9 END VARIABLE

TABLE "Gender breakdown"
    STUBS  $gender
    STATS  n, col_pct
END TABLE
```

- `start`/`width` are **1-indexed** character positions.
- `decimals` converts an implied decimal — raw `"04525"` with `decimals=2` → `45.25`.
- A blank (all-spaces) field becomes `null`.
- The `CODEBOOK` clause can layer additional metadata on top of the schema.

See [ASCII fixed-width format](../reference/data-input.md#ascii) for the full schema
specification.

---

## Share results as a browser file (HTML viewer)

Export all tables from a run to a single self-contained HTML file that opens offline
in any browser — no Excel, no server, no CDN. Attach it to a Slack thread, email it,
or open it directly on a laptop without any software installed.

```sh
mrscript export script.mrs results.html
mrscript export script.mrs results.html --data latest_wave.sav
```

The file includes a clickable table of contents, a per-table search box that hides
non-matching rows, and sortable column headers (click to sort by that column's
percentage). All table kinds are included: banner tables, GRID, SUMMARY, TURF, and
cross-table outputs.

See [Interactive HTML viewer](../reference/output.md#html) in the output reference.
