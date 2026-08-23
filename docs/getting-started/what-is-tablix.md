# What is Tablix?

Tablix is a desktop application for producing **crosstabulations** and formatted
reports from survey data. You don't click through menus to build each table —
instead you write a short script in **MRScript**, and Tablix runs it.

Think of MRScript as a recipe for your tabulation job. The recipe says:

1. **where the data is** (`SOURCE`),
2. **how to clean and reshape it** (optional — `EDIT`, `RECODE`, `DERIVE`, `STACK`…),
3. **which tables to produce** (`TABLE`), and
4. **how to display them** (`FORMAT`, `STATS`).

Because the whole job is a text file, it is repeatable, reviewable, and easy to
tweak. Re-run the script next month with fresh data and you get the same tables.

---

## A complete script, top to bottom

Here is a small but real job. Don't worry about every keyword yet — just notice the
shape.

```mrs
// ── Load the data ──────────────────────────────────────────────
SOURCE 'data/survey.sav'
%RESPID = $respondent_id          // the column that identifies a respondent

// ── Display defaults for every table ───────────────────────────
FORMAT
  STATS  n, col_pct
  FOOTER 'Source: Customer Survey 2025'
END FORMAT

// ── Build a derived "age group" variable from raw age ──────────
DERIVE @age_group
  LABEL '18-34'   STUB 1 WHERE $age BETWEEN 18 AND 34
  STUB 2 '35-54'  WHERE $age BETWEEN 35 AND 54
  STUB 3 '55+'    WHERE $age >= 55
END DERIVE

// ── Produce a table ────────────────────────────────────────────
TABLE 'Overall satisfaction by age group'
  STUBS  $q1
  BANNER @age_group
  STATS  n, col_pct, sig
END TABLE
```

Run it and Tablix prints a table: satisfaction (`$q1`) down the rows, age groups
across the columns, counts and percentages in each cell, with significance letters
showing which age groups differ.

---

## The three kinds of variable name

This is the single most important convention in MRScript. Every variable name
starts with a symbol that tells you **where it came from**:

| Prefix | Meaning | Example | Comes from |
|--------|---------|---------|------------|
| `$` | **Source** variable | `$gender`, `$q1`, `$age` | a column in your data file |
| `@` | **Derived** variable | `@age_group`, `@concerns` | created in the script (`DERIVE`, `STACK`, `COMPUTE`, `RECODE … INTO`) |
| `%` | **Reserved** constant | `%RESPID` | built in — currently only the respondent key |

!!! note "Why the prefixes matter"

    The `$` and `@` are part of the language, not decoration. They let a source
    column `$brand` and a derived variable `@brand` coexist without clashing. Behind
    the scenes the engine strips the prefix to find the underlying column
    (`$gender` → the `gender` column).

---

## The pieces of a script

A script is a flat list of **statements**. There is no forced order, but the
logical flow almost always reads top-to-bottom like this:

```mrs
SOURCE   'file.sav'              // 1. data input  (one or more files)
%RESPID  = $respondent_id        //    respondent key (optional but recommended)

CONFIG  ...  END CONFIG          // 2. execution settings (significance, output…)
FORMAT  ...  END FORMAT          //    display defaults shared by all tables

VARIABLE $var ... END VARIABLE   // 3. fix up labels / missing codes / scores

DERIVE  @var ... END DERIVE      // 4. data preparation — runs in script order:
EDIT    $var SET 99 WHERE ...    //    clean, recode, compute, reshape
RECODE  $var (...) INTO @new
STACK   @name ... END STACK

TABLE 'title' ... END TABLE      // 5. the tables you want
SCOPE WHERE ... ENDSCOPE         //    (or groups of tables on a sub-group)

EXPORT DATA 'clean.sav'          // 6. optionally write the cleaned data back out
```

You will meet each of these in the [Tutorial](../tutorial/first-crosstab.md) and the
[Language Reference](../reference/index.md). For now, the mental model is:

> **Load → (clean / reshape) → tabulate → display → (export).**

---

## How a script runs

When you run a script, Tablix walks these steps in order:

```
.mrs script
   │
   ├─ 1. Load the SOURCE file(s)               → data + variable metadata
   ├─ 2. Apply CONFIG / FORMAT settings
   ├─ 3. Resolve %RESPID
   ├─ 4. Validate the whole script             → report every error at once
   ├─ 5. Run data preparation in script order  → DERIVE / EDIT / RECODE / STACK …
   ├─ 6. Build each TABLE                       → counts, %, stats, significance
   │
   └─ Output:  plain text  ·  tagged CSV  ·  styled Excel  ·  HTML viewer  ·  PowerPoint deck
```

A key idea: **data-preparation statements run in the exact order you write them.**
An `EDIT` that cleans a column will be seen by a later `DERIVE` that reads it. The
script is, in effect, a reproducible transformation log.

---

## Where to go next

<div class="grid cards" markdown>

-   :material-download: **[Install & first run](installation.md)** — get `mrscript`
    running and produce your first output.

-   :material-school: **[Your first crosstab](../tutorial/first-crosstab.md)** —
    build a real table step by step.

</div>
