# Part 3 · Setup blocks

## 8. CONFIG {#config}

```mrs
CONFIG
  clause*
END CONFIG
```

Script-wide execution settings. All clauses are optional.

| Clause | Values | Meaning |
|--------|--------|---------|
| `OUTPUT` | `text` \| `excel` | Default output format. `text` (default) = plain-text tables; `excel` = workbook. |
| `SIG_CONFIDENCE` | `<pct> [, <pct>]` | Confidence level(s) in **percent** (not an alpha). One value (default `95`) = a single level. Two values (e.g. `99, 95`) = **dual** testing: letters significant at the higher level are UPPERCASE, those significant only at the lower level are lowercase. Each value must be `50 < pct < 100`. |
| `SIG_CORRECTION` | `none` \| `bonferroni` \| `bh` | Multiple-comparison correction across the column pairs in a comparison group. Default `none` (each pair tested at the raw level, matching Quantum/MRDCL/SPSS). `bonferroni` divides alpha by the number of testable pairs (controls the *family-wise* error rate). `bh` is the **Benjamini–Hochberg** false-discovery-rate step-up (controls the expected share of false positives among the *flagged* pairs — more powerful than Bonferroni when several true differences exist). |
| `SIG_COMPARE` | `segment` \| `all` \| `total` \| `prior` | Which columns are compared. Default `segment`. |
| `SIG_TAILS` | `1` \| `2` | One-tailed (directional) or two-tailed test. Default `2`. `1` uses the one-tailed critical value (more powerful for a directional hypothesis); the "higher than" lettering is preserved. Applies to **both** the proportion z-test and the mean t-test. |
| `SIG_MEAN_TEST` | `exact_t` \| `normal` | Critical value for the column-**mean** test. Default `exact_t` — the exact Student-t at the Welch–Satterthwaite degrees of freedom (honest even at very small bases). `normal` keeps the older normal (z) approximation (slightly anticonservative for tiny bases). Proportions are always normal. |
| `SIG_DEFF` | `<float ≥ 1.0>` | Design effect — a rough complex-sample (clustered) correction. Default `1.0` (no adjustment). The effective bases handed to the z/t tests are divided by DEFF before the statistic is formed, so the standard error inflates by √DEFF. A single global knob (not per-column). |
| `MISSING_TREATMENT` | `exclude` \| `show` | Whether missing-coded respondents are excluded. Default `exclude`. |
| `SUPPRESS_STACKED_SIG` | `true` \| `false` | When `true`, drops significance flags from stacked (`LEVEL`) tables, where repeated exposures are not independent. Default `false` (a non-fatal advisory is emitted when sig is kept on a `LEVEL` table). |
| `SUPPRESS_GRID_SIG` | `true` \| `false` | When `true`, drops significance flags from `GRID` tables, whose columns are the same respondents (paired). Default `false` (sig runs; a non-fatal advisory notes the paired approximation). |
| `SUPPRESS_WAVE_SIG` | `true` \| `false` | When `true`, drops significance flags while `SIG_COMPARE prior` is in effect (use for paired/panel data where the independent-sample prior test does not apply). Default `false` (sig runs; a non-fatal advisory notes the independent-sample assumption). |
| `DEFAULT_STATS` | `stat [, stat …]` | Fallback stats if no `FORMAT STATS` exists. Prefer `FORMAT STATS` ([§9](#format)). |

**`SIG_COMPARE` values**

- `segment` — within each innermost banner group only.
- `all` — round-robin across all non-Total columns (cross-segment).
- `total` — each non-Total column against the Total column (Total is lettered and
  participates; needs a Total column shown).
- `prior` — **wave-on-wave**: each column against the one immediately to its left
  (its *prior* column), within each innermost banner segment. The two columns are
  treated as **independent samples** (correct for a fresh-sample tracker;
  approximate for a same-respondent panel — see the worked example).

**Worked example — `SIG_COMPARE prior` (wave-on-wave)**

A four-wave awareness banner, testing each wave against the previous one:

```mrs
CONFIG
  SIG_CONFIDENCE 95
  SIG_COMPARE    prior
END CONFIG

TABLE "Brand awareness by wave"
  STUBS  $brand
  BANNER $wave            -- Q1 (A)  Q2 (B)  Q3 (C)  Q4 (D)
  STATS  col_pct, n, sig
END TABLE
```

Columns are lettered `A B C D` after the Total. `prior` tests only the **adjacent**
pairs A↔B, B↔C, C↔D — never A↔C or A↔D. Letters keep their usual "higher than"
meaning, so for a brand whose awareness was 40 % → 55 % → 58 % → 40 %:

| Wave | Cell | Reading |
|------|------|---------|
| Q2 (B) | `55% ` **A** | up significantly **vs Q1** (the rise is flagged on the later wave) |
| Q3 (C) | `58% ` | vs Q2 not significant — no adjacent letter |
| Q3 (C) | `58% ` **D** | Q3 is significantly higher than Q4 — i.e. awareness **fell into Q4** (a fall is flagged on the higher/earlier column) |

Because each wave is a fresh, independent sample the test is exact. If the waves are
the **same panel respondents**, read the flags as approximate (the within-respondent
correlation is ignored) — a non-fatal advisory says so, and `SUPPRESS_WAVE_SIG true`
drops the flags.

```mrs
CONFIG
  OUTPUT          text
  SIG_CONFIDENCE  99, 95
  SIG_COMPARE     total
  SUPPRESS_STACKED_SIG  true
END CONFIG
```

**Worked example — choosing a significance strategy**

The four sig-strategy knobs compose freely. A typical complex-survey setup with a
directional hypothesis, FDR control across many banner columns, the exact small-base
mean test, and a design-effect correction:

```mrs
CONFIG
  SIG_CONFIDENCE  95
  SIG_TAILS       1          -- directional: only flag a column that is HIGHER
  SIG_MEAN_TEST   exact_t    -- exact Student-t for Mean rows (the default)
  SIG_CORRECTION  bh         -- Benjamini–Hochberg FDR across the column pairs
  SIG_DEFF        1.5        -- clustered design: inflate the SE by √1.5
END CONFIG

TABLE "Agreement by region"
  STUBS  $agree
  BANNER $region        -- many columns → FDR (bh) keeps power without false positives
  STATS  col_pct, n, mean, sig
END TABLE
```

What each knob changes for the same data:

- **`SIG_TAILS 1`** halves the p-value — a gap that is borderline two-tailed becomes
  significant one-tailed (the cut drops from `z₀.₀₂₅ = 1.96` to `z₀.₀₅ = 1.645` at 95%).
- **`SIG_MEAN_TEST exact_t`** is *stricter than `normal` at small bases*: a Mean gap
  with only 2 valid respondents per column needs the t-critical 4.30 (df 2), not the
  z-critical 1.96 — so the default no longer over-flags tiny cells.
- **`SIG_CORRECTION bh`** sits between `none` (most flags) and `bonferroni` (fewest):
  it rejects every pair whose p-value clears the Benjamini–Hochberg step-up line.
- **`SIG_DEFF 1.5`** scales every test statistic by `1/√1.5 ≈ 0.816`, so fewer cells
  clear the threshold — the rough correction for a clustered/multi-stage sample.

The text-renderer legend names whichever strategy is active (e.g. *"One-tailed
(directional) test."*, *"Benjamini–Hochberg FDR control applied (per comparison
group)."*, *"Design effect DEFF = 1.5 applied (effective bases deflated)."*).

---

## 9. FORMAT (script-wide display defaults) {#format}

```mrs
FORMAT
  clause*
END FORMAT
```

Default display settings inherited by every `TABLE`. Any clause may be overridden at
the table level ([§17](tables.md)). One `FORMAT` block per script.

| Clause | Meaning |
|--------|---------|
| `STATS stat [, …]` | Default stats for all tables ([§28](reference-details.md#stats-values)). |
| `BANNER var [, …]` | Default inline banner (column variables). |
| `BANNER Name` | Default named banner (defined by [§18](tables.md#named-banner)). |
| `WEIGHT $weight_var` | Default weight variable. |
| `BASE_LABEL 'text'` | Rename the base/respondents row. |
| `FOOTER 'text'` | Append a line below every table. |
| `THOUSANDS_SEPARATOR true\|false` | Comma-group large counts (e.g. `1,234`). |
| `MIN_BASE n [MASK 'text']` | Mask whole banner columns with base `< n` (mask: `<<`). |
| `CONFIDENTIAL n [MASK 'text']` | Mask individual cells with count `< n` (mask: `**`). |
| `BLANK_SUPPRESS row\|col\|both` | Hide all-zero rows / zero-base columns within a table. |
| `SUPPRESS_EMPTY true\|false` | Drop the **whole** table when it has no data — every column base is 0 in every section. Surviving tables renumber contiguously. Default `false`. |
| `AUTONUMBER true\|false` | Number leaf stub rows (`1. 2. 3. …`). |
| `RANKING ascending\|descending` | Sort stub rows by the **Total** column value — shorthand for `SORT col_pct ASC\|DESC ON TOTAL`. |
| `SORT [col_pct\|n\|row_pct] [ASC\|DESC] [ON $var=code\|TOTAL]` | Sort stub rows by any banner column and stat. Full syntax in [§17 Sorting rows](tables.md#sorting). |
| `SHOW_TOTAL true\|false\|'Label'` | Show/hide/label the leading Total column ([§17](tables.md#total-column)). |
| `SHOW_SCORES true\|false` | Append each leaf stub's contributing score value in brackets, on tables requesting `mean` ([§28](reference-details.md#show-scores)). Default `true`. |
| `PCT_SIGN true\|false` | Append the `%` sign to percentages (default `true`). `false` renders the bare number (`56` not `56%`). Text renderer only. |
| `MAX_COL_WIDTH n` | Text-renderer header-wrap cap per data column. |
| `DECIMALS n` | **Umbrella** decimal places — the fallback for percentages, counts **and** means when the specific directive below is not set. |
| `PCT_DECIMALS n` | Decimal places for percentages only. |
| `COUNT_DECIMALS n` | Decimal places for weighted/fractional counts and bases only. |
| `MEAN_DECIMALS n` | Decimal places for Mean / Std Dev / score-summary rows only. |
| `NPS PROMOTERS lo..hi DETRACTORS lo..hi` | Override the `nps` stat's promoter/detractor bands (default 0–10). |
| `NPS_DECIMALS n` | Decimal places for the NPS row (default 0). |
| `RESPONSES_LABEL 'text'` | Custom label for the `responses` (Total Responses) summary row (default "Total Responses"). |
| `MEAN_RESPONSES_LABEL 'text'` | Custom label for the `mean_responses` (Mean Responses) summary row (default "Mean Responses"). |

!!! info "Decimals resolution order"

    For each aspect: per-row `DECIMALS` ([§11b](data-preparation.md#stub-display-properties))
    wins, then the specific directive, then umbrella `DECIMALS`, then the default
    (pct **0**, count **0**, mean **2**). Integer (unweighted) counts always print
    whole.

```mrs
FORMAT
  STATS               n, col_pct
  BANNER              @ageband, $gender
  BASE_LABEL          'Respondents'
  THOUSANDS_SEPARATOR true
  MIN_BASE            20 MASK 'n<20'
  FOOTER              'Source: Natural Toothpaste Survey, Ipsos India 2025'
END FORMAT
```

---

## 10. VARIABLE (source variable metadata overrides) {#variable}

```mrs
VARIABLE $source_var
  clause*
END VARIABLE
```

Overrides metadata for a loaded source variable. Useful especially for CSV columns
that carry no labels. All clauses are optional. A sidecar `CODEBOOK`
([§5](data-input.md#source)) is applied first; inline `VARIABLE` wins on any conflict.

| Clause | Meaning |
|--------|---------|
| `LABEL 'text'` | Display label shown in table headers. |
| `TYPE type_value` | Measurement type (see below). |
| `VALUE code 'label'` | Add / override a value label for one code. Declaring value labels on a numeric column makes it categorical (distributes by stubs instead of the mean/std path). |
| `MISSING code [, …]` | Declare codes as missing — excluded from **rows, base and summary stats together** (the stub is removed). SPSS missing metadata is **not** auto-applied. |
| `STATS_EXCLUDE code [, …]` | Declare codes as non-response **sentinels**: excluded from summary stats **only**. The code keeps its own labelled row with a real count and stays in the base. See below. |
| `SCORE code = value` | Numeric score for a code, used by mean / std summaries. Declaring *any* `SCORE` switches the variable to **explicit mode** — a code you don't score drops out of the mean. With **no** `SCORE` at all, each code is its own score (code-as-score). |

### `MISSING` vs `STATS_EXCLUDE` {#missing-vs-stats-exclude}

Both remove a code from the mean; they differ in what else goes with it.

| | Row shown? | In the base? | In mean/std/median? |
|---|---|---|---|
| *(neither clause)* | yes | yes | **yes** |
| `MISSING 998` | no | no | no |
| `STATS_EXCLUDE 998` | **yes** | **yes** | no |

`STATS_EXCLUDE` exists for the common survey-scripting pattern where a numeric-entry
field carries a couple of non-numeric escape-hatch codes (`998` "Do not stock/sell",
`999` "Don't know") instead of being left blank. You want those reported as their own
rows with real counts — which `MISSING` makes impossible — but you do not want them
averaged into a 0-100% mean.

```mrs
VARIABLE $q5a
  LABEL 'Stocking mix %'
  VALUE 998 'Do not stock/sell'
  VALUE 999 "Don't know / Can't say"
  STATS_EXCLUDE 998, 999
END VARIABLE

TABLE 'Q5a stocking mix'
  DISTRIBUTION $q5a
  BANNER $region
  STATS n, col_pct, mean
END TABLE
```

The sentinel rows show their counts and percentages over the **full** base, and the
`Mean` row below is computed over the true numeric values only.

The exclusion is a property of the **variable**, so every summary-stat path for it
honours the clause — `DISTRIBUTION`, a `STUBS` table's code-as-score auto-mean, a
`TYPE numeric` mean/std section, and a stacked (`LEVEL`) target that inherits it. A
code listed in **both** `MISSING` and `STATS_EXCLUDE` is simply fully missing; a code
that is both `SCORE`-d and `STATS_EXCLUDE`-d is excluded (the exclusion wins).

**Type values**

| Type | Meaning |
|------|---------|
| `single_punch` | One response chosen from a list. |
| `multi_punch` | Multiple responses (stored; renderer awareness limited). |
| `numeric` | Continuous numeric (mean / std path). |
| `open_end` | Free text. |
| `multi_binary` | Binary 0/1 flag columns (auto-detected). |

```mrs
// Labelling a coded CSV column and declaring missing
VARIABLE $q1
  LABEL 'Overall satisfaction'
  VALUE 1 'Strongly disagree'
  VALUE 5 'Strongly agree'
  MISSING 99
END VARIABLE
```

```mrs
// Reverse scoring for a mean
VARIABLE $S12b
  LABEL 'Brushing frequency'
  SCORE 1 = 5   SCORE 2 = 4   SCORE 3 = 3   SCORE 4 = 2   SCORE 5 = 1
END VARIABLE
```
