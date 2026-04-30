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
) -> ValidationVerdict:
    new_parsed = parse_latex_safe(new_step_latex)
    new_expr = new_parsed.expr
    symbolic_form = _to_sympy_repr(new_expr)

    canonical_list = list(canonical_steps)
    has_canonical = len(canonical_list) > 0
    has_final = bool(expected_final.strip())

    # 1. Identity-preserving transformation from the previous step?
    if previous_latex.strip():
        try:
            prev_expr = parse_latex_safe(previous_latex).expr
            if _expressions_equivalent(prev_expr, new_expr):
                concept, matched_idx = _classify_against_canonical(new_expr, canonical_list)
                return ValidationVerdict(
                    status="correct",
                    matched_canonical_step=matched_idx,
                    detected_concept=concept,
                    symbolic_form=symbolic_form,
                    reason="valid_algebraic_transformation",
                )
        except LatexParseError:
            # If we can't parse the previous step we can still check canonical/final match.
            pass

    # 2. Match against any canonical expected expression.
    concept, matched_idx = _classify_against_canonical(new_expr, canonical_list)
    if matched_idx is not None:
        return ValidationVerdict(
            status="correct",
            matched_canonical_step=matched_idx,
            detected_concept=concept,
            symbolic_form=symbolic_form,
            reason="matched_canonical_step",
        )

    # 3. Match against the final answer.
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
                )
        except LatexParseError:
            pass

    # 4. Lenient mode for unscaffolded problems: if there's no canonical solution
    #    AND no expected final answer (e.g. OCR-imported user problems), we have
    #    nothing to compare against. Anything that parses is accepted as a
    #    "valid expression" so the student isn't met with a wall of red lights.
    if not has_canonical and not has_final:
        return ValidationVerdict(
            status="correct",
            matched_canonical_step=None,
            detected_concept="exploratory",
            symbolic_form=symbolic_form,
            reason="exploratory_no_canonical_reference",
        )

    # 5. Otherwise, incorrect — attach a heuristic reason.
    reason = _diagnose_incorrect(new_expr, canonical_list)
    return ValidationVerdict(
        status="incorrect",
        matched_canonical_step=None,
        detected_concept=concept,
        symbolic_form=symbolic_form,
        reason=reason,
    )


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
            if _difference_is_zero(new_expr + expected):
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
        return _difference_is_zero(a_swapped - b)
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
