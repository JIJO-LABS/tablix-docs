# Part 8 · Reference details

## 28. STATS values — complete list {#stats-values}

### Distribution stats (per stub row)

| Stat | Meaning |
|------|---------|
| `n` | Unweighted count in the cell. |
| `col_pct` | Column %: cell n as % of the column base. |
| `row_pct` | Row %: cell n as % of the row total. |
| `weighted_n` | Sum of weights (requires `WEIGHT`; adds weighted `col_pct`). |
| `sig` | Significance flags (see below). |

**`sig`** — distribution rows use a pooled two-proportion **Z-test** (overlap-adjusted
when banner columns share respondents); a Mean row uses an independent-samples
(**Welch**) t-test. Columns are lettered in the header as `Label (B)`; a cell flagged
`B` is significantly **higher** than column B at the `SIG_CONFIDENCE` level
(UPPERCASE = high CL, lowercase = low CL in dual mode). Which columns are compared
follows `SIG_COMPARE` — `segment` (within each banner group), `all` (every column),
`total` (each vs the Total), or `prior` (**wave-on-wave**: each column vs the one
immediately to its left, within each segment, treated as independent samples —
approximate for same-respondent panel data; see [setup-blocks §8](setup-blocks.md#config)).
A banner column below the table's `MIN_BASE` is excluded from testing. The letters
render on their own row beneath each stub's count and percentage rows; multiple letters
are separated (`B/C`).

#### Significance strategy {#sig-strategy}

Four `CONFIG` knobs tune *how* the test is run (all default to the status quo except
`SIG_MEAN_TEST`, whose default is the more honest exact-t). Full table:
[setup-blocks §8](setup-blocks.md#config).

| `CONFIG` knob | Values (default **bold**) | What it changes |
|---------------|---------------------------|-----------------|
| `SIG_TAILS` | **`2`** \| `1` | Two-tailed vs one-tailed (directional). One-tailed halves the p-value (cut drops from `z₀.₀₂₅` to `z₀.₀₅`), keeping the "higher than" letter convention. Applies to **both** proportion and mean tests. |
| `SIG_MEAN_TEST` | **`exact_t`** \| `normal` | The **Mean** row's critical value: the exact Student-t at the Welch–Satterthwaite degrees of freedom (`exact_t`, honest at small bases — e.g. df 2 needs `t = 4.30`, not `z = 1.96`), or the older normal approximation (`normal`). Proportions are always normal. |
| `SIG_CORRECTION` | **`none`** \| `bonferroni` \| `bh` | Multiple-comparison correction over the m pairs in each comparison group. `none` = raw α; `bonferroni` = α/m (family-wise error rate); `bh` = Benjamini–Hochberg step-up (false-discovery rate — more powerful than Bonferroni when several differences are real). |
| `SIG_DEFF` | **`1.0`** \| `≥ 1.0` | Design effect — divides the effective bases by DEFF before the statistic (SE inflates by √DEFF). A rough global correction for clustered/complex samples. |

**Multiple comparisons in plain terms.** When a table compares many column pairs, some
will look "significant" by chance. `bonferroni` is strict — it guarantees a low chance
of *any* false positive, but kills real findings when there are many columns. `bh`
(Benjamini–Hochberg) instead caps the expected *proportion of mistakes among the cells
you flagged* — so with several genuine differences it keeps far more power than
Bonferroni while still controlling error. Both run **per comparison group** (the same
cliques `SIG_COMPARE` defines), so the family size is the group's pair count, never the
whole table.

The text-renderer legend names whichever strategy is active beneath the table.

### Summary stats (appended below the distribution; numeric/scored variables)

| Stat | Meaning |
|------|---------|
| `mean` | Arithmetic mean (of scored values, or raw for numeric). |
| `std_dev` | Standard deviation. |
| `std_error` | Standard error of the mean. |
| `median` | Median (50th percentile). |
| `quartile(N)` | Nth percentile, N an integer 0–100 (e.g. `quartile(25)`). |
| `mode` | Most frequent value. |
| `sum` | Σx. |
| `sum_of_squares` | Σx². |
| `error_variance` | Σx² / n (or weighted equivalent). |
| `nps` | Net Promoter Score (see below). |
| `responses` | Total Responses — sum of leaf-stub counts (multi-select item picks), see below. |
| `mean_responses` | Mean Responses — average items picked per respondent, see below. |

!!! note "Notes"

    - Summary stats on a **categorical** variable use its `SCORE` clauses when
      declared; otherwise each **code is used as its own score** (code = score),
      matching `DISTRIBUTION` and numeric variables. A multi-response (list) variable
      needs an explicit `SCORE` — a code-mean over a list of codes is not meaningful.
    - Numeric variables use their raw values.
    - All summary stats honour `WEIGHT` (weighted sums / Kish effective base).

#### Net Promoter Score (`nps`) {#nps}

`nps` adds a signed **NPS** row (−100…+100, no `%`) below the distribution, computed
per banner column over that column's valid base:

```text
NPS = %promoters − %detractors          (passives stay in the base)
```

| Band | Default codes | Role |
|------|---------------|------|
| Promoters  | `9..10` | `+` |
| Passives   | `7..8`  | in the base, contribute 0 |
| Detractors | `0..6`  | `−` |

- **Bands** default to the classic 0–10 NPS. Override per `TABLE` or in `FORMAT` with
  `NPS PROMOTERS lo..hi DETRACTORS lo..hi` (passives are the codes in between; the base
  spans `min(lo)..max(hi)`). The bands are **absolute code ranges**, independent of a
  `SCALE` clause.
- **Decimals** default to **0** (NPS is a whole signed number); `NPS_DECIMALS n`
  overrides (falls back to the umbrella `DECIMALS`).
- **Significance** (`STATS … sig`): NPS is a *difference of two proportions sharing one
  base*, so its variance is the **multinomial** form
  `Var(p̂_P − p̂_D) = [(p_P + p_D) − (p_P − p_D)²] / n` and two banner columns are
  compared with a normal z on `s_j/n_j + s_k/n_k` (`s = (p_P + p_D) − d²`). It honours
  `SIG_TAILS` / `SIG_CORRECTION` / `SIG_DEFF` / `MIN_BASE` / dual-CL and the
  `SIG_COMPARE` topology. Overlapping columns (multi-response banner, or `SIG_COMPARE
  total`) are **skipped** (like the mean test) — NPS letters appear under the
  `segment` / `all` / `prior` topologies over disjoint banner columns.
- Composes as a **`TYPE SUMMARY` measure** (`MEASURE nps "NPS"`) and wave-merges under
  `ADDTAB` (counts add; NPS re-derives over the combined base).

```mrs
TABLE "Likelihood to recommend — NPS"
    STUBS  $recommend                  -- the 0–10 question
    BANNER $gender
    STATS  col_pct, n, nps, sig
END TABLE
```

```text
                               Total    Male (A)  Female (B)
... (0–10 distribution rows) ...
  NPS                              0          40         -40
                                               B
```

(Male's NPS +40 is significantly higher than Female's −40 at 95%, so the Male column
carries Female's letter `B`.)

#### Total and Mean Response Counts (`responses`, `mean_responses`) {#responses}

For multi-select / multi-punch questions (a `DERIVE`d list variable, or a `SPREAD`),
these two rows report how many items each respondent selected:

| Stat | Meaning |
|------|---------|
| `responses` | **Total Responses** — sum of every leaf-stub count in the section, per banner column (the total number of items picked by everyone in that column). Unweighted: always a whole number. Weighted: sum of weights (fractional). |
| `mean_responses` | **Mean Responses** — average items selected per respondent, over the column's valid base. Always equals `Σ(leaf col_pct) / 100` — e.g. three brands at 60%/70%/50% col_pct gives Mean Responses `1.80`. |

```mrs
DERIVE @aware LABEL "Brands aware of"
    STUB 1 "Sony"    WHERE $aware_sony = 1
    STUB 2 "Apple"   WHERE $aware_apple = 1
    STUB 3 "Samsung" WHERE $aware_samsung = 1
END DERIVE

TABLE "Brand awareness"
    STUBS  @aware
    BANNER $region
    STATS  col_pct, n, responses, mean_responses, sig
END TABLE
```

```text
                    Total      North      South
Sony                  60%        80%        40%
Apple                 70%        80%        60%
Samsung               50%        40%        60%
BASE                   10          5          5
Total Responses        18          8         10
Mean Responses        1.80       1.60       2.00
                                             B
```

(South's Mean Responses is significantly higher than North's — the `B` flag sits
under South, since South is being compared against North's letter.)

- **Applicable to:** `STUBS`, `DISTRIBUTION`, and `ADD` tables (v1 scope). `LEVEL`
  (stacked), `GRID`, `SUMMARY`, and `TURF` tables are deferred.
- **Decimals:** `responses` uses `COUNT_DECIMALS` (default **0** — unweighted counts
  are always integers; a weighted table typically sets `COUNT_DECIMALS 1` or `2` since
  the weighted sum is fractional). `mean_responses` uses `MEAN_DECIMALS` (default **2**).
- **Labels:** override with `RESPONSES_LABEL 'text'` / `MEAN_RESPONSES_LABEL 'text'` in
  `FORMAT` or per-`TABLE` (defaults: "Total Responses" / "Mean Responses";
  [§9](setup-blocks.md#format)).
- **Significance:** only `mean_responses` is tested (independent-samples Welch t, like
  any other Mean row). `responses` is a supporting count and is never flagged.
- **ADDTAB:** `responses` sums across merged waves; `mean_responses` is re-derived over
  the combined base (both ride `StatAccum`, so the merge is exact).
- **NET / HEADING rows are excluded** from the count — only leaf stubs contribute.
- Works on **single-punch** variables too (each respondent contributes at most 1, so
  `mean_responses` is just the pick-rate — same info as `n`, expressed as an average).

---

## 29. Condition syntax {#conditions}

Conditions appear after `WHERE` in `STUB`, `EDIT`, `KEEP`/`DROP ROWS`, `FILTER`, and
`SCOPE`.

| Form | Syntax | Examples |
|------|--------|----------|
| Simple comparison | `$var OP value` — `OP ∈ = != > >= < <=` | `$AGE_CAT = 2`, `$q1 >= 4`, `$score != 99` |
| Set membership | `$var IN (v1, v2, …)` | `$q1 IN (4, 5)`, `$region IN (1, 2, 3)` |
| Range (inclusive) | `$var BETWEEN lo AND hi` | `$age BETWEEN 25 AND 34` |
| Logical | `cond AND cond`, `cond OR cond`, `NOT cond`, `(cond)` | `$gender = 1 AND $age >= 30` |
| Catch-all | `ALL` — matches every row | `STUB 9 'Everyone' WHERE ALL` |

```mrs
$q1 IN (4, 5) OR $q2 IN (4, 5)
($gender = 1 OR $gender = 2) AND $q1 >= 3
```

Conditions may reference source (`$`) and earlier-defined `@variables`. (Arithmetic
expressions like `$a + $b` are only available inside `COMPUTE`
([§16](data-preparation.md#compute)) — not in conditions, which are comparison-based.)

---

## 30. Base computation {#base}

The base is the per-column denominator for column percentages:

```text
base_n[col] = count( banner_col_mask AND valid_mask )
```

`valid_mask` = is-not-null **AND** not in a declared `MISSING` code. System missing
(`.`) is always excluded.

**Weighted base** — when `WEIGHT` is active, three base rows appear:

| Row | Meaning |
|-----|---------|
| `n` | Unweighted count |
| `weighted_n` | Sum of weights |
| `effective_n` | Kish effective base: (Σw)² / Σ(w²) |

**Respondent base** — `BASE respondents` counts unique respondents (by `%RESPID`). On
a stacked (`LEVEL`) table it corrects for rotation; on a non-stacked table it
de-duplicates rows.

---

## 31. Missing values {#missing-values}

MRScript applies a strict **"the script is the authority"** principle — nothing in the
data file is automatically treated as missing.

| Kind | Behaviour |
|------|-----------|
| **System missing** (`.`) | Stored as null; always excluded; never a table row. |
| **User-defined missing** | Real numeric codes (99 = Don't know, 98 = Refused, −1 = N/A) preserved as values. Exclude them by declaring them: `VARIABLE $q1 MISSING 99 END VARIABLE`. Effect: the code's stub is removed and those respondents drop out of the base. |
| **SPSS `.sav` missing ranges** | Intentionally **not** read — declare missing codes in the script (or a `CODEBOOK`), so scripts behave identically across CSV / Triple-S / ASCII / MDD, which have no "missing range" concept. |

---

## 32. STATS modes — inherit / override / merge {#stats-modes}

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| **Inherit** | no `STATS` clause | Table uses `FORMAT STATS` exactly (or `CONFIG DEFAULT_STATS`, else `col_pct, n`). |
| **Override** | `STATS …` (without `+`) | Table uses exactly the listed stats; `FORMAT STATS` is replaced. |
| **Merge** | `STATS + …` | `FORMAT STATS` first, then the listed extras appended (no duplicates). |

```mrs
// Override
STATS n, col_pct, sig

// Merge
FORMAT STATS n, col_pct END FORMAT
... STATS + mean, std_dev, median    // → n, col_pct, mean, std_dev, median
```

`STATS_ONLY` may combine with any mode: the stats are computed, but only the summary
rows render.
