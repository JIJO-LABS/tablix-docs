# Part 7 · Data health

Before tabulating a single table, run a pre-flight check on the loaded and
transformed data. The health command answers the #1 DP question — *"did the
data arrive clean?"* — and emits a structured report of findings grouped by
severity, plus an optional CSV of flagged respondent IDs.

Health checks are **report-only**: they never fix data (that is `EDIT` /
`RECODE`'s job) and never block a `run` or `export`.

---

## 24. mrscript health {#health-command}

```powershell
mrscript health script.mrs
mrscript health script.mrs --data data.sav
mrscript health script.mrs --json report.json --csv flagged.csv
mrscript health script.mrs --fail-on error
```

The command runs the full pipeline (load → `%RESPID` → validate → `DERIVE` /
transforms → tabulate) and then passes the result to the health engine. Use the
same `--data` override as `run` and `export`. `.mrst` files are transpiled first.

### Options

| Option | Meaning |
|--------|---------|
| `--data FILE` | Data file — overrides `SOURCE` in the script. |
| `--json FILE` | Write a machine-readable JSON report (stable schema — see below). |
| `--csv FILE` | Write a flagged-respondent worklist CSV (one row per respid × check). |
| `--fail-on error\|warn` | Exit with code `2` when findings at or above the given severity exist. Default: always exit `0`. Useful in CI / project gates. |

---

## 25. Check catalogue {#checks}

Findings carry a severity:

| Severity | Meaning |
|----------|---------|
| `error` | Almost certainly a data problem — investigate before tabulating. |
| `warn` | Worth a look; may be expected (e.g. concept-rotation missing by design). |
| `info` | Background context; low urgency. |

### Respondent-level checks

These run on the loaded (and transformed) `(df, store)` without needing any
table results. They require `%RESPID` to be declared for the key-based checks.

| Check code | Severity | Fires when |
|------------|----------|------------|
| `duplicate_respid` | error | Two or more rows share the same `%RESPID` value. |
| `null_respid` | error | A row has a null / blank respondent ID. |
| `out_of_range` | warn | A labeled variable contains a code that is not in its declared value set **and** not in its `MISSING` list (an unlabelled rogue code). |
| `all_missing_respondent` | warn | A respondent is null / missing on **every** analysed variable (a dead record). |
| `high_item_nonresponse` | info | A respondent is non-responsive on more than the configured threshold of analysed variables (default 80 %). Excludes records already flagged by `all_missing_respondent`. |

!!! note "Analysed variables"

    For `all_missing_respondent` and `high_item_nonresponse`, "analysed
    variables" means source (`$`) variables that are not `open_end` and not
    weight columns — the variables a DP analyst would normally tabulate.
    The respondent-ID column itself is excluded.

### Quality-signal checks

These run over rating batteries — an ordered set of scale columns that share one
response frame (e.g. a concept-evaluation grid or a brand-imagery battery). The
engine **automatically infers batteries from `STACK MAP` source lists** in the
script; no extra configuration is needed for the most common case.

| Check code | Severity | Fires when |
|------------|----------|------------|
| `straightliner` | warn | A respondent gives the identical answer across all columns in a battery (e.g. always 4 on a 1–5 scale). Requires ≥ 2 non-null ratings. |
| `low_variance_grid` | warn | A battery is answered with only 1 distinct value across all its columns for a given respondent (a flatline — a stricter version of straightlining). |
| `speeder` | warn | Interview duration is below the minimum acceptable threshold (default 120 s). Requires `duration_var` to be set — see [Configuration](#health-config). |

Battery inference from `STACK MAP`:

```mrs
STACK @concept
    MAP @r1 FROM $r1_A, $r1_B, $r1_C
    MAP @r2 FROM $r2_A, $r2_B, $r2_C
END STACK
```

This automatically creates two batteries — one for `@r1` (columns `r1_A`,
`r1_B`, `r1_C`) and one for `@r2`. You can also supply batteries explicitly
via `HealthConfig.batteries` (Python API) to override or supplement the inferred
ones.

### Structural checks

These run after tabulation and examine the `TableResult` objects directly.
They catch `FILTER` / `SCOPE` logic errors that are invisible at the data level.

| Check code | Severity | Fires when |
|------------|----------|------------|
| `base_zero_with_data` | error | A table section's Total-column base is 0 — the filter left no respondents in scope. Usually a broken `FILTER` or `SCOPE` condition. |
| `count_exceeds_base` | error | A cell count exceeds its section's column base. Indicates a weighting or aggregation error. |
| `pct_not_summing` | warn | For a single-punch section with no `NET` rows, the leaf-row column percentages don't sum to 100 ± tolerance (default 1 pp). Multi-response sections (pct sum >> 100) are automatically skipped. |
| `missing_code_as_stub` | warn | A code declared in `VARIABLE … MISSING` still appears as a live stub on that variable (VARIABLE override order bug). |

### Routing assertions (`EXPECT`) {#expect}

Express skip-logic directly in MRScript using the same condition language as
`FILTER` and `DERIVE`. Each `EXPECT` declaration is an assertion that must hold
for all rows (optionally restricted by a `WHERE` clause). Violations are reported
per assertion with counts and sample IDs.

```mrs
// Q5 must be blank when Q4 ≠ 1 (not routed in)
EXPECT $q5 MISSING WHERE $q4 != 1

// Q5 must be answered when Q4 = 1 (routed in)
EXPECT $q5 ANSWERED WHERE $q4 = 1

// General: any condition that must hold for all (optionally filtered) rows
EXPECT $consent = 1 WHERE $panel IN (1, 2)

// Without WHERE — must hold for every row in the file
EXPECT $country IN (1, 2, 3, 4)
```

`MISSING` is sugar for `IS NULL` (the variable has no value / was skipped).
`ANSWERED` is sugar for `IS NOT NULL` (the variable carries a value).
Both work with any `$` source variable. General conditions (comparisons, `IN`,
`BETWEEN`, `AND`, `OR`, `NOT`, nested) are also valid — a `NOT` inside an
`EXPECT` condition follows the same missing-value rule as everywhere else in
MRScript ([§29](reference-details.md#not-missing)): a respondent missing on
the asserted variable does not satisfy it, and is reported as a violation.

Place `EXPECT` declarations anywhere at the top level of a script — they are
parsed and evaluated only by `mrscript health` and never affect a `run` /
`export`.

| Finding code | Severity | Meaning |
|--------------|----------|---------|
| `expect_violation` | error | One or more rows violate the assertion. `count` = number of failing rows; `sample_ids` = up to `max_sample_ids` respondent IDs. |
| `expect_compile_error` | error | The condition could not be compiled (e.g. references a column not in the data). |

---

## 26. Report output {#report-output}

### Text summary (default, stdout)

```text
2 error(s), 1 warning(s)  [survey.sav]

── ERROR ──
  duplicate_respid  $respondent_id  n=3
    3 respondent ID value(s) appear more than once in the data.
    sample IDs: 1001, 2345, 3789

  base_zero_with_data  table=4
    Table 4 'Unaided awareness' — section 'Brand': base is 0.
    Check FILTER / SCOPE conditions.

── WARN ──
  out_of_range  $gender  n=2
    2 row(s) carry unlabelled code(s) for 'Gender' ($gender) ...
    sample IDs: 10042, 10087
```

### JSON (`--json report.json`)

Stable schema for tooling — e.g. a CI step that comments findings on a PR.

```json
{
  "cid": "CID-2026-a3f9c1b2",
  "dataset": "survey.sav",
  "generated_at": "2026-06-16T10:42:00+00:00",
  "summary": { "error": 2, "warn": 1, "info": 0 },
  "findings": [
    {
      "level": "error",
      "code": "duplicate_respid",
      "message": "3 respondent ID value(s) appear more than once in the data.",
      "var": "$respondent_id",
      "count": 3,
      "table": null,
      "sample_ids": [1001, 2345, 3789]
    }
  ]
}
```

### Respondent worklist CSV (`--csv flagged.csv`)

One row per (respid × check code). Feed this directly into an SPSS `PROCESS IF`
or a pandas `drop` to build a cleaning script.

```csv
respid,check_code,var,level,message
1001,duplicate_respid,$respondent_id,error,"3 respondent ID value(s) ..."
2345,duplicate_respid,$respondent_id,error,"3 respondent ID value(s) ..."
10042,out_of_range,$gender,warn,"2 row(s) carry unlabelled code(s) ..."
```

---

## 27. Configuration {#health-config}

Thresholds and opt-out are controlled via `HealthConfig` in Python (or
`HealthRunner`) when calling the engine programmatically. The CLI uses defaults.

| Setting | Default | Meaning |
|---------|---------|---------|
| `high_nonresponse_threshold` | 0.80 | Fraction of analysed variables a respondent must be missing on to trigger `high_item_nonresponse`. |
| `pct_sum_tolerance` | 1.0 pp | Acceptable deviation from 100 % before `pct_not_summing` fires. |
| `disabled_checks` | `set()` | Set of check codes to skip, e.g. `{"high_item_nonresponse"}`. |
| `max_sample_ids` | 10 | Maximum number of respondent IDs stored per finding (caps report size on large datasets). |
| `batteries` | `[]` | Override or supplement the auto-inferred batteries for `straightliner` / `low_variance_grid`. Each entry is a `Battery(label, columns)` where `columns` are bare column names (no `$`). |
| `duration_var` | `None` | Bare column name (no `$`) of the interview duration variable in seconds. Required to enable the `speeder` check. |
| `duration_min_secs` | 120.0 | Minimum acceptable interview duration in seconds. Respondents with a recorded duration below this threshold trigger `speeder`. |
