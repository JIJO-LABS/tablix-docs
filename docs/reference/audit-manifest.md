# 17 · Audit Manifest

**`mrscript run --out-store DIR`** saves the produced `TableStore` and writes a
companion **`audit.json`** to the same directory, capturing everything needed to
understand or re-derive a tabulation run: script identity, data identity, git
context, runtime metadata, the effective configuration, and a run summary.

```
$ mrscript run survey.mrs --out-store runs/week12/
Produced 8 table(s). Store + audit written to runs/week12/

$ cat runs/week12/audit.json
{
  "audit_version": 1,
  "generated_at": "2026-06-21T09:14:02Z",
  "script": {
    "path": "/home/dp/survey.mrs",
    "sha256": "3a7b4ce1f8…"
  },
  "data": {
    "paths": ["/home/dp/data/survey.sav"],
    "sha256s": ["9f1d22ab7c…"]
  },
  "git": {
    "commit": "abc1234def…",
    "branch": "main",
    "dirty": false
  },
  "runtime": {
    "mrscript_version": "0.9.0",
    "python_version": "3.11.9",
    "platform": "win32",
    "timestamp": "2026-06-21T09:14:02Z"
  },
  "config": {
    "sig_confidence": [95.0],
    "sig_correction": "none",
    "sig_compare": "segment"
  },
  "run_summary": {
    "n_tables": 8,
    "n_warnings": 0,
    "tables": [
      {"number": 1, "title": "Overall Satisfaction", "name": null},
      {"number": 2, "title": "Gender", "name": null}
    ]
  }
}
```

---

## `--out-store DIR` flag

Both `mrscript run` and `mrscript export` accept `--out-store DIR`:

```
mrscript run survey.mrs --out-store runs/week12/
mrscript export survey.mrs report.csv --out-store runs/week12/
```

When given:

1. The produced `TableStore` is saved to `DIR` as `manifest.json` + `cells.parquet`
   (the existing `table_store_io` format).
2. `audit.json` is written to the same `DIR`.
3. A confirmation message is printed to stdout.

For `mrscript export`, `--out-store` is *additive*: the formatted output file
(CSV or Excel) is still written as usual, and the store + audit are also saved to
`DIR`. This lets you export a deliverable and keep a replayable snapshot in one
command.

Without `--out-store`, behaviour is unchanged — `mrscript run` prints text to
stdout, `mrscript export` writes the formatted file.

---

## `audit.json` schema

| Field | Type | Description |
|-------|------|-------------|
| `audit_version` | `int` | Schema version (currently `1`) |
| `generated_at` | `string` | UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) |
| `script.path` | `string \| null` | Absolute path of the `.mrs` file |
| `script.sha256` | `string \| null` | SHA-256 hex digest of the `.mrs` file |
| `data.paths` | `string[]` | Resolved source data file paths |
| `data.sha256s` | `(string \| null)[]` | SHA-256 hex digest per data file (null if unreadable) |
| `git.commit` | `string \| null` | HEAD commit SHA (full 40-char); null if not in a repo |
| `git.branch` | `string \| null` | Current branch name |
| `git.dirty` | `bool \| null` | True when working tree has uncommitted changes |
| `runtime.mrscript_version` | `string` | Installed `mrscript-core` package version |
| `runtime.python_version` | `string` | Python version (e.g. `"3.11.9"`) |
| `runtime.platform` | `string` | `sys.platform` (e.g. `"win32"`, `"linux"`) |
| `runtime.timestamp` | `string` | Same as `generated_at` (duplicated for convenience) |
| `config` | `object` | Effective `CONFIG` block values (see below) |
| `run_summary.n_tables` | `int` | Number of tables produced |
| `run_summary.n_warnings` | `int` | Number of non-fatal advisories emitted |
| `run_summary.tables` | `object[]` | Per-table `{number, title, name}` |

### `config` object

Contains only the keys that are explicitly set in the `CONFIG` block. Absent
keys mean the engine default is in effect. Possible keys:

| Key | Values | Engine default |
|-----|--------|----------------|
| `sig_confidence` | `float[]` (e.g. `[95.0]` or `[99.0, 95.0]` for dual-CL) | `[95.0]` |
| `sig_correction` | `"none"` / `"bonferroni"` | `"none"` |
| `sig_compare` | `"segment"` / `"all"` / `"total"` / `"prior"` | `"segment"` |
| `sig_paired` | `bool` (paired significance for repeated measures; recorded only when set) | `false` |
| `sig_letters` | `"global"` / `"per_segment"` (recorded only when set) | `"global"` |
| `sig_tails` | `1` / `2` (recorded only when set) | `2` |
| `sig_deff` | `float` ≥ 1.0, the design effect (recorded only when set) | `1.0` |
| `sig_mean_test` | `"exact_t"` / `"normal"` / `"pooled_t"` (recorded only when set) | `"exact_t"` |
| `sig_min_base` | `{n, effective, percent_only}` (the significance-only minimum base; recorded only when set) | *(none: `MIN_BASE` gates significance)* |
| `sig_markers` | `"letters"` / `"plus_minus"` (recorded only when set) | `"letters"` |
| `weighted_std_dev` | `"effective"` / `"sum_weights"` (the Std Dev / Std Error variance; recorded only when set) | `"effective"` |
| `output_format` | `"text"` / `"excel"` | `"text"` |
| `missing_treatment` | `"exclude"` / `"show"` | `"exclude"` |
| `default_stats` | `string[]` | *(the FORMAT STATS clause)* |
| `suppress_stacked_sig` | `bool` | `false` |
| `suppress_grid_sig` | `bool` | `false` |
| `suppress_wave_sig` | `bool` | `false` |

---

## Git context

Git context is collected **best-effort** via subprocess calls to `git log`,
`git branch --show-current`, and `git status --porcelain`. Any failure (git not
installed, not in a repo, timeout) sets the relevant field to `null` or omits the
`git` block entirely. An audit manifest write **never fails** due to git
unavailability.

`dirty: true` means there are uncommitted changes in the working tree (staged or
unstaged), which could mean the script or data file differs from the committed
version at `commit`.

---

## SHA-256 checksums

`script.sha256` is the SHA-256 hex digest of the `.mrs` file **as read off disk
before the run** (before any preprocessing or transpilation). If the script was
provided as inline text (no file path), this field is `null`.

`data.sha256s` is a parallel array to `data.paths`: SHA-256 hex digest of each
source data file. `null` when the file cannot be read (e.g. the path was a
network share that was unavailable at write time).

---

## Provenance header in `mrscript table-diff`

When both sides of a `table-diff` are saved-store directories that contain an
`audit.json`, the diff report includes a provenance header:

```
$ mrscript table-diff runs/week11/ runs/week12/

Provenance A:  script survey.mrs  sha 3a7b4ce1f8…  run 2026-06-14T08:22:11Z  git main@9ef0123
Provenance B:  script survey.mrs  sha 3a7b4ce1f8…  run 2026-06-21T09:14:02Z  git main@abc1234

Comparing: week11  (8 tables) → week12  (8 tables)

── TABLES ──────────────────────────────────────────────────
  (no table-level changes)
...
```

The provenance header is:
- Printed for each side that has an `audit.json` (partial: only one side shown if only
  one has audit data).
- Omitted entirely when neither side has an `audit.json` (no change to existing
  `table-diff` output).
- Never causes a diff to fail — a missing or unreadable `audit.json` is silently skipped.

---

## Worked example end-to-end

**Scenario:** A DP runs tabs on Monday, sends them to a client, receives a correction
request on Thursday, and needs to prove that only the expected cells changed.

```bash
# Monday run — save the store + audit for future reference
mrscript run survey.mrs --out-store archive/week22/

# Thursday: client asked to re-tab after fixing a MISSING code
#   Edit survey.mrs … add MISSING 99 to $q1 …
mrscript run survey.mrs --out-store archive/week22_v2/

# Compare the two runs
mrscript table-diff archive/week22/ archive/week22_v2/
```

Output:

```
Provenance A:  script survey.mrs  sha 9c3a7b…  run 2026-06-16T09:30:00Z  git main@f3a1b2c
Provenance B:  script survey.mrs  sha 4e1d0f…  run 2026-06-19T14:12:05Z  git main@0dc8e3f

Comparing: week22  (12 tables) → week22_v2  (12 tables)

── STRUCTURE ────────────────────────────────────────────────
  warn   Table 3 'Q1 Satisfaction' — Stub row '99 Don't know' removed

── CELL SHIFTS ──────────────────────────────────────────────
  warn   Table 3 'Q1 Satisfaction'  row 'Agree' / col 'Total'   col_pct: 34.0% → 36.0% (+2.0 pp)
  ...

1 warn(s)
```

The different `script.sha256` values (`9c3a7b…` vs `4e1d0f…`) confirm the script
changed between runs. The diff shows exactly what moved.

---

## Backward compatibility

`audit.json` is a **new peer file** alongside `manifest.json` / `cells.parquet`. It
is **optional**: `table_store_io.load()` never reads it and its absence never breaks
any existing command. Existing `mrscript table-diff` calls on saved stores without
`audit.json` work exactly as before (no provenance header is printed).
