# Tutorial: your first crosstab

This is a **build-it-yourself** walkthrough. We start with a one-variable frequency
and finish with a banner crosstab that has derived age bands, a filter, a weight,
NET rows, and significance testing — adding **one idea at a time**.

By the end you will understand the clauses you'll use in 90% of real jobs.

!!! abstract "The dataset we'll use"

    Imagine a customer-satisfaction survey, `survey.sav`, with these columns:

    | Variable | Meaning | Values |
    |----------|---------|--------|
    | `$respondent_id` | unique respondent key | 1, 2, 3, … |
    | `$gender` | gender | 1 = Male, 2 = Female |
    | `$age` | age in years | 18–90 |
    | `$region` | region | 1 = North, 2 = South, 3 = East, 4 = West |
    | `$q1` | overall satisfaction | 1 = Very dissatisfied … 5 = Very satisfied, 99 = No answer |
    | `$weight` | survey weight | a decimal number |

    Substitute your own file and variable names as you follow along — the steps are
    the same.

---

## Step 1 — Load data and make one table

Every script begins with a `SOURCE`. Add a single `TABLE` and you have a complete job.

```mrs
SOURCE 'survey.sav'

TABLE 'Overall satisfaction'
  STUBS $q1
  STATS n, col_pct
END TABLE
```

- **`STUBS`** sets the **rows** of the table — here, the categories of `$q1`.
- **`STATS`** chooses which numbers appear: `n` (count) and `col_pct` (column %).

Run it with `mrscript run tutorial.mrs`:

```text
Table 1
Overall satisfaction
Base: All respondents

                       Total
Total                    105
  Very dissatisfied        8
                          8%
  Dissatisfied            12
                         11%
  Neither                 25
                         24%
  Satisfied               38
                         36%
  Very satisfied          22
                         21%
```

!!! question "Where did the row labels come from?"

    From the data file. SPSS files carry value labels (`1 = "Very dissatisfied"`),
    and Tablix uses them automatically. For CSV files — which have no labels — you
    supply them yourself with a [`VARIABLE`](../reference/setup-blocks.md#variable)
    block. Notice `99 = No answer` is **not** shown yet — we'll handle that in Step 6.

---

## Step 2 — Add a banner (cross by another variable)

A **banner** puts a variable across the **columns**. This is what makes it a
*crosstab* rather than a frequency.

```mrs hl_lines="4"
TABLE 'Satisfaction by gender'
  STUBS  $q1
  BANNER $gender
  STATS  n, col_pct
END TABLE
```

```text
Table 2
Satisfaction by gender

                       Total    Male  Female
Total                    105      52      53
  Very dissatisfied        8       5       3
                          8%      10%      6%
  ...
  Very satisfied          22      10      12
                         21%      19%     23%
```

A **Total** column appears automatically to the left of the banner. (You can hide or
rename it with [`SHOW_TOTAL`](../reference/tables.md#total-column).)

---

## Step 3 — Make a derived variable

Raw `$age` is a number from 18 to 90 — not useful as table rows. Let's group it into
**age bands** with a `DERIVE` block, then banner by it.

```mrs
DERIVE @age_group
  LABEL 'Age group'
  STUB 1 '18-34' WHERE $age BETWEEN 18 AND 34
  STUB 2 '35-54' WHERE $age BETWEEN 35 AND 54
  STUB 3 '55+'   WHERE $age >= 55
END DERIVE

TABLE 'Satisfaction by age group'
  STUBS  $q1
  BANNER @age_group
  STATS  n, col_pct
END TABLE
```

- Each **`STUB`** defines one category: a `code`, a `'label'`, and a `WHERE`
  condition that decides who falls into it.
- The new variable is named `@age_group` — note the **`@`** prefix marking it as
  *derived*. You can now use it anywhere a source variable would go.

!!! tip "Derived variables are multi-response by nature"

    A `DERIVE` actually stores *every* stub code a respondent matches. With
    mutually-exclusive conditions (like age bands) that's at most one — the ordinary
    single-punch case. With overlapping conditions (e.g. brands mentioned at several
    questions) it keeps them all. See
    [DERIVE](../reference/data-preparation.md#derive) for the full story.

---

## Step 4 — Set display defaults once with FORMAT

We keep repeating `STATS n, col_pct` on every table. Move shared settings into a
single `FORMAT` block at the top, and every table inherits them.

```mrs
FORMAT
  STATS      n, col_pct
  BASE_LABEL 'Respondents'
  FOOTER     'Source: Customer Survey 2025'
END FORMAT

TABLE 'Satisfaction by age group'
  STUBS  $q1
  BANNER @age_group
END TABLE
```

Now the table needs no `STATS` clause — it uses the `FORMAT` default. A table can
still **override** the default (`STATS …`) or **add to** it (`STATS + mean`); see
[STATS modes](../reference/reference-details.md#stats-modes).

---

## Step 5 — Filter to a sub-group

Suppose you want this table for **women only**. Three tools can filter respondents;
the simplest for one table is `FILTER`:

```mrs hl_lines="4"
TABLE 'Satisfaction by age group (women)'
  STUBS  $q1
  BANNER @age_group
  FILTER $gender = 2
END TABLE
```

To apply one condition to **several tables**, wrap them in a `SCOPE` instead:

```mrs
SCOPE WHERE $gender = 2 LABEL 'Women'
  TABLE 'Satisfaction'  STUBS $q1     BANNER @age_group END TABLE
  TABLE 'Region'        STUBS $region BANNER @age_group END TABLE
ENDSCOPE
```

The `SCOPE`'s `LABEL` becomes the **`Base:`** line in the output, so the reader knows
the table is filtered. (To remove bad respondents from the *entire* job, use
[`DROP ROWS`](../reference/data-preparation.md#keep--drop-rows) instead — it deletes
them from the data, not just one table.)

---

## Step 6 — Handle the "No answer" code

`$q1` has a `99 = No answer` code that's polluting the base. Declare it **missing**
so those respondents drop out of every count and percentage:

```mrs
VARIABLE $q1
  MISSING 99
END VARIABLE
```

!!! warning "The script is the authority on missing values"

    Tablix does **not** automatically treat any code as missing — not even SPSS's own
    missing-range metadata. You declare missing codes explicitly so a script behaves
    identically across SPSS, CSV, and every other format. See
    [Missing values](../reference/reference-details.md#missing-values).

---

## Step 7 — Add NET rows (Top-2-Box) {#step-7-add-net-rows-top-2-box}

Market researchers love a **Top-2-Box**: the % choosing the top two scale points.
A `NET` inside a `DERIVE` groups stubs into a de-duplicated summary row.

```mrs
DERIVE @sat
  LABEL 'Satisfaction'
  NET 'Top 2 Box (satisfied)'
    STUB 5 'Very satisfied' WHERE $q1 = 5
    STUB 4 'Satisfied'      WHERE $q1 = 4
  ENDNET
  STUB 3 'Neither'          WHERE $q1 = 3
  NET 'Bottom 2 Box (dissatisfied)'
    STUB 2 'Dissatisfied'      WHERE $q1 = 2
    STUB 1 'Very dissatisfied' WHERE $q1 = 1
  ENDNET
END DERIVE

TABLE 'Satisfaction (with T2B/B2B)'
  STUBS  @sat
  BANNER @age_group
END TABLE
```

The output now shows a **Top 2 Box** row (everyone scoring 4 or 5, counted once)
above its member rows, and a **Bottom 2 Box** below.

---

## Step 8 — Turn on significance testing

Add `sig` to the stats. Tablix letters the banner columns (A, B, C…) and marks where
a column is **significantly higher** than another.

```mrs hl_lines="4"
TABLE 'Satisfaction by age group'
  STUBS  @sat
  BANNER @age_group
  STATS  n, col_pct, sig
END TABLE
```

```text
                       Total   18-34   35-54     55+
                                 (A)     (B)     (C)
Top 2 Box (satisfied)     60      18      22      20
                         57%     50%     58%     69%
                                                 A         ← 55+ sig. higher than 18-34
```

The letter on a cell names the column(s) it beats. By default the test is at **95%**
confidence — change it with [`CONFIG SIG_CONFIDENCE`](../reference/setup-blocks.md#config),
and choose *which* columns are compared with `SIG_COMPARE`.

---

## Step 9 — Weight the table

Real surveys are weighted. Point `WEIGHT` at your weight variable and the counts,
percentages, and significance all use it (with a correct **Kish effective base**).

```mrs
TABLE 'Satisfaction by age group (weighted)'
  STUBS  @sat
  BANNER @age_group
  STATS  weighted_n, col_pct, sig
  WEIGHT $weight
END TABLE
```

Put `WEIGHT $weight` in the `FORMAT` block to weight every table at once.

---

## The finished script

Here is everything stitched together:

```mrs
// ─── Data ──────────────────────────────────────────────────────
SOURCE 'survey.sav'
%RESPID = $respondent_id

// ─── Settings & display defaults ───────────────────────────────
CONFIG
  SIG_CONFIDENCE 95
END CONFIG

FORMAT
  STATS      n, col_pct, sig
  WEIGHT     $weight
  BASE_LABEL 'Respondents'
  FOOTER     'Source: Customer Survey 2025'
END FORMAT

// ─── Variable fix-ups ──────────────────────────────────────────
VARIABLE $q1
  MISSING 99
END VARIABLE

// ─── Data preparation ──────────────────────────────────────────
DERIVE @age_group
  LABEL 'Age group'
  STUB 1 '18-34' WHERE $age BETWEEN 18 AND 34
  STUB 2 '35-54' WHERE $age BETWEEN 35 AND 54
  STUB 3 '55+'   WHERE $age >= 55
END DERIVE

DERIVE @sat
  LABEL 'Satisfaction'
  NET 'Top 2 Box (satisfied)'
    STUB 5 'Very satisfied' WHERE $q1 = 5
    STUB 4 'Satisfied'      WHERE $q1 = 4
  ENDNET
  STUB 3 'Neither'          WHERE $q1 = 3
  NET 'Bottom 2 Box (dissatisfied)'
    STUB 2 'Dissatisfied'      WHERE $q1 = 2
    STUB 1 'Very dissatisfied' WHERE $q1 = 1
  ENDNET
END DERIVE

// ─── Tables ────────────────────────────────────────────────────
TABLE 'T1. Satisfaction by age group'
  STUBS  @sat
  BANNER @age_group
END TABLE

SCOPE WHERE $gender = 2 LABEL 'Women'
  TABLE 'T2. Satisfaction by age group — women'
    STUBS  @sat
    BANNER @age_group
  END TABLE
ENDSCOPE
```

---

## What you've learned

| Clause | What it does |
|--------|--------------|
| `SOURCE` | load a data file |
| `%RESPID` | declare the respondent key |
| `STUBS` | the table's rows |
| `BANNER` | the table's columns |
| `STATS` | which numbers to show (`n`, `col_pct`, `sig`, `mean`…) |
| `DERIVE` / `STUB` / `NET` | build grouped & summary variables |
| `VARIABLE … MISSING` | exclude codes from the base |
| `FORMAT` | display defaults for every table |
| `FILTER` / `SCOPE` | restrict to a sub-group |
| `WEIGHT` | apply survey weights |

---

## Where to go next

<div class="grid cards" markdown>

-   :material-cursor-default-click-outline: **[Build tables without writing script](build-tables.md)** —
    open your data, tick the questions, and let Tablix write the script for you.

-   :material-stethoscope: **[Pre-flight health check](health-check.md)** —
    check your data before tabulating: duplicate IDs, rogue codes, straightliners,
    and `EXPECT` routing assertions.

-   :material-table-merge-cells: **[Merging waves into a tracker](wave-merging.md)** —
    roll monthly waves into a quarter with `ADDTAB`, and show periods side by side
    with `BANKED_TABLE`.

-   :material-format-list-checks: **[How-to recipes](../guide/patterns.md)** —
    ready-made patterns for common DP tasks (concept tests, diaries, T2B, pooling…).

-   :material-book-open-variant: **[Language reference](../reference/index.md)** —
    the exact rules for every clause, when you need the detail.

</div>
