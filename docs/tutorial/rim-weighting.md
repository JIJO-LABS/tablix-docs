# Tutorial: RIM weighting

Real-world survey samples rarely match the population on demographics like age,
gender, and region. RIM weighting (also called *raking*) solves this by adjusting
per-respondent weights so the weighted totals match known targets — without losing
any respondents from the data.

This tutorial walks through a typical journey: raw data, check the margins, add a
`RIM` block, verify the result, then run a weighted table.

---

## Step 1 — Check the unweighted margins

Before weighting, understand where your sample differs from the population.
Run a plain table:

```mrs
SOURCE "survey.sav"
%RESPID = $respondent_id

TABLE "Gender — unweighted"
    STUBS $gender
    STATS col_pct, n
END TABLE

TABLE "Region — unweighted"
    STUBS $region
    STATS col_pct, n
END TABLE
```

```powershell
mrscript run survey.mrs
```

Suppose your output shows:

```
Gender — unweighted
                    Total
                       N=200

Male                  55%
Female                45%

Region — unweighted
                    Total
                       N=200

North                 18%
South                 22%
East                  35%
West                  25%
```

But the census says: gender 48M / 52F, region 25N / 30S / 20E / 25W.
Your sample over-represents males and the East region — a classic fieldwork skew.

---

## Step 2 — Add a RIM block

Insert a `RIM` block after `%RESPID`:

```mrs
SOURCE "survey.sav"
%RESPID = $respondent_id

RIM @rim_weight
    DIMENSION $gender TARGETS 1 = 48.0, 2 = 52.0
    DIMENSION $region TARGETS 1 = 25.0, 2 = 30.0, 3 = 20.0, 4 = 25.0
END RIM
```

That's the minimum declaration. Tablix iterates until the weighted margins match,
using up to 50 iterations at convergence tolerance 0.0001 by default.

---

## Step 3 — Apply the weight to your tables

Two approaches:

**Global (apply to every table):**
```mrs
FORMAT
    WEIGHT @rim_weight
    STATS col_pct, weighted_n
END FORMAT
```

**Per-table override:**
```mrs
TABLE "Gender (weighted)"
    STUBS $gender
    WEIGHT @rim_weight
    STATS col_pct, weighted_n
END TABLE
```

The two are compatible — set the global default in `FORMAT`, then drop the weight
on any table that should remain unweighted with `WEIGHT none` (future feature; for
now simply omit the table-level `WEIGHT` to inherit the global one).

---

## Step 4 — Verify the weighted margins

Add a `STATS weighted_n` row to confirm. If everything went well, the weighted
percentages should closely match your targets:

```
Gender (weighted)
                    Total
                       N=200  (weighted N=200.0)

Male               48.0%
Female             52.0%
```

If the console (or Problems panel) shows a convergence warning:

```
WARNING: RIM @rim_weight did not converge after 50 iterations (max_delta=0.023)
```

it usually means your targets are inconsistent — for example, the regional
gender split in the targets implies a different gender ratio than the one you
declared. Check that both genders appear in all regions in your data, and that
the regional and gender targets are compatible.

---

## Step 5 — Optionally cap extreme weights

Without a cap, a small under-represented cell can receive a very high weight,
inflating the design effect. Use `WEIGHT_CAP` to limit how extreme weights can
get:

```mrs
RIM @rim_weight
    DIMENSION $gender TARGETS 1 = 48.0, 2 = 52.0
    DIMENSION $region TARGETS 1 = 25.0, 2 = 30.0, 3 = 20.0, 4 = 25.0
    WEIGHT_CAP 5.0    // no weight smaller than 0.2 or larger than 5.0
END RIM
```

`WEIGHT_CAP` takes a single number and sets both limits: the ceiling is the
value itself and the floor is its reciprocal, `1 / WEIGHT_CAP`. So `5.0` keeps
weights in `[0.2, 5.0]`, `3.0` in `[0.333, 3.0]`, and `2.0` in `[0.5, 2.0]`.
There is no separate lower-limit setting, which is also why the cap must be
greater than 1.0.

If any weight needs clamping, a warning is issued. A tight cap (e.g. 1.5) reduces
weight dispersion but means the final margins won't exactly match targets — that
trade-off is intentional.

---

## Step 6 — Export the weight column

To attach the weights back to the `.sav` for use in other tools, add:

```mrs
EXPORT DATA "survey_weighted.sav"
```

This writes all columns — including `@rim_weight` — as a standard SPSS file.
Use `SOURCE_ONLY` to strip derived columns and keep only the originals plus the
weight variable:

```mrs
EXPORT DATA "survey_weighted.sav" SOURCE_ONLY
```

(Note: `@rim_weight` is registered as `source_format="derived"`, so `SOURCE_ONLY`
will drop it. If you need only the weight column alongside the source data, export
without `SOURCE_ONLY` and use a `KEEP`/`DROP` pattern in SPSS or your other tool.)

---

## Full script

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

TABLE "Gender"   STUBS $gender   END TABLE
TABLE "Region"   STUBS $region   END TABLE
TABLE "Age"      STUBS $age_group END TABLE

EXPORT DATA "survey_weighted.sav"
```

Run it:

```powershell
mrscript export survey.mrs report.xlsx
```

The `.xlsx` report will contain weighted percentages throughout; the
`survey_weighted.sav` file carries the `rim_weight` column for downstream use.
