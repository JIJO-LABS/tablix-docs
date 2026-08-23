# Part 9 · Quick reference

## 33. All keywords at a glance

### Preprocessor (pre-parse)

```text
SET   DEFINE … END DEFINE   CALL          (text substitution + macro inlining)
```

### Authoring layer (.mrst → .mrs, transpiled before everything below)

```text
#for … #endfor   #if / #elif / #else … #endif   #set   #include   (## escapes #)
#// comment                                                          (comment — stripped at transpile time, whole-line or inline)
Loop sources   inline list · #set list · lo..hi range · SHEET("f","Tab") · CSV("f")
Interpolation  {name}  {row.column}  {loop.index|count|first|last}
```

### Top-level statements

```text
SOURCE  %RESPID  APPEND  JOIN  MERGE  AGGREGATE  CONFIG  FORMAT  VARIABLE
DERIVE  SPREAD  COMBINE  STACK  EDIT  RECODE  KEEP ROWS  DROP ROWS  COMPUTE  RIM
BANNER (named)  TABLE  SCOPE  EXPORT DATA
ADDTAB  BANKED_TABLE  MANIP                       (cross-table ops — reference stored tables by NAME)
AUTOTAB … END AUTOTAB                             (one banner table per VARS()-selected codebook variable)
EXPECT                                            (routing assertions / data QC)
```

### Block closers

```text
END CONFIG   END FORMAT   END VARIABLE   END DERIVE   END STACK   END AGGREGATE
END TABLE    END BANNER   END DEFINE   END RIM   END AUTOTAB   ENDNET   ENDHEADING   ENDSCOPE
```

### Clauses by block

| Context | Clauses |
|---------|---------|
| `SOURCE` | `AS`  `DATA`  `CODEBOOK`  `SCHEMA`  `SHEET`  `LABEL`  `CODE`  (+ optional name) |
| `JOIN` | `WITH`  `ON`  `%RESPID`  `TYPE` (left \| inner) |
| `APPEND` | `AS @var` (produces a source-tag variable) |
| `MERGE` | `AS`  `SHEET`  `ON`  `KEY`  `PREFIX`  `TYPE` (left \| inner) — chainable, in-script-order file join |
| `CONFIG` | `OUTPUT`  `SIG_CONFIDENCE`  `SIG_CORRECTION` (none \| bonferroni \| bh)  `SIG_COMPARE`  `SIG_TAILS` (1 \| 2)  `SIG_MEAN_TEST` (exact_t \| normal)  `SIG_DEFF`  `MISSING_TREATMENT`  `DEFAULT_STATS`  `SUPPRESS_STACKED_SIG`  `SUPPRESS_GRID_SIG`  `SUPPRESS_WAVE_SIG` |
| `FORMAT` / `TABLE` shared | `STATS`  `BANNER`  `WEIGHT`  `BASE_LABEL`  `BASE_DESCRIPTION`  `FOOTER`  `THOUSANDS_SEPARATOR`  `MIN_BASE`  `CONFIDENTIAL`  `BLANK_SUPPRESS`  `SUPPRESS_EMPTY`  `AUTONUMBER`  `RANKING`  `SORT` (`ASC`/`DESC`/`ON`/`TOTAL`)  `SHOW_TOTAL`  `MAX_COL_WIDTH`  `DECIMALS`  `PCT_DECIMALS`  `COUNT_DECIMALS`  `MEAN_DECIMALS`  `PCT_SIGN`  `NPS PROMOTERS lo..hi DETRACTORS lo..hi`  `NPS_DECIMALS` |
| `TABLE`-only | `STUBS`  `DISTRIBUTION`  `ADD`  `SECTION LABEL`  `LEVEL`  `BASE`  `FILTER`  `SHEET`  `STATS_ONLY`  `NAME`  `INDEX` (`ON $var=code` \| `ON TOTAL`) |
| `GRID` table | `TYPE GRID`  `COLUMN`  `LABEL`  `FILTER`  `ANSWERED_BASE` |
| `SUMMARY` table | `TYPE SUMMARY`  `STATEMENTS`  `MEASURE` (`TOP`/`BOTTOM`/`NET`/`mean`/`median`/`nps`/…)  `SCALE` |
| `TURF` table | `TYPE TURF`  `ITEMS`  `SIZE k`/`SIZE lo..hi`  `REPORT` (reach \| incremental \| frequency)  `METHOD` (exact \| greedy \| auto) |
| `VARIABLE` | `LABEL`  `TYPE`  `VALUE`  `MISSING`  `STATS_EXCLUDE`  `SCORE` |
| `DERIVE` | `LABEL`  `TYPE`  `SCORE`  `STUB`  `NET`  `ENDNET`  `HEADING`  `ENDHEADING` |
| `STUB` display props | `DISPLAY` (pct_only \| count_only \| row_pct)  `SUPPRESS`  `CUMULATIVE`  `DECIMALS`  `KEEP_IF_ZERO` |
| `SPREAD` | `FROM $slot1, $slot2, …`  `CODES lo..hi \| c1,c2,…`  `LABEL` — reassemble multiple-category ("spread") slots into one multi-response `@var` |
| `COMBINE` | `FROM var1, var2, …`  `LABEL` — merge same-codeframe `$`/`@` variables (different groups/waves) into one multi-response `@var` |
| `STACK` (single-axis) | `POSITIONS`  `MAP`  `FROM` |
| `STACK` (multi-axis) | `AXIS`  `AT`  `DROP EMPTY`  `NULL`  (also `MAP`  `FROM`) |
| `EDIT` / `RECODE` | `SET`  `WHERE`  `INTO`  `ELSE`  (`->`) |
| `COMPUTE` functions | `round`  `abs`  `sqrt`  `min`  `max`  `count(@listvar)` (#selected codes in a multi-response var) |
| `AGGREGATE` | `TO <level>`  `BY $key`  `COLUMN $var FUNC` — `FUNC` ∈ `SUM` \| `COUNT` \| `MEAN` \| `MIN` \| `MAX` \| `FIRST` \| `LAST` (rolls rows up to one row per `BY` value) |
| `EXPORT DATA` | `AS`  `SOURCE_ONLY`  `CODEBOOK` |
| `RIM` | `DIMENSION`  `TARGETS`  `MAX_ITERATIONS`  `CONVERGENCE`  `WEIGHT_CAP`  `BASE_WEIGHT` |
| `ADDTAB` | `TITLE`  `NAME`  (source table names as quoted strings) |
| `BANKED_TABLE` | `TITLE`  `NAME`  (stub-source name + source table names as quoted strings) |
| `MANIP` | `+` `-` `*` `/` `INDEX` `SHARE` (op between two table names)  `ON` (`col_pct`/`n`/`weighted_n`/`mean`/`row_pct`)  `TITLE`  `NAME` |
| `AUTOTAB` | `VARS(` `$var`  `TYPE t`  `LIKE "glob"`  `EXCLUDE $var`  `EXCLUDE LIKE "glob"` `)` + any `FORMAT`/`TABLE` shared clause — one banner table per selected codebook variable |
| `EXPECT` | `WHERE`  `MISSING`  `ANSWERED`  (condition or sugar form) |

### Values

| Group | Values |
|-------|--------|
| Condition keywords | `AND`  `OR`  `NOT`  `IN`  `BETWEEN`  `ALL` |
| STATS values | `n`  `col_pct`  `row_pct`  `weighted_n`  `sig`  `mean`  `std_dev`  `std_error`  `median`  `quartile(N)`  `mode`  `sum`  `sum_of_squares`  `error_variance`  `nps` |
| Type values | `single_punch`  `multi_punch`  `numeric`  `open_end`  `multi_binary` |
| Variable prefixes | `$` (source)  `@` (derived)  `%RESPID` (respondent key) |

---

## 34. CLI commands at a glance

| Command | What it does |
|---------|-------------|
| `mrscript run script.mrs` | Execute script, print text tables to stdout |
| `mrscript export script.mrs out.csv` | Execute script, write CSV (`.xlsx` / `.html` / `.pptx` also supported) output |
| `mrscript export-data script.mrs out.sav` | Execute script, write transformed dataset |
| `mrscript build script.mrst` | Transpile `.mrst` authoring file to `.mrs` |
| `mrscript health script.mrs` | Run data-quality checks, print report |
| `mrscript diff old.sav new.sav --key $id` | Compare two data deliveries |
| `mrscript reconcile script.mrs plan.xlsx` | Validate script against a client tab plan |
| `mrscript assist "tab q1 by gender" --data survey.sav` | Generate a TABLE/DERIVE block from plain English |
| `mrscript suggest $q1 --data survey.sav` | Suggest NET/recode groupings from value labels as a DERIVE |
| `mrscript code script.mrs $why --frame frame.csv --out coded.csv [--ai]` | Code open-end verbatims into a theme frame (0/1 dichotomy CSV) |
| `mrscript provenance script.mrs --table 1 --row 5 --col "$gender=1"` | Drill one table cell to its contributing respondent IDs |
| `mrscript table-diff last_week/ this_week/` | Diff two table runs: added/removed tables, structural changes, cell-value shifts |
| `mrscript table-diff v1.mrs v2.mrs --data survey.sav --fail-on warn` | Diff two scripts side-by-side, exit 1 if any structural changes |
| `mrscript run survey.mrs --out-store runs/week12/` | Run script and save TableStore + audit manifest to a directory |
| `mrscript export survey.mrs report.csv --out-store runs/week12/` | Export output and also save TableStore + audit manifest |
| `mrscript project run project.yml` | Batch-run all scripts in a YAML project |

---

## 35. Common script patterns

The full, copy-pasteable pattern library lives on the **[How-to recipes](../guide/patterns.md)**
page — profile tables, significance crosstabs, T2B, computed indices, APPEND/JOIN,
concept tests, diaries, GRID batteries, SUMMARY top-box batteries, ADD pooling, and
reproducible-dataset export.

---

## Planned features (not yet implemented) {#planned-features}

Scripts using these will error until the feature ships.

| Area | Planned |
|------|---------|
| **Input readers** | `AS mdd` is registered but raises "not supported" — the supported path is convert-first from the Dimensions runtime (export to `.sav`/`.csv`/`.parquet` + `CODEBOOK`). `triple_s` and `ascii` are **fully implemented**. |
| **What-if scenarios** | `SCENARIO` blocks + per-table `COMPARE` producing baseline vs scenario Δ / %Δ tables. |
| **Cross-table operations** | `CEPX` re-emit (route a stored table to a second output destination). `ADDTAB` (wave merge), `BANKED_TABLE` (side-by-side), and `MANIP` (cell arithmetic / derived tables, e.g. `T1 − T2`, index, share) are **implemented** — see [§20](tables.md#cross-table). |
| **Extra significance** | chi-square, t-test (pairs), Kolmogorov-Smirnov, Mann-Whitney. `SIG_TAILS`, `SIG_CORRECTION bh` (Benjamini–Hochberg FDR), and `SIG_MEAN_TEST exact_t` are **implemented** — see [§28](reference-details.md#sig-strategy). |
| **More COMPUTE** | `round(x, n)` decimals; `log` / `exp` / `floor` / `ceil` / `clip`; conditional `COMPUTE … WHERE`. |
| **Output formats** | Word (`.docx`), PDF; Triple-S / XtabML export. PowerPoint is **implemented** — see [§23](output.md#cli). |
| **Multi-file (more)** | Chained append-then-join; `RENAME` / suffix to resolve `JOIN` column clashes; right / outer joins. |
