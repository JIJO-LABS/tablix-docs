---
title: Language Reference
---

# MRScript language reference

The complete specification of MRScript — every statement, clause, and statistic.
This is the page you keep open while you script. If you are new, work through the
[Tutorial](../tutorial/first-crosstab.md) first; come here for the exact rules.

!!! info "Version"

    MRScript **2.2**. Every feature documented here is implemented unless explicitly
    marked **(staged)** or listed under [Planned features](quick-reference.md#planned-features).

---

## Contents

<div class="grid cards" markdown>

-   **[1 · Basics](basics.md)**

    Script structure, comments, the `$`/`@`/`%` naming convention, string quoting,
    the preprocessor (`SET` / `DEFINE` / `CALL`) and the `.mrst` authoring layer.

-   **[2 · Data input](data-input.md)**

    `SOURCE` (files, formats, codebooks), `%RESPID` (the respondent key),
    `APPEND` / `JOIN` / `MERGE` for combining files, and `AGGREGATE` for
    rolling exposure/diary rows up to respondent level.

-   **[3 · Setup blocks](setup-blocks.md)**

    `CONFIG` (execution settings), `FORMAT` (display defaults), and `VARIABLE`
    (metadata overrides).

-   **[4 · Data preparation](data-preparation.md)**

    `DERIVE`, `SPREAD`, `COMBINE`, `STACK`, `EDIT`, `RECODE`, `KEEP/DROP ROWS`,
    `COMPUTE` — clean, recode, compute, and reshape, all in script order.

-   **[5 · Tables](tables.md)**

    `TABLE` and all its clauses (`STUBS`, `DISTRIBUTION`, `ADD`, `BANNER`, `GRID`,
    `STATS`…), named `BANNER`s, and `SCOPE`.

-   **[6 · Output](output.md)**

    `EXPORT DATA` (write the dataset back out) and the output formats + CLI.

-   **[7 · Data health](health.md)**

    `mrscript health` — pre-tabulation QC: respondent checks (duplicate IDs,
    out-of-range codes, dead records), quality signals (straightliners, speeders,
    flatline batteries), structural checks (broken filters), and `EXPECT`
    routing assertions. Text / JSON / CSV reports.

-   **[8 · Reference details](reference-details.md)**

    The complete `STATS` list, condition syntax, base computation, missing values,
    and `STATS` inherit/override/merge modes.

-   **[9 · Quick reference](quick-reference.md)**

    Every keyword at a glance, common patterns, and planned features.

-   **[10 · Data Diff](diff.md)**

    `mrscript diff` — compare two deliveries of the same dataset: schema changes,
    dropped/added respondents, per-cell value changes, and distribution shift
    summaries. Text / JSON / CSV reports with configurable severity thresholds.

-   **[11 · RIM Weighting](weighting.md)**

    `RIM @weight … END RIM` — iterative proportional fitting (raking) to align
    the sample to population targets. `DIMENSION` targets, convergence controls,
    `WEIGHT_CAP`, and `BASE_WEIGHT`. Produces a derived `@weight` column usable
    in any `TABLE WEIGHT`.

-   **[12 · Tab-Plan Reconciliation](reconcile.md)**

    `mrscript reconcile` — validate a script's produced tables against a client
    tab-plan spreadsheet (CSV or xlsx). Coverage checks, conformance checks,
    fuzzy title matching. Text / JSON / CSV reports; `--fail-on` for CI gates.

-   **[13 · NL Assistant](assist.md)**

    `mrscript assist` — turn a plain-English request into a validated
    `TABLE` / `DERIVE` snippet. Anthropic (Haiku default) or any OpenAI-compatible
    endpoint. Grounded with a variable catalog when `--data` is given.

-   **[14 · Recode Suggester](suggest.md)**

    `mrscript suggest $q1 --data survey.sav` — reads a variable's value labels and
    proposes NET / recode groupings as a validated `DERIVE` block. Scales get
    top/bottom-box NETs; nominals get thematic nets. Same provider as `assist`.

-   **[15 · Cell Provenance](provenance.md)**

    `mrscript provenance` — drill any produced table cell (stub row × banner column,
    optionally a NET) back to the respondent IDs that contribute to it. Read over
    the same masks the Tabulator already counted; no re-tabulation. Weighted IDs +
    CSV worklist.

-   **[16 · Table-Run Diff](table-diff.md)**

    `mrscript table-diff` — compare two sets of produced tables table-by-table
    and cell-by-cell: added / removed tables, structural changes, per-cell value
    shifts beyond configurable thresholds. Works on saved `TableStore` directories
    or `.mrs` scripts. Text / JSON / CSV; `--fail-on` for CI.

-   **[17 · Audit Manifest](audit-manifest.md)**

    `mrscript run --out-store DIR` — saves the `TableStore` and an `audit.json`
    capturing script + data SHA-256, git context, runtime metadata, and effective
    `CONFIG`. Pairs with `table-diff` to give a full provenance header showing
    exactly which script version and data produced each run.

-   **[18 · Open-End Coding](coding.md)**

    `mrscript code` — turn free-text verbatim answers into a frame of themes and
    write the result as a 0/1 dichotomy group (`{var}_{code}` columns). Manual
    (analyst-fills) or AI-assisted via the same provider harness as `assist`. Output
    round-trips via `CODEBOOK` so the themes tabulate like any `multi_binary` set.

</div>

---

## The naming convention, in one table

You'll see these everywhere. Memorise them and most scripts read themselves.

| Prefix | Kind | Created by | Example |
|--------|------|-----------|---------|
| `$name` | **Source** variable | a column in the data file | `$gender`, `$q1` |
| `@name` | **Derived** variable | `DERIVE`, `STACK`, `COMPUTE`, `RECODE/EDIT … INTO` | `@age_group`, `@bmi` |
| `%NAME` | **Reserved** constant | built in (only `%RESPID` today) | `%RESPID` |

Names are case-sensitive; the `$`/`@` prefix is mandatory and part of the grammar.
