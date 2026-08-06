# Tutorial: Merging Waves into a Tracker

Tracking studies tabulate the *same* questions every month, then need two things
DP does by hand all the time:

1. **Roll up** several waves into one combined table (e.g. three months → a quarter).
2. **Line up** the same question across periods, side by side, in one tracker view.

MRScript does both *after* tabulation, with `ADDTAB` (roll-up) and `BANKED_TABLE`
(side-by-side). They post-process finished tables — no extra data passes — so they
stay fast and exact. This tutorial builds both from one dataset.

---

## Setup — one dataset, a wave indicator

The engine tabulates one dataset per run, so the cleanest pattern is a single file
that carries a `wave` column (combine monthly files with `APPEND`, or add the column
in fieldwork). Our file `tracker.sav` has:

| Variable | Meaning |
|----------|---------|
| `$respondent_id` | respondent key |
| `$wave` | 1 = Jan, 2 = Feb, 3 = Mar |
| `$q1` | overall satisfaction (1–5) |
| `$region` | North / South / East / West |

```mrs
SOURCE "tracker.sav"
%RESPID = $respondent_id
```

---

## (Alternative) Setup — combine separate wave files with source tagging

If your monthly fieldwork is split into separate files (e.g. `january.sav`,
`february.sav`, `march.sav`), you can combine them with `APPEND` and automatically
produce a wave-tag variable — no need to pre-build a separate $wave column.

```mrs
SOURCE jan 'january.sav'   LABEL 'January'   CODE 1
SOURCE feb 'february.sav'  LABEL 'February'  CODE 2
SOURCE mar 'march.sav'     LABEL 'March'     CODE 3

APPEND jan, feb, mar AS @wave
%RESPID = $respondent_id
```

The `LABEL` and `CODE` clauses on each source define how each wave will be labeled
and tagged. The `APPEND … AS @wave` statement produces a ready-to-use `single_punch`
variable with three stubs (Jan, Feb, Mar), directly usable in tables without any
extra recoding. The CODE values (1, 2, 3) identify which source each row came from.

You can omit `CODE` and MRScript will auto-number them: `CODE 1, 2, 3` above defaults
to `1, 2, 3` in append order. You can also let some sources auto-number and others
pick explicit codes (auto-numbering continues from the highest explicit code).

---

## Step 1 — Tabulate each wave, and give it a NAME

Tabulate the same question once per wave, filtering to that wave. The `NAME` clause
registers each table under a short handle so the cross-table ops can find it (without
`NAME`, a table is addressed by its title — awkward when every wave shares one).

```mrs
TABLE 'Satisfaction — Jan' NAME 'Jan'
  STUBS  $q1
  BANNER $region
  FILTER $wave = 1
  STATS  col_pct, n
END TABLE

TABLE 'Satisfaction — Feb' NAME 'Feb'
  STUBS  $q1
  BANNER $region
  FILTER $wave = 2
  STATS  col_pct, n
END TABLE

TABLE 'Satisfaction — Mar' NAME 'Mar'
  STUBS  $q1
  BANNER $region
  FILTER $wave = 3
  STATS  col_pct, n
END TABLE
```

Each is an ordinary table — they render on their own, too.

---

## Step 2 — Roll the waves up with `ADDTAB`

```mrs
ADDTAB 'Jan', 'Feb', 'Mar'
  TITLE 'Satisfaction — Q1 roll-up'
  NAME  'Q1'
```

This produces one table whose **counts are the sum** of the three waves, cell by
cell. Crucially, the percentages are **recomputed from the combined counts and
bases** — not averaged — so the roll-up is the true quarter figure, not a mean of
three monthly percentages. If you had a `Mean` row (e.g. a scored scale), it
re-derives correctly from the pooled sufficient statistics.

The sources must share the **same layout** — same stubs (`$q1`) and the same banner
columns (`$region`). They do here, so the merge succeeds; a layout mismatch raises a
clear error naming the offending stubs.

!!! note "Significance is not carried over"

    `ADDTAB` and `BANKED_TABLE` clear significance flags: the source flags were
    computed over each wave's smaller base, so they don't describe the combined
    result. If you want fresh significance on the quarter, tabulate `$q1` once with
    `FILTER $wave IN (1, 2, 3)` and `STATS … sig` instead of merging.

---

## Step 3 — Line the waves up with `BANKED_TABLE`

A roll-up hides the *trend*. To see Jan, Feb and Mar next to each other, bank them:

```mrs
BANKED_TABLE 'Jan' 'Jan', 'Feb', 'Mar'
  TITLE 'Satisfaction tracker'
```

Read the first name as the **stub source** — it supplies the rows (`$q1`'s
categories). The remaining names are the tables whose banner columns are placed
side by side, left to right. Here we list `'Jan'` again so its own columns appear in
the tracker; if you only wanted Feb and Mar columns against Jan's row layout, you'd
write `BANKED_TABLE 'Jan' 'Feb', 'Mar'`.

Because every wave has a `Total` (and `North`, `South`, …) column, the duplicate
labels are disambiguated with each source's title, e.g.
`Total (Satisfaction — Jan)`. The output is one wide table — rows are the `$q1`
categories, columns run Jan ‖ Feb ‖ Mar.

---

## The finished script

```mrs
SOURCE "tracker.sav"
%RESPID = $respondent_id

TABLE 'Satisfaction — Jan' NAME 'Jan'
  STUBS $q1 BANNER $region FILTER $wave = 1 STATS col_pct, n
END TABLE
TABLE 'Satisfaction — Feb' NAME 'Feb'
  STUBS $q1 BANNER $region FILTER $wave = 2 STATS col_pct, n
END TABLE
TABLE 'Satisfaction — Mar' NAME 'Mar'
  STUBS $q1 BANNER $region FILTER $wave = 3 STATS col_pct, n
END TABLE

ADDTAB 'Jan', 'Feb', 'Mar' TITLE 'Satisfaction — Q1 roll-up' NAME 'Q1'
BANKED_TABLE 'Jan' 'Jan', 'Feb', 'Mar' TITLE 'Satisfaction tracker'
```

Running it produces five tables: the three monthly waves, the Q1 roll-up (combined
counts), and the side-by-side tracker — numbered sequentially in that order.

---

## What you've learned

- **`TABLE … NAME 'handle'`** registers a table so cross-table ops can address it.
- **`ADDTAB`** sums same-layout tables into a roll-up, recomputing percentages and
  means over the combined base.
- **`BANKED_TABLE`** concatenates several tables' banners side by side; the first
  name is the stub source (rows only — list it again to include its columns).
- Both run after tabulation, reference sources declared **earlier**, and clear
  significance flags.

## Where to go next

<div class="grid cards" markdown>

-   :material-table-large: **[Tables reference §20](../reference/tables.md#cross-table)** —
    the exact rules for `ADDTAB`, `BANKED_TABLE`, and the `NAME` clause.

-   :material-vector-combine: **[Combining files (APPEND)](../reference/data-input.md)** —
    how to stack monthly wave files into one dataset with a wave indicator.

</div>
