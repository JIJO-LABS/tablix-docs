/*
 * MRScript language definition for highlight.js, plus Material-aware (re)highlighting.
 *
 * Why this file exists: MRScript is a custom DSL, so no off-the-shelf highlighter
 * knows it. We register a minimal grammar (keywords, $/@/% variables, strings,
 * comments, numbers) and re-run highlight.js on every page navigation — Material's
 * instant-loading swaps the DOM without a full reload, so we hook `document$`.
 *
 * Token COLOURS live in stylesheets/extra.css (only a handful of .hljs-* classes are
 * styled, so anything we don't tokenise simply inherits Material's default code colour
 * and nothing clashes with the theme palette).
 */
(function () {
  function defineMRScript(hljs) {
    const KEYWORDS = {
      keyword: [
        // top-level statements / blocks
        "SOURCE", "APPEND", "JOIN", "MERGE", "WITH", "ON", "TYPE", "PREFIX", "KEY",
        "CONFIG", "FORMAT", "VARIABLE", "DERIVE", "STACK", "SPREAD",
        "EDIT", "RECODE", "COMPUTE", "BANNER", "TABLE", "SCOPE",
        "EXPORT", "DATA", "SCHEMA", "CODEBOOK",
        // AGGREGATE — roll exposure/diary rows up to respondent level
        // (the uppercase aggregate functions are keyworded; the lowercase
        // STAT/COMPUTE `sum`/`mean`/`min`/`max` stay un-keyworded as before)
        "AGGREGATE", "TO", "SUM", "COUNT", "MEAN", "MIN", "MAX", "FIRST", "LAST",
        // block closers
        "END", "ENDNET", "ENDHEADING", "ENDSCOPE",
        // structure
        "STUB", "NET", "HEADING", "MAP", "FROM", "POSITIONS", "CODES",
        "AXIS", "AT", "COLUMN", "SECTION", "STUBS", "DISTRIBUTION", "ADD",
        // cross-table operations
        "ADDTAB", "BANKED_TABLE", "MANIP", "INDEX", "SHARE", "NAME", "TITLE",
        // auto-tabulation from codebook
        "AUTOTAB", "VARS", "LIKE", "EXCLUDE",
        // table / variable clauses
        "STATS", "LEVEL", "BASE", "FILTER", "WEIGHT", "SHEET", "LABEL",
        "VALUE", "MISSING", "SCORE", "POSITIONS", "INTO", "ELSE", "SET",
        "KEEP", "DROP", "ROWS", "EMPTY", "SHOW_TOTAL", "STATS_ONLY",
        "ANSWERED_BASE", "DISPLAY", "SUPPRESS", "CUMULATIVE", "DECIMALS",
        "KEEP_IF_ZERO", "GRID", "DEFINE", "CALL",
        // summary / top-box battery tables
        "SUMMARY", "STATEMENTS", "MEASURE", "TOP", "BOTTOM", "SCALE",
        // TURF analysis (lowercase metric/method values stay un-keyworded)
        "TURF", "ITEMS", "SIZE", "REPORT", "METHOD",
        // CONFIG / FORMAT directives
        "OUTPUT", "SIG_CONFIDENCE", "SIG_CORRECTION", "SIG_COMPARE",
        "SIG_TAILS", "SIG_MEAN_TEST", "SIG_DEFF",
        "MISSING_TREATMENT", "DEFAULT_STATS", "SUPPRESS_STACKED_SIG",
        "SUPPRESS_GRID_SIG", "SUPPRESS_WAVE_SIG", "BASE_LABEL", "FOOTER",
        "THOUSANDS_SEPARATOR",
        "MIN_BASE", "MASK", "CONFIDENTIAL", "BLANK_SUPPRESS", "SUPPRESS_EMPTY",
        "AUTONUMBER", "RANKING", "SORT", "ASC", "DESC", "TOTAL",
        "MAX_COL_WIDTH", "PCT_SIGN", "PCT_DECIMALS",
        "COUNT_DECIMALS", "MEAN_DECIMALS",
        // NPS (Net Promoter Score) band override + decimals (the `nps` STATS value
        // is lowercase, so — like `mean`/`median` — it is not keyworded)
        "NPS", "NPS_DECIMALS", "PROMOTERS", "DETRACTORS",
        // RIM weighting
        "RIM", "DIMENSION", "TARGETS", "MAX_ITERATIONS", "CONVERGENCE",
        "WEIGHT_CAP", "BASE_WEIGHT",
        // routing assertions
        "EXPECT", "ANSWERED",
        // condition operators / values
        "WHERE", "AND", "OR", "NOT", "IN", "BETWEEN", "ALL",
        "respondents",
      ].join(" "),
      literal: "true false NULL",
      built_in: "round abs sqrt min max count",
    };

    return {
      name: "MRScript",
      aliases: ["mrs", "mrscript", "mrst"],
      case_insensitive: false,
      keywords: KEYWORDS,
      contains: [
        hljs.COMMENT("//", "$"),
        hljs.COMMENT("/\\*", "\\*/"),
        // strings
        { className: "string", begin: "'", end: "'" },
        { className: "string", begin: '"', end: '"' },
        // source / derived / reserved variables  ($var  @var  %RESPID)
        { className: "variable", begin: /[$@%][A-Za-z_][A-Za-z0-9_]*/ },
        // authoring-layer directives (#for, #if, ...) and interpolation {name}
        { className: "meta", begin: /^\s*#[A-Za-z]+/ },
        { className: "subst", begin: /\{/, end: /\}/ },
        // numbers
        { className: "number", begin: /\b\d+(\.\d+)?\b/ },
        // arrow used in RECODE
        { className: "operator", begin: /->/ },
      ],
    };
  }

  function ready(hljs) {
    if (!hljs) return;
    try {
      hljs.registerLanguage("mrscript", defineMRScript);
      hljs.registerAliases(["mrs", "mrst"], { languageName: "mrscript" });
    } catch (e) {
      /* already registered on a previous navigation — ignore */
    }
  }

  function highlightAll() {
    if (typeof hljs === "undefined") return;
    document.querySelectorAll("pre code").forEach(function (el) {
      if (!el.dataset.highlighted) {
        hljs.highlightElement(el);
      }
    });
  }

  // Register once the highlight.js bundle is present.
  ready(typeof hljs !== "undefined" ? hljs : null);

  // Material exposes `document$` (an RxJS subject) that fires on every page load
  // AND every instant-navigation swap. Fall back to DOMContentLoaded if absent.
  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(function () {
      ready(typeof hljs !== "undefined" ? hljs : null);
      highlightAll();
    });
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      ready(typeof hljs !== "undefined" ? hljs : null);
      highlightAll();
    });
  }
})();
