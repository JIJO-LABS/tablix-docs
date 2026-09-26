# Part 4 · Data preparation

All data-preparation statements run **in script order** and are fully replayable.
`EDIT` / `RECODE` / `COMPUTE` that target a new `@variable` leave the source
untouched; those that target an existing column (in place) change its values.

---

## 11. DERIVE (computed / recoded variables) {#derive}

```mrs
DERIVE @var_name
  [LABEL 'text'] [TYPE type_value] [SCORE code = value ... | SCORE lo..hi]
  (STUB ... | NET ... ENDNET | HEADING ... ENDHEADING)*
END DERIVE
```

`SCORE lo..hi` is shorthand for the identity run (`SCORE 1..5` = `SCORE 1 = 1` …
`SCORE 5 = 5`), which is the usual case for a rating scale; a scale needing different
point values still takes one `SCORE code = value` per code. Same clause, same meaning as
on a [`VARIABLE` block](setup-blocks.md#variable).

Creates a new `@variable` from condition-based stubs. A derived variable is
**multi-response**: a respondent's value is the **list** of every stub code whose
condition matches — not first-match-wins. Mutually-exclusive conditions give the
ordinary single-punch case (at most one code per respondent); overlapping conditions
(e.g. a brand named at several questions) keep every match.

The new column can be used as `STUBS` or `BANNER`, or referenced by a later
`DERIVE`/`EDIT`/`RECODE`/`COMPUTE` — a reference like `@var = code` resolves to
**list membership** (is that code in the respondent's list), so it retrieves the
stub's set even when stubs overlap. The variable's base is the **union** of its stubs
(respondents coded on at least one listed item); mean / score summaries explode the
list (one scored response per code).

**`LABEL 'text'`** (optional) is the derived variable's own display label — it drives
the section header when the var is used in `STUBS`, and, for a flat (non-crossed)
`BANNER`, the group band shown above that segment's columns. Omit it and the bare
`@name` is used instead. An explicit `LABEL ''` is **not** the same as omitting it: it
means "no header for this segment" — every renderer (text/CSV/HTML/xlsx) skips the
header band (and its underline) entirely rather than drawing a blank one. This is
distinct from a `STUB`'s own label below, which names that stub's row, not the
variable.

### 11a. STUB (row definition)

```mrs
STUB code 'label' [display_props] WHERE condition      // label-first
STUB code [display_props] WHERE condition 'label'      // label-last
STUB code [display_props] WHERE condition              // label inherited
```

- **`code`** — integer code stored in the column (must be **unique** within the
  `DERIVE` — it is the key for code-based references). Conditions may reference source
  (`$`) variables and `@variables` defined **earlier**. A respondent is added to every
  stub whose condition holds.
- **`label`** — optional. When omitted, it is **inherited** from the variable named in
  a simple `var = code` condition (e.g. `STUB 5 WHERE @T1X = 5` inherits `@T1X`'s label
  for code 5; `$gender = 1` inherits "Male"), falling back to the bare code when that
  code has no label. Any other condition shape (`>`, `AND`/`OR`, multi-value `IN`) has
  no single code to inherit from, so a label is required there.

```mrs
// Reuse a scale's labels in a NET without retyping them:
NET 'Top 2 Box (T2B)'
  STUB 5 WHERE @T1X = 5        // -> 'Like it very much'
  STUB 4 WHERE @T1X = 4        // -> 'Somewhat like it'
ENDNET
```

```mrs
// Single-punch — mutually-exclusive conditions, ≤ 1 code per respondent
STUB 1 '20-29' WHERE $AGE_CAT = 2
STUB 2 '30-39' WHERE $AGE_CAT IN (3, 4)
STUB 3 '40+'   WHERE $AGE_CAT >= 5

// Multi-response — overlapping conditions, a respondent may match several
STUB 1 'Cavities' WHERE $concern_1 = 1
STUB 2 'Plaque'   WHERE $concern_2 = 1
STUB 3 'Gums'     WHERE $concern_3 = 1
```

### 11b. STUB display properties {#stub-display-properties}

Placed between the code/props and `WHERE`:

| Property | Effect |
|----------|--------|
| `DISPLAY pct_only` | Show label + col% only (suppress the n line). |
| `DISPLAY count_only` | Show label + n only (suppress the % line). |
| `DISPLAY row_pct` | Show row % for this row instead of column %. |
| `SUPPRESS` | Hide this row (still tabulated; feeds nets above it). |
| `CUMULATIVE` | Show a running cumulative % down the rows. |
| `DECIMALS n` | Decimal places for this row's counts/% (overrides the table/global `DECIMALS`; default 0). |
| `KEEP_IF_ZERO` | Keep this row when `BLANK_SUPPRESS row` is on and n = 0. |

### 11c. NET blocks — summary rows

```mrs
NET [ANY | ALL] 'label'
  (STUB ... | NET ... | HEADING ...)*
ENDNET                                  -- or: END NET
```

- `ANY` (default) — net = respondents matching at least one member (de-duplicated).
- `ALL` — net = respondents matching every member (intersection).

NETs may nest to any depth. The closer may be written either as one word (`ENDNET`) or
as two (`END NET`) — they are the same token to the parser, so pick whichever reads
better next to the `END TABLE` / `END DERIVE` closers around it and stay consistent.

### 11d. HEADING blocks — display-only label rows

```mrs
HEADING 'label'
  (STUB ... | NET ... | HEADING ...)*
ENDHEADING                              -- or: END HEADING
```

A `HEADING` renders a label row with blank cells (no evaluator, no counts) — a section
divider inside the stub list. Children render indented beneath it. As with `ENDNET`,
`END HEADING` is accepted as the two-word spelling.

### Example — nets, headings, and display props together

```mrs
DERIVE @concerns
  LABEL 'Oral-care concerns'
  TYPE  multi_punch
  HEADING 'Health'
    NET 'Any health concern'
      STUB 1 DISPLAY pct_only WHERE $A_S13_1 = 1  'Cavities / decay'
      STUB 2 DISPLAY pct_only WHERE $A_S13_2 = 1  'Plaque / tartar'
    ENDNET
  ENDHEADING
  STUB 8 KEEP_IF_ZERO WHERE $A_S13_8 = 1  'Bleeding gums'
  STUB 9 SUPPRESS     WHERE $A_S13_9 = 1  'None of these'
END DERIVE
```

!!! note "Chained derives"

    A `DERIVE` condition may reference an earlier `@var` by its code (e.g.
    `STUB 1 WHERE @ageband = 1`). Referenced `@vars` must be declared **earlier** in
    the script (forward references and self-references are errors), and the referenced
    code must exist on that derived var.

---

## 11b. SPREAD (multiple-category multi-response shorthand) {#spread}

A multi-select question is stored one of two ways:

| Layout | Storage | In Tablix |
|---|---|---|
| **Multiple-dichotomy** | one `0/1` column per item (`Brand_1=0`, `Brand_2=1`, …) | auto-detected as `multi_binary` — **no shorthand needed** |
| **Multiple-category ("spread")** | N answer **slots**, each holding the **code** of one chosen item, unused slots null (`Brand_1=2`, `Brand_2=4`, `Brand_3=5`, `Brand_4=.`, …) | use **`SPREAD`** |

`SPREAD` reassembles the spread/category slots into **one** multi-response `@variable` —
a respondent is coded with code *k* iff **any** listed slot equals *k*.

```mrscript
SPREAD @name FROM $slot1, $slot2, ...  [CODES <codeframe>] [LABEL "text"]
```

- **`FROM $slot1, $slot2, …`** — the answer-slot variables (any order; at least one,
  usually all the slots of the question). Slots must be categorical / coded — an
  `open_end` (text) slot is rejected.
- **`CODES lo..hi | c1, c2, …`** *(optional)* — an explicit, closed codeframe: one stub
  per listed code, **in the given order**, even at 0 count. Ranges and single codes mix
  freely and duplicates are dropped:
  ```mrscript
  CODES 1..41           CODES 1, 3, 5           CODES 1..41, 99
  CODES 1..3, 10..12, 99
  ```
  Without `CODES`, the frame is **data-driven** (only the codes actually present), so a
  code nobody chose is missing and the frame can differ slightly across data slices.
  Give `CODES` when the full frame matters — e.g. a coded open-end where every theme
  should show even at 0, or a chained `NET`/`DERIVE` that references a specific code
  and needs it to always validate. Labels still come from the slots' value labels where
  present; a code with none gets a bare-number label.
- **`LABEL "text"`** *(optional)* — the variable label; defaults to the bare `@name`.

The result is an **ordinary multi-response variable** (exactly like a `DERIVE` list):
it tabulates with `STUBS @name`, bases on the **union** (respondents coding ≥ 1 item),
nets and crosses, takes overlap-aware significance, and exports as `{name}_{code}` 0/1
dichotomy columns. Stub codes + labels come from the slots' **shared codeframe** (their
value labels; declared-`MISSING` codes excluded). If the slots carry no value labels,
the codes present in the data are used with bare-number labels — give them a
`VARIABLE … VALUE` block (or a `CODEBOOK`) for names.

```mrscript
SOURCE 'survey.sav'
%RESPID = $respondent_id

SPREAD @known FROM $kb_1, $kb_2, $kb_3, $kb_4, $kb_5  LABEL "Brands known"

TABLE 'Brand awareness'
  STUBS @known   BANNER $gender   STATS col_pct, n
END TABLE
```

!!! note "It's a pure shorthand"
    `SPREAD` expands into the equivalent multi-response `DERIVE` (one `STUB` per code,
    `WHERE $kb_1 = k OR $kb_2 = k OR …`). Writing that `DERIVE` by hand produces an
    identical table — `SPREAD` just saves the typing.

---

## 11c. COMBINE (same-codeframe variable merger) {#combine}

`COMBINE` merges two or more variables that **share the same codeframe** into one
multi-response variable. The classic use case: a brand or item question was asked to
different groups **separately** (kids vs. teens, two waves, two question versions),
and each group's column uses the same set of codes.

The key difference from `SPREAD`:

| | Reassembles | Sources |
|---|---|---|
| **`SPREAD`** | **one** question stored across N answer slots (each slot holds the code of one chosen item — a floating-code layout) | `$` source vars only |
| **`COMBINE`** | N **semantically separate** variables (different groups / waves / question versions) that happen to share a codeframe | `$` source vars **and** `@` derived list vars (mix freely) |

A respondent is coded with code *k* iff their variable **equals** *k* (a `$` single-punch
source) or **has** *k* **in its list** (an `@` derived list var — `DERIVE` / `SPREAD` /
an earlier `COMBINE`).

```mrscript
COMBINE @name FROM var1, var2, ...  [LABEL "text"]
```

- **`FROM var1, var2, …`** — two or more variables, each either a `$source_var`
  (single-punch) or an `@derived_var` (a multi-response list var, defined **earlier**
  in the script). At least one is required; `open_end` (text) sources are rejected.
- **`LABEL "text"`** *(optional)* — the variable label; defaults to the bare `@name`.

**Codeframe resolution** — for `$` source vars: the union of their value labels (the
first source wins on a label clash; declared-`MISSING` codes are dropped, falling back
to the distinct integer values present when unlabelled). For `@` derived vars: the leaf
stub codes/labels from whichever source defines each code first (`NET`/`HEADING` rows
are skipped — they're composites, not real codes).

The result behaves exactly like `DERIVE` / `SPREAD`: tabulates with `STUBS @name`,
bases on the union (respondents coding ≥ 1 item), nets and crosses, takes overlap-aware
significance, and exports as `{name}_{code}` 0/1 dichotomy columns.

```mrscript title="Two separate brand questions (one per sub-group) merged into one"
SOURCE 'survey.sav'

VARIABLE $S13K  MISSING 99  END VARIABLE
VARIABLE $S13TA MISSING 99  END VARIABLE

COMBINE @S13 FROM $S13K, $S13TA
    LABEL "FLAVOURED MILK BRAND MOST OFTEN CONSUMED"

TABLE 'Brands'
  STUBS @S13   BANNER $S7 BY $S2_1   STATS col_pct, n
END TABLE
```

```mrscript title="Combining two SPREAD-derived multi-response vars"
SPREAD @kids_brands FROM $kb_1, $kb_2, $kb_3   LABEL "Kids brands"
SPREAD @teen_brands FROM $tb_1, $tb_2           LABEL "Teen brands"

COMBINE @all_brands FROM @kids_brands, @teen_brands
    LABEL "All brands (kids + teens)"

TABLE 'Brand awareness'
  STUBS @all_brands   BANNER $seg   STATS col_pct, n
END TABLE
```

!!! note "It's a pure shorthand"
    Like `SPREAD`, `COMBINE` expands into the equivalent multi-response `DERIVE` (one
    `STUB` per code, `WHERE $src1 = k OR $src2 = k …` or `@src1 = k OR @src2 = k …`).
    The result is byte-for-byte identical to a hand-written `DERIVE`.

---

## 12. STACK (rotation / stacking / diary / nested loops) {#stack}

`STACK` reshapes wide repeated-measures columns into a **long** frame where each row
is one exposure (product / concept / wave / diary occasion). Tabulate against it with
`LEVEL @name` in a `TABLE` ([§17](tables.md)). There are two forms depending on the
data structure.

### 12a. Single-axis STACK — uniform rotation

Use this form when all `MAP` variables cycle through the same set of positions (a
concept test, a product rotation, a repeat-measures wave).

```mrs
STACK @name
  POSITIONS lo .. hi
  MAP @target = $source_#              (placeholder form — $ vars only)
  MAP @target FROM $v1, $v2, ...       (explicit list — $ or @ vars)
  MAP @target = POSITION               (the row's own slot number — no source read)
  [MAP @target FROM $v1, $v2, ...  SCORE code = value ...]
END STACK
```

| Clause | Meaning |
|--------|---------|
| `POSITIONS lo .. hi` | Declares the slot range, e.g. `POSITIONS 1..3` → 3 slots. |
| `MAP @target = $prefix_#` | The `#` placeholder expands to each position: `$I_#_Q1` → `$I_1_Q1, $I_2_Q1, $I_3_Q1`. Source variables only (`$` prefix). |
| `MAP @target FROM var, var, …` | Explicit source list in slot order. Accepts both `$source` and `@derived` vars. All `MAP` lists must have the same number of sources (`= hi − lo + 1`). |
| `MAP @target = POSITION` | The target holds the row's own **slot number** (1-based, within `POSITIONS lo..hi`). No source column is read at all — see below. |
| `SCORE code = value` (on any MAP) | Numeric score for the target — for `mean`/`std_dev` on the `LEVEL` table. Inline `SCORE` wins over an inherited source `VARIABLE SCORE` block. Note the `SCORE lo..hi` range shorthand available on `VARIABLE` and `DERIVE` is **not** accepted here — write one `SCORE code = value` per code, or declare the range on the source `VARIABLE` and let the target inherit it. |

!!! warning "The stack's own name is not an addressable variable"

    The stacked frame internally carries a slot-number column named after the `STACK`
    itself (`@trial` holds `1..3` for `POSITIONS 1..3`), but it is **not** exposed as an
    ordinary condition variable — `WHERE @trial = 1` is rejected as an unknown variable.

    Use **`MAP @target = POSITION`** to get a column with the same values that you *can*
    address:

    ```mrs
    STACK @trial
      POSITIONS 1..3
      MAP @product = $I_#_Product_Shown
      MAP @pos     = POSITION            // 1, 2 or 3 — which exposure this row is
    END STACK

    TABLE 'First exposure only'
      LEVEL @trial   STUBS @product   FILTER @pos = 1
    END TABLE
    ```

    This replaces the older workaround of declaring one constant per slot and mapping
    across them (`COMPUTE @p1 = 1` … `MAP @pos FROM @p1, @p2, @p3`), which is still
    valid but needs one `COMPUTE` per position.

    The target is a plain **unlabelled numeric** column, exactly as a `COMPUTE` var is,
    so `STUBS @pos` summarises as Mean / Std Dev rather than giving one row per slot.
    Use it to `FILTER` (as above) or as a condition. To get it as a labelled stub axis,
    wrap it in a stacked `DERIVE` with one `STUB` per position
    (`STUB 1 '1st exposure' WHERE @pos = 1`, …).

```mrs
SOURCE 'concept_test.sav'
%RESPID = $respondent_id

STACK @trial
  POSITIONS 1..3
  MAP @product  = $I_#_Product_Shown
  MAP @overall  = $I_#_Q1  SCORE 1 = 1  SCORE 2 = 2  SCORE 3 = 3  SCORE 4 = 4  SCORE 5 = 5
  MAP @purchase = $I_#_Q5
END STACK

TABLE 'Overall liking by product'
  LEVEL @trial   STUBS @overall   BANNER @product   STATS n, col_pct, sig
END TABLE

TABLE 'Reach (unique respondents)'
  STUBS @product   BASE respondents   // counts each respondent once
END TABLE
```

#### Stacked DERIVEs — adding NETs / scores after the STACK

A `DERIVE` block placed **after** a `STACK` may reference that stack's `MAP` target
variables in its conditions. The engine detects this automatically and compiles the
`DERIVE` into the stacked frame instead of the respondent frame.

```mrs
STACK @trial
  POSITIONS 1..2
  MAP @product  = $I_#_PP1
  MAP @taste    = $I_#_T1          // numeric 1–5, no labels needed
END STACK

// This DERIVE runs in @trial's stacked frame — @taste is available here.
DERIVE @T1_rating 'Overall Liking'
  SCORE 1..5                       // identity scores — same as SCORE 1=1 … SCORE 5=5
  NET 'Top 2 Box (T2B)'
    STUB 5 'Like very much'    WHERE @taste = 5
    STUB 4 'Somewhat like'     WHERE @taste = 4
  ENDNET
  STUB 3 'Neither'             WHERE @taste = 3
  NET 'Bottom 2 Box (B2B)'
    STUB 2 'Somewhat dislike'  WHERE @taste = 2
    STUB 1 'Dislike very much' WHERE @taste = 1
  ENDNET
END DERIVE

// LEVEL is inferred automatically from @T1_rating being a stacked var.
TABLE 'T1 - Overall Liking'
  STUBS @T1_rating   BANNER @product   STATS col_pct, n, mean
END TABLE
```

!!! info "LEVEL auto-detection — and the three cases it deliberately skips"

    Inference reads the **row axis only**: `STUBS`, `DISTRIBUTION`, `ADD`, and a `GRID`
    table's `COLUMN` vars. If they resolve to exactly one stack, that stack's frame is
    used. Explicit `LEVEL @name` always takes precedence.

    Three cases are *not* inferred, and each needs `LEVEL` written on the table:

    | Case | Why | Without `LEVEL` |
    |------|-----|-----------------|
    | Stacked vars only in the **`BANNER`** | The banner is excluded on purpose, so a respondent-level `STUBS` table is never silently promoted to the stacked frame | Runs on the respondent frame — and fails if the banner var exists only there |
    | **`TYPE SUMMARY`** batteries | `STATEMENTS` is not a row-axis clause, so it is never read | Same — the battery vars aren't found |
    | Row vars spanning **two stacks** | Ambiguous, so inference declines rather than guessing | Falls back to the respondent frame |

    The first case is the common one in a rotation study: screener and demographic
    tables whose stubs are respondent-level but whose banner is the pack / concept being
    evaluated. Those read as ordinary tables to the eye, so it is worth a comment in the
    script saying why `LEVEL` is there.

### 12b. Multi-axis STACK — diary / nested loops

Diary data encodes a nested loop in column names (e.g. days × dayparts × occasions).
This form reshapes wide → long with one row per innermost-level occasion, carrying
coarser-grain values (day, daypart) down onto every child row automatically.

```mrs
STACK @name
  AXIS axisname lo .. hi          (one per nesting level, outermost first)
  ...
  MAP @target AT axisname FROM var, var, ...  [SCORE code = value ...]
  ...
  DROP EMPTY @target = code [, code ...] [, NULL]
  ...
END STACK
```

**`AXIS axisname lo .. hi`** — declares one loop level. `AXIS` declarations are
ordered **outermost first**; the last declared `AXIS` is the output grain. Axis names
are plain identifiers (no `$` / `@`).

**`MAP @target AT axisname FROM …`** — assigns a variable at a specific grain. `AT` is
**required** on every `MAP` when any `AXIS` is declared.

!!! warning "Source-list count contract"

    | `AT` axis | Source list length |
    |-----------|--------------------|
    | outermost axis | extent of that axis alone |
    | any middle axis | product of extents from outermost through it |
    | innermost axis | product of **all** extents (= total slots) |

    **List ordering is row-major, innermost fastest:** `(day1,dp1,occ1)
    (day1,dp1,occ2) (day1,dp2,occ1) …`. Coarser vars follow the same order, ignoring
    inner axes.

**`DROP EMPTY @target = code [, …] [, NULL]`** — remove any stacked row where
`@target` equals one of the listed codes (or is null when `NULL` is listed). `NULL` is
a literal keyword. **Cascade:** dropping on a coarser-grain variable removes all child
rows under it.

**Auto-emitted index columns**

| Column | Values | Meaning |
|--------|--------|---------|
| `@<axisname>_n` | `lo .. hi` | slot position on that axis (e.g. `@day_n = 1` or `2`) |
| `@<stackname>_slot` | `1 .. slots` | composite sequential slot id (STACKID) |

> Note: `@day` is the day-of-week **code** you mapped (e.g. 5 = Friday); `@day_n` is
> which diary day slot (1 = first). They differ.

Rows are sorted **respondent-major**: all of a respondent's slots together in slot
order, then the next respondent.

!!! danger "Grain-aware advisory — and when it stays quiet"

    Each stacked variable carries an internal grain tag. When a `LEVEL` table counts
    rows (i.e. no `BASE respondents`) and one of its `STUBS` is a **respondent-level**
    variable such as `$gender`, the engine checks each banner column's own base and
    warns only if a column really does hold more than one row per respondent:

    ```
    Table 12: LEVEL table counts rows but '$gender' is respondent-level, and column
    'TOTAL' pools more than one slot per respondent — counts there are inflated.
    Use BASE respondents if you meant penetration.
    ```

    The check matters because the same script shape can be either right or wrong:

    | Banner | Warns? | Why |
    |--------|--------|-----|
    | One column per slot value (a column per concept / pack) | **No** | Each respondent contributes exactly one row to each column, so a respondent-level count in it is already a respondent count |
    | A pooled column — a `Total`, an "all concepts combined", or any column whose condition a respondent can satisfy in more than one slot | **Yes**, naming that column | Those rows are the same person counted two or three times |

    So adding a `Total` column to an otherwise-safe rotation table is exactly what turns
    a correct table into an inflated one, and the advisory names the column that did it.

**Validation errors from multi-axis STACK**

- `AT axisname` is required on every `MAP` when any `AXIS` is present.
- `AT 'hour' is not a declared AXIS` — a typo in the `AT` name is caught.
- Source count mismatch: *"MAP @beverage AT occasion expected 12 sources (2×3×2),
  got 11"* — the arithmetic is shown.
- `DROP EMPTY` target must be a `MAP` target in this `STACK`.
- Duplicate `AXIS` names are an error.

??? example "Full 3-level diary (day × daypart × occasion)"

    10 respondents kept a drink diary over 2 days, 3 dayparts/day, 2 occasions/daypart
    = 12 occasion slots per respondent. Column naming:
    `VARIABLE_{day}_{daypart}_{occasion}`.

    ```mrs
    SOURCE 'diary_fieldwork.sav'
    %RESPID = $RESPID

    VARIABLE $BEVERAGE_1_1_1
      LABEL   'Beverage consumed'
      VALUE 1 'Tea'  VALUE 2 'Coffee'  VALUE 3 'Water'  VALUE 4 'Juice'
      MISSING 99
    END VARIABLE
    // Apply the same VARIABLE block to each of the 12 BEVERAGE columns,
    // or use a CODEBOOK file instead.

    STACK @diary
      AXIS day      1..2
      AXIS daypart  1..3
      AXIS occasion 1..2

      // day-grain MAP: 2 sources (one per day value)
      MAP @day AT day FROM $DAY_1, $DAY_2

      // daypart-grain MAP: 6 sources (2 days × 3 dayparts, row-major)
      MAP @daypart AT daypart
        FROM $DAYPART_1_1, $DAYPART_1_2, $DAYPART_1_3,
             $DAYPART_2_1, $DAYPART_2_2, $DAYPART_2_3

      // occasion-grain MAPs: 12 sources (2×3×2, innermost fastest)
      MAP @beverage AT occasion
        FROM $BEVERAGE_1_1_1, $BEVERAGE_1_1_2,
             $BEVERAGE_1_2_1, $BEVERAGE_1_2_2,
             $BEVERAGE_1_3_1, $BEVERAGE_1_3_2,
             $BEVERAGE_2_1_1, $BEVERAGE_2_1_2,
             $BEVERAGE_2_2_1, $BEVERAGE_2_2_2,
             $BEVERAGE_2_3_1, $BEVERAGE_2_3_2

      MAP @quantity AT occasion
        FROM $QUANTITY_1_1_1, $QUANTITY_1_1_2,
             $QUANTITY_1_2_1, $QUANTITY_1_2_2,
             $QUANTITY_1_3_1, $QUANTITY_1_3_2,
             $QUANTITY_2_1_1, $QUANTITY_2_1_2,
             $QUANTITY_2_2_1, $QUANTITY_2_2_2,
             $QUANTITY_2_3_1, $QUANTITY_2_3_2

      DROP EMPTY @beverage = NULL, 99   // remove unfilled / invalid occasions
    END STACK

    // Auto-emitted: @day_n (1..2), @daypart_n (1..3), @occasion_n (1..2), @diary_slot (1..12)

    FORMAT  STATS n, col_pct  END FORMAT

    TABLE 'T1. Beverages consumed'
      STUBS @beverage   LEVEL @diary
    END TABLE

    TABLE 'T2. Beverages by diary day'
      STUBS @beverage   BANNER @day_n   LEVEL @diary
    END TABLE

    TABLE 'T3. Beverages by daypart'           // crossed: daypart within day
      STUBS @beverage   BANNER @daypart_n BY @day_n   LEVEL @diary
    END TABLE

    TABLE 'T5. Beverage penetration (unique respondents)'
      STUBS @beverage   LEVEL @diary   BASE respondents
    END TABLE

    TABLE 'T6. Quantity consumed (per occasion)'
      DISTRIBUTION @quantity   LEVEL @diary
      STATS n, col_pct, mean, std_dev
    END TABLE
    ```

---

## 13. EDIT (conditional value edit)

```mrs
EDIT $var SET value WHERE condition [INTO @new]
```

Sets a column's value to `value` for the rows matching the condition. **In place** by
default (the source column's values change); `INTO @new` writes a new derived column
and leaves the source untouched.

```mrs
EDIT $age SET 999 WHERE $age > 120              // flag impossible ages
EDIT $q1  SET 99  WHERE $q1 < 1                 // out-of-range → missing code
EDIT $aware SET 1 WHERE $considered = 1 INTO @aware_adj   // new column
```

Typical cleaning pattern — edit to a sentinel, then declare it missing:

```mrs
EDIT $age SET 999 WHERE $age > 120
VARIABLE $age MISSING 999 END VARIABLE
```

---

## 14. RECODE (value remap)

```mrs
RECODE $var (sources -> dest ['label']) ... [ELSE n ['label']] [INTO @new]
```

Remaps sets of old codes to new ones **simultaneously** (every branch tests the
original value — rules do not cascade). In place by default; `INTO @new` writes a new
column. `ELSE` recodes any unmatched value (omit `ELSE` to keep them as-is).

Labels are optional per rule. When any label is supplied (or the source was already
categorical), `RECODE` rebuilds the target's value labels / stubs; a label-less
numeric column stays numeric with its values simply remapped.

```mrs
// Collapse a 1–5 scale into Bottom / Top, with labels, into a new column
RECODE $q1 (1,2,3 -> 1 "Bottom 3") (4,5 -> 2 "Top 2") INTO @q1_top2

// In place, with an ELSE catch-all
RECODE $region (1,2 -> 1 "Metro") (3,4 -> 2 "Non-metro") ELSE 9 "Other"

// Pure numeric remap (no labels) — column stays numeric
RECODE $rating (1,2 -> 1) (3 -> 2) (4,5 -> 3)
```

---

## 15. KEEP / DROP ROWS (universal row rejection) {#keep--drop-rows}

```mrs
KEEP ROWS WHERE condition
DROP ROWS WHERE condition
```

Filters respondents at the **data level** — the row is physically removed from the
working dataset. Every downstream `DERIVE`, `STACK`, table, base count, and export
reflects it. Place it once and it is in force for the entire rest of the script.

- `KEEP ROWS` — keep only rows matching the condition; all others are removed.
- `DROP ROWS` — remove rows matching the condition; all others are kept.

```mrs
DROP ROWS WHERE $speeder = 1                 // remove speeders
KEEP ROWS WHERE $age BETWEEN 18 AND 65       // restrict to the target sample
DROP ROWS WHERE $consent = 0                 // remove non-consenting
```

Multiple statements are allowed and applied in script order. To blacklist specific
respondents, use the `%RESPID` source column directly:

```mrs
DROP ROWS WHERE $SbjNum IN (12345, 67890, 11111)
```

### Choosing between DROP ROWS, SCOPE, and TABLE FILTER

| Mechanism | Scope | Use for |
|-----------|-------|---------|
| `DROP ROWS WHERE cond` | **Data-level.** Row is gone for all `DERIVE`s, `STACK`s, tables, and exports. Irreversible within the run. | Universal exclusions: QC rejects, test responses, out-of-scope records, sample-block removal. |
| `SCOPE WHERE cond … ENDSCOPE` | **Table-level.** Data stays intact; only the tables inside the `SCOPE` count matching rows. | A subset of tables on a sub-group (SET 1 viewers, T2B re-contacts, a named sample block). |
| `TABLE … FILTER cond` | **Single-table.** Equivalent to a one-table `SCOPE`. | Ad-hoc per-table conditions. |

`DROP ROWS` and `SCOPE` compose naturally — drop bad data first, then slice the clean
data for specific table groups:

```mrs
DROP ROWS WHERE $speeder = 1          // universal: no speeders anywhere

SCOPE WHERE $gender = 1 LABEL 'Males'
  TABLE 'Q1 — Males' STUBS $q1 END TABLE
ENDSCOPE

TABLE 'Q1 — Total' STUBS $q1 END TABLE  // non-speeder total, all genders
```

---

## 16. COMPUTE (arithmetic expressions) {#compute}

```mrs
COMPUTE @new = expression
```

Builds a new **numeric** `@column` from an arithmetic expression.

| Element | Supported |
|---------|-----------|
| Operators | `+  -  *  /` (standard precedence: `* /` before `+ -`) |
| Parentheses | `( )` group sub-expressions |
| Unary minus | `-expr` |
| Numbers | integer or decimal literals |
| Variables | `$source` or `@derived` (referenced earlier) |
| Functions | `round(x)`, `abs(x)`, `sqrt(x)`, `min(a, b, …)`, `max(a, b, …)`, `count(@listvar)` |

`count(@listvar)` returns the **number of selected codes** in a multi-response
(`DERIVE` / `SPREAD`) list variable for each respondent — an empty list counts `0`.
It takes exactly one argument and it must be a `@`-list variable (a source `$var`
or a sub-expression is rejected).

```mrs
COMPUTE @bmi    = $weight / ($height * $height)
COMPUTE @score  = ($q1 + $q2 + $q3) / 3
COMPUTE @net    = $revenue - $cost
COMPUTE @capped = min(100, max(0, $raw))      // clamp to 0..100
COMPUTE @idx    = round(($q1 + $q2) / 2)
COMPUTE @dist   = sqrt($x * $x + $y * $y)
COMPUTE @n_aware = count(@aware)              // #brands each respondent knows
```

The result is a numeric variable — tabulate it with `DISTRIBUTION` or summary stats
(`mean`, `std_dev`, …). Division by zero / nulls follow normal numeric rules
(infinity / null); guard inputs if that matters.

!!! tip "Average number of items picked in a multi-select"
    Both storage layouts end at `STATS mean`:

    ```mrs
    // Multiple-dichotomy (0/1 per item) — sum the flags:
    COMPUTE @n = $a1 + $a2 + $a3

    // Multiple-category ("spread") — SPREAD into a list, then count it:
    SPREAD @aware FROM $a1, $a2, $a3
    COMPUTE @n = count(@aware)

    TABLE 'Average items aware' STUBS @n STATS mean, n END TABLE
    ```
