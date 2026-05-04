"""Trig-specific validation logic.

The validation algorithm (per CLAUDE.md):

    1. Parse `previous_latex` and `new_step_latex` to SymPy.
    2. If `simplify(previous - new)` is zero  → valid identity transformation → correct.
    3. Else if new matches a canonical step's expected expression → correct (different path).
    4. Else if new is the final answer → correct.
    5. Else → incorrect; run heuristics to attach a `reason` tag.

Always use `trigsimp()` for trig identity recognition, never plain `simplify()`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

import sympy
from sympy import Expr, latex as sympy_latex, simplify, trigsimp
from sympy.core.relational import Relational

from latex_parser import LatexParseError, parse_latex_safe


@dataclass
class ValidationVerdict:
    status: str  # 'correct' | 'incorrect' | 'unparseable' | 'equivalent_to_earlier'
    matched_canonical_step: Optional[int]
    detected_concept: Optional[str]
    symbolic_form: str
    reason: str
    # New currentStepIndex after applying this verdict. Equals the request's
    # current_step_index when no advance happened.
    advance_to: int = 0
    # Canonical indices the student skipped but we credit as completed.
    skipped_steps: Optional[list] = None


@dataclass
class EquivalenceResult:
    equivalent: bool
    reason: str


@dataclass
class SimplifyResult:
    simplified_str: str
    simplified_latex: str


def validate_step(
    *,
    previous_latex: str,
    new_step_latex: str,
    expected_final: str,
    canonical_steps: Iterable[dict],
    current_step_index: int = 0,
) -> ValidationVerdict:
    new_parsed = parse_latex_safe(new_step_latex)
    new_expr = new_parsed.expr
    symbolic_form = _to_sympy_repr(new_expr)

    canonical_list = list(canonical_steps)
    has_canonical = len(canonical_list) > 0
    has_final = bool(expected_final.strip())
    n_total = len(canonical_list)

    # Clamp pointer defensively.
    cur_idx = max(0, min(int(current_step_index), n_total))

    # ─── Step-machine path: we have canonical steps to anchor against ──────
    if has_canonical:
        # 1. Try the current target step first (fast path).
        if cur_idx < n_total:
            target = canonical_list[cur_idx]
            if _matches_canonical_entry(new_expr, target):
                return ValidationVerdict(
                    status="correct",
                    matched_canonical_step=target.get("index", cur_idx),
                    detected_concept=target.get("concept_tag"),
                    symbolic_form=symbolic_form,
                    reason="matched_current_step",
                    advance_to=cur_idx + 1,
                    skipped_steps=[],
                )

        # 2. Scan forward for skip-ahead. Match the *furthest* future step the
        #    student's expression satisfies — that maximizes credit while
        #    keeping the pointer monotonic.
        matched_future: Optional[int] = None
        matched_concept: Optional[str] = None
        for j in range(cur_idx + 1, n_total):
            entry = canonical_list[j]
            if _matches_canonical_entry(new_expr, entry):
                matched_future = j
                matched_concept = entry.get("concept_tag")

        if matched_future is not None:
            if not _forward_skip_derivable(
                previous_latex,
                new_expr,
                cur_idx,
                matched_future,
            ):
                target_concept = (
                    canonical_list[cur_idx].get("concept_tag")
                    if cur_idx < n_total
                    else None
                )
                return ValidationVerdict(
                    status="incorrect",
                    matched_canonical_step=None,
                    detected_concept=target_concept,
                    symbolic_form=symbolic_form,
                    reason="skip_not_derivable",
                    advance_to=cur_idx,
                    skipped_steps=[],
                )
            skipped = list(range(cur_idx, matched_future))
            return ValidationVerdict(
                status="correct",
                matched_canonical_step=canonical_list[matched_future].get(
                    "index", matched_future
                ),
                detected_concept=matched_concept,
                symbolic_form=symbolic_form,
                reason="matched_future_step",
                advance_to=matched_future + 1,
                skipped_steps=skipped,
            )

        # 3. Match against the final answer → solve everything.
        if has_final:
            try:
                final_expr = parse_latex_safe(expected_final).expr
                if _expressions_equivalent(new_expr, final_expr):
                    skipped = list(range(cur_idx, n_total))
                    return ValidationVerdict(
                        status="correct",
                        matched_canonical_step=None,
                        detected_concept="final_answer",
                        symbolic_form=symbolic_form,
                        reason="matched_final_answer",
                        advance_to=n_total,
                        skipped_steps=skipped,
                    )
            except LatexParseError:
                pass

        # 4. Identity-preserving rewrite of previous_latex against the *current*
        #    target — accept as a stylistic step that doesn't actually advance.
        #    Mark equivalent_to_earlier so the hint nudges them onward.
        if previous_latex.strip():
            try:
                prev_expr = parse_latex_safe(previous_latex).expr
                if _expressions_equivalent(prev_expr, new_expr):
                    return ValidationVerdict(
                        status="equivalent_to_earlier",
                        matched_canonical_step=None,
                        detected_concept=None,
                        symbolic_form=symbolic_form,
                        reason="restated_previous",
                        advance_to=cur_idx,
                        skipped_steps=[],
                    )
            except LatexParseError:
                pass

        # 5. Incorrect — heuristic reason against the *current* target.
        target_for_diag = (
            [canonical_list[cur_idx]] if cur_idx < n_total else canonical_list
        )
        reason = _diagnose_incorrect(new_expr, target_for_diag)
        target_concept = (
            canonical_list[cur_idx].get("concept_tag")
            if cur_idx < n_total
            else None
        )
        return ValidationVerdict(
            status="incorrect",
            matched_canonical_step=None,
            detected_concept=target_concept,
            symbolic_form=symbolic_form,
            reason=reason,
            advance_to=cur_idx,
            skipped_steps=[],
        )

    # ─── Lenient mode (no canonical steps; OCR-imported problems) ─────────
    # 1. Final-answer match → solve.
    if has_final:
        try:
            final_expr = parse_latex_safe(expected_final).expr
            if _expressions_equivalent(new_expr, final_expr):
                return ValidationVerdict(
                    status="correct",
                    matched_canonical_step=None,
                    detected_concept="final_answer",
                    symbolic_form=symbolic_form,
                    reason="matched_final_answer",
                    advance_to=1,
                    skipped_steps=[],
                )
        except LatexParseError:
            pass

    # 2. No canonical and no final — accept anything with math substance.
    if not has_canonical and not has_final:
        if not _has_math_substance(new_expr):
            return ValidationVerdict(
                status="unparseable",
                matched_canonical_step=None,
                detected_concept=None,
                symbolic_form=symbolic_form,
                reason="no_mathematical_content",
                advance_to=cur_idx,
                skipped_steps=[],
            )
        return ValidationVerdict(
            status="correct",
            matched_canonical_step=None,
            detected_concept="exploratory",
            symbolic_form=symbolic_form,
            reason="exploratory_no_canonical_reference",
            # Stay on the single placeholder step — open-ended OCR has no target
            # index to advance toward; solved is driven by finalAnswer when present.
            advance_to=cur_idx,
            skipped_steps=[],
        )

    # 3. Has final but didn't match → incorrect.
    return ValidationVerdict(
        status="incorrect",
        matched_canonical_step=None,
        detected_concept=None,
        symbolic_form=symbolic_form,
        reason="did_not_match_final_answer",
        advance_to=cur_idx,
        skipped_steps=[],
    )


def _matches_canonical_entry(new_expr, entry: dict) -> bool:
    """True if `new_expr` is symbolically equivalent to the entry's expected
    expression OR any of its acceptable_forms."""
    try:
        expected = parse_latex_safe(entry["expected_expression"]).expr
        if _expressions_equivalent(new_expr, expected):
            return True
    except LatexParseError:
        pass
    for form in entry.get("acceptable_forms", []) or []:
        try:
            alt = parse_latex_safe(form).expr
        except LatexParseError:
            continue
        if _expressions_equivalent(new_expr, alt):
            return True
    return False


def check_equivalent(latex_a: str, latex_b: str) -> EquivalenceResult:
    a = parse_latex_safe(latex_a).expr
    b = parse_latex_safe(latex_b).expr
    if _expressions_equivalent(a, b):
        return EquivalenceResult(equivalent=True, reason="trigsimp_match")
    return EquivalenceResult(equivalent=False, reason="not_equivalent_under_trigsimp")


def simplify_expression(latex: str) -> SimplifyResult:
    expr = parse_latex_safe(latex).expr
    simplified = trigsimp(simplify(expr))
    return SimplifyResult(
        simplified_str=str(simplified),
        simplified_latex=sympy_latex(simplified),
    )


def _expressions_equivalent(a: Expr, b: Expr) -> bool:
    """Robust equality: handles equations and trig identities.

    For two SymPy `Eq` instances, equate left-right differences.
    For non-Eq expressions, check that `trigsimp(simplify(a - b))` collapses to zero.
    """
    if isinstance(a, Relational) and isinstance(b, Relational):
        # Treat equations as normalized "lhs - rhs" expressions so equivalent
        # rearrangements are accepted (e.g., sin²+cos²=1 and cos²=1-sin²).
        return _difference_is_zero((a.lhs - a.rhs) - (b.lhs - b.rhs))
    if isinstance(a, Relational) or isinstance(b, Relational):
        # Compare an equation to a bare expression by normalizing equation to lhs-rhs.
        eq, bare = (a, b) if isinstance(a, Relational) else (b, a)
        return _difference_is_zero((eq.lhs - eq.rhs) - bare)
    try:
        return _difference_is_zero(a - b)
    except Exception:  # noqa: BLE001
        return False


def _classify_against_canonical(
    new_expr: Expr, canonical_steps: Iterable[dict]
) -> tuple[Optional[str], Optional[int]]:
    """Returns (concept_tag, matched_step_index) or (None, None)."""
    for step in canonical_steps:
        try:
            expected = parse_latex_safe(step["expected_expression"]).expr
        except LatexParseError:
            continue
        if _expressions_equivalent(new_expr, expected):
            return step.get("concept_tag"), step.get("index")
        for form in step.get("acceptable_forms", []) or []:
            try:
                alt = parse_latex_safe(form).expr
            except LatexParseError:
                continue
            if _expressions_equivalent(new_expr, alt):
                return step.get("concept_tag"), step.get("index")
    return None, None


def _diagnose_incorrect(new_expr: Expr, canonical_steps: Iterable[dict]) -> str:
    """Heuristic reason tags for incorrect steps.

    TODO: expand this — common patterns to detect:
      - sign_error (a == -b under simplify)
      - off_by_factor (ratio is a small rational)
      - swapped_sin_cos
      - missing_squared
      - degrees_vs_radians_mismatch
    """
    for step in canonical_steps:
        try:
            expected = parse_latex_safe(step["expected_expression"]).expr
        except LatexParseError:
            continue
        try:
            er = _algebraic_residual(new_expr)
            xr = _algebraic_residual(expected)
            if _difference_is_zero(er + xr):
                return "sign_error"
            if _sin_cos_swapped(new_expr, expected):
                return "swapped_sin_cos"
            if _missing_squared_term(new_expr, expected):
                return "missing_exponent"
        except Exception:  # noqa: BLE001
            continue
    return "did_not_match_any_canonical_step"


def _to_sympy_repr(expr: Expr) -> str:
    try:
        return sympy.srepr(expr)
    except Exception:  # noqa: BLE001
        return str(expr)


def _difference_is_zero(diff: Expr) -> bool:
    try:
        return trigsimp(simplify(diff)) == 0
    except Exception:  # noqa: BLE001
        return False


def _algebraic_residual(expr: Expr) -> Expr:
    """Map equations to a single expression so Eq − Eq is defined (lhs−rhs form).

    SymPy does not define subtraction between two Relational objects; normalize
    first so difference checks match `_expressions_equivalent` behavior.
    """
    if isinstance(expr, Relational):
        return expr.lhs - expr.rhs
    return expr


def _residual_difference_is_zero(a: Expr, b: Expr) -> bool:
    """True if `a` and `b` differ only by an identity after normalization."""
    try:
        return _difference_is_zero(_algebraic_residual(a) - _algebraic_residual(b))
    except Exception:  # noqa: BLE001
        return False


def _forward_skip_derivable(
    previous_latex: str,
    new_expr: Expr,
    cur_idx: int,
    matched_future: int,
) -> bool:
    """Reject obvious 'paste a later step' leaps that share nothing with prior work.

    Single-step skip-ahead (matched_future == cur_idx + 1) is always allowed.
    For larger gaps, require either an explicit algebraic link to previous_latex
    or overlapping structure (symbols / function heads) so unrelated matches are
    less likely to receive credit.
    """
    gap = matched_future - cur_idx
    if gap < 2:
        return True
    if not previous_latex.strip():
        return True
    try:
        prev_expr = parse_latex_safe(previous_latex).expr
    except LatexParseError:
        return True
    if _expressions_equivalent(prev_expr, new_expr):
        # Same statement as before — not a suspicious pasted leap.
        return True
    if _residual_difference_is_zero(new_expr, prev_expr):
        return True
    return _leap_shares_structure(prev_expr, new_expr)


def _leap_shares_structure(prev: Expr, new: Expr) -> bool:
    """True when new_expr plausibly continues from prev (shared symbols or trig)."""
    try:
        pfs = prev.free_symbols
        nfs = new.free_symbols
        if pfs and nfs and (pfs & nfs):
            return True
        prev_funcs: set = set()
        new_funcs: set = set()
        for node in sympy.preorder_traversal(prev):
            if isinstance(node, sympy.Function):
                prev_funcs.add(node.func)
        for node in sympy.preorder_traversal(new):
            if isinstance(node, sympy.Function):
                new_funcs.add(node.func)
        return bool(prev_funcs & new_funcs)
    except Exception:  # noqa: BLE001
        return True


def _sin_cos_swapped(a: Expr, b: Expr) -> bool:
    try:
        temp_fn = sympy.Function("__tmp_trig__")
        a_swapped = a.replace(
            lambda expr: isinstance(expr, Expr) and expr.func == sympy.sin,
            lambda expr: temp_fn(expr.args[0]),
        )
        a_swapped = a_swapped.replace(
            lambda expr: isinstance(expr, Expr) and expr.func == sympy.cos,
            lambda expr: sympy.sin(expr.args[0]),
        )
        a_swapped = a_swapped.replace(
            lambda expr: isinstance(expr, Expr) and expr.func == temp_fn,
            lambda expr: sympy.cos(expr.args[0]),
        )
        return _difference_is_zero(
            _algebraic_residual(a_swapped) - _algebraic_residual(b)
        )
    except Exception:  # noqa: BLE001
        return False


def _missing_squared_term(a: Expr, b: Expr) -> bool:
    a_sq = _count_squared_trig_terms(a)
    b_sq = _count_squared_trig_terms(b)
    return (a_sq > 0 and b_sq == 0) or (b_sq > 0 and a_sq == 0)


def _count_squared_trig_terms(expr: Expr) -> int:
    count = 0
    for node in sympy.preorder_traversal(expr):
        if isinstance(node, sympy.Pow) and node.exp == 2:
            base = node.base
            if isinstance(base, Expr) and base.func in (sympy.sin, sympy.cos, sympy.tan):
                count += 1
    return count


# Known variable names that are acceptable on their own in trig problems.
_KNOWN_VARS = {
    "x", "y", "z", "t", "n", "k", "a", "b", "c", "h", "r",
    "theta", "phi", "alpha", "beta", "gamma", "omega",
}

# SymPy applied-function base classes for trig/math functions.
_TRIG_FN_CLASSES = (
    sympy.sin, sympy.cos, sympy.tan,
    sympy.asin, sympy.acos, sympy.atan,
    sympy.csc, sympy.sec, sympy.cot,
    sympy.log, sympy.exp,
)


def _has_math_substance(expr: Expr) -> bool:
    """Return True if the expression has real mathematical content.

    Rejects expressions that consist solely of unknown multi-character symbols
    (e.g. 'totheID') with no numbers or trig functions.
    """
    for node in sympy.preorder_traversal(expr):
        # Any numeric literal or constant (pi, E, etc.) → substance
        if isinstance(node, (sympy.Number, sympy.NumberSymbol)):
            return True
        # Any trig / log / exp function call → substance
        if isinstance(node, _TRIG_FN_CLASSES):
            return True
        # Sqrt shows up as Pow with exponent 1/2
        if (
            isinstance(node, sympy.Pow)
            and node.exp == sympy.Rational(1, 2)
        ):
            return True

    # Expression is purely symbolic — allow only known / short variable names.
    for sym in expr.free_symbols:
        name = str(sym).lower()
        if len(name) > 3 and name not in _KNOWN_VARS:
            # Multi-character unknown symbol → likely garbage input
            return False

    return bool(expr.free_symbols)
