# Part 11 · RIM Weighting

RIM (Random Iterative Method) weighting — also called *raking* or *iterative
proportional fitting* — adjusts each respondent's weight so that the weighted
sample matches known population targets on several variables simultaneously.

The weight's `@name` must not be the name of a data column: `RIM @weight` when the data
already has a `$weight` column is an error (it would overwrite the data weight). Call it
`@rim_weight`.

---

## Syntax

```mrs
RIM @weight_name
    DIMENSION $var TARGETS code = pct [, code = pct ...]
    [DIMENSION $var2 TARGETS ...]
    [MAX_ITERATIONS n]        // default 50
    [CONVERGENCE tol]         // default 0.0001
    [WEIGHT_CAP factor]       // optional; must be > 1.0
    [BASE_WEIGHT $prior_wgt]  // optional starting weights
END RIM
```

`RIM` produces a new derived variable `@weight_name` (a `Float64` weight column)
that can be used in any subsequent `TABLE … WEIGHT @weight_name` clause.

---

## Parameters

### DIMENSION

Each `DIMENSION` names a source variable and its population targets. Targets are
given as `code = percentage`:

```mrs
DIMENSION $gender TARGETS 1 = 48.0, 2 = 52.0
```

**Constraints:**

- The variable must be `single_punch` or `multi_binary` (numeric coded).
- Target percentages must sum to **100 ± 1 pp** (validator-enforced).
- All percentages must be `> 0`.
- Codes must exist in the variable's value labels.
- At least one `DIMENSION` is required.

Respondents whose value on a dimension variable is `null` or is declared as a
`MISSING` code are **excluded from that dimension's adjustment pass** — their
weight is unchanged by that dimension. A warning is emitted if more than 10% of
respondents are excluded from a single dimension.

### MAX_ITERATIONS

Maximum number of full raking sweeps (one sweep = one pass through all
dimensions). Default: `50`.

### CONVERGENCE

Convergence threshold: the maximum absolute `|factor − 1|` across all cells in
all dimensions during one sweep. When this falls below the threshold the
algorithm is considered converged. Default: `0.0001`.

If convergence is not reached within `MAX_ITERATIONS`, a non-fatal advisory is
added to `runner.warnings` and the desktop Problems panel — the weights are still
output (use them with caution).

### WEIGHT_CAP

Clamp all final weights to the interval `[1/cap, cap]` then run one re-balance
sweep to restore the total weight to N. Must be `> 1.0`. When any weight is
clamped a warning is emitted.

```mrs
WEIGHT_CAP 5.0    // weights stay in [0.2, 5.0]
```

### BASE_WEIGHT

Start from an existing weight column instead of uniform weights of 1.0:

```mrs
BASE_WEIGHT $design_weight
```

Useful when the data already carries a design (probability) weight that you want
to preserve as the starting point before raking to demographic targets.

---

## Algorithm

RIM uses **iterative proportional fitting (IPF)**:

1. Start with `w_i = 1.0` for all respondents (or `w_i = $base_weight`).
2. For each dimension in turn, and for each target code in that dimension:
   - Compute the eligible weighted total `W_elig` (respondents with a valid,
     non-missing code on that dimension).
   - Compute the current weighted count for that code `W_code`.
   - Compute the goal count: `goal = (target_pct / 100) × W_elig`.
   - Scale each eligible respondent coded as `code` by `factor = goal / W_code`.
3. Repeat until convergence or `MAX_ITERATIONS`.
4. If `WEIGHT_CAP`: clamp, then one re-balance pass so `Σw = N`.

**Convergence requirement:** the dimensions must not be perfectly confounded. For
example, if all males are in region 1 and all females are in region 2, gender
and region targets are coupled — the algorithm cannot satisfy them independently.
In practice, any real survey where both genders appear in every region will
converge quickly (typically under 10 iterations).

---

## Diagnostics

After the run, `runner.warnings` (and the desktop Problems panel) carries any
non-fatal notices:

| Condition | Warning text |
|-----------|-------------|
| Not converged | `"RIM @weight_name did not converge after N iterations"` |
| Weights clamped | `"RIM @weight_name: weights clamped by WEIGHT_CAP X.X"` |
| >10% excluded | `"RIM @weight_name: 15.0% of respondents excluded from DIMENSION $gender"` |

---

## Effective sample size

After raking, the Kish effective sample size `eff_n = (Σw)² / Σw²` is always
less than or equal to the raw sample size. Larger weight dispersion means a
greater reduction. The engine logs `eff_n` at `DEBUG` level; check it to
understand the precision cost of raking.

---

## Full example

```mrs
SOURCE "survey.sav"

%RESPID = $respondent_id

RIM @rim_weight
    DIMENSION $gender TARGETS 1 = 48.0, 2 = 52.0
    DIMENSION $region TARGETS 1 = 25.0, 2 = 30.0, 3 = 20.0, 4 = 25.0
    MAX_ITERATIONS 50
    CONVERGENCE 0.0001
    WEIGHT_CAP 5.0
END RIM

FORMAT
    STATS col_pct, weighted_n
    WEIGHT @rim_weight
END FORMAT

TABLE "Gender (weighted)"
    STUBS $gender
END TABLE

TABLE "Region (weighted)"
    STUBS $region
END TABLE
```

Setting `WEIGHT @rim_weight` globally in `FORMAT` applies it to every table;
individual tables can override with their own `WEIGHT` or `WEIGHT $other`.

---

## Notes

- `RIM` is a data-preparation statement: it runs **in script order** alongside
  `DERIVE`, `EDIT`, `RECODE`, etc. A later `DERIVE` can reference the new column
  if needed (e.g. `WHERE @rim_weight > 2.0`), though this is uncommon.
- The weight column is marked `is_weight=True` so it appears in a separate
  section of the desktop Variable Explorer.
- `.sav` export via `EXPORT DATA` includes the weight column as a normal numeric
  variable.
