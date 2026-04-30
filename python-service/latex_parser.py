"""LaTeX → SymPy parsing wrapper.

`sympy.parsing.latex.parse_latex` requires the optional `antlr4-python3-runtime`
dependency. We catch every failure mode (parse errors, missing optional dep,
unsupported constructs) and raise a single `LatexParseError` so the FastAPI layer
can return a stable `unparseable` verdict.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sympy import Expr, sympify
from sympy.parsing.latex import parse_latex


class LatexParseError(Exception):
    """Raised when LaTeX cannot be turned into a SymPy expression."""


@dataclass
class ParsedExpression:
    expr: Expr
    original_latex: str


def parse_latex_safe(latex: str) -> ParsedExpression:
    """Parse LaTeX → SymPy. Raises LatexParseError on any failure."""
    if not latex or not latex.strip():
        raise LatexParseError("empty_input")

    cleaned = _preprocess(latex)
    try:
        expr = parse_latex(cleaned)
    except Exception as exc:  # SymPy raises a variety of exceptions here
        # Last-ditch fallback: try sympify on a hand-translated form.
        try:
            expr = sympify(_latex_to_sympy_fallback(cleaned))
        except Exception:  # noqa: BLE001
            raise LatexParseError(f"could_not_parse_latex: {exc}") from exc
    return ParsedExpression(expr=expr, original_latex=latex)


_COMMON_DEGREE_VALUES: dict[str, str] = {
    "0": "0",
    "30": "\\frac{\\pi}{6}",
    "45": "\\frac{\\pi}{4}",
    "60": "\\frac{\\pi}{3}",
    "90": "\\frac{\\pi}{2}",
    "120": "\\frac{2\\pi}{3}",
    "135": "\\frac{3\\pi}{4}",
    "150": "\\frac{5\\pi}{6}",
    "180": "\\pi",
    "270": "\\frac{3\\pi}{2}",
    "360": "2\\pi",
}


def _replace_degrees(s: str) -> str:
    """Replace n^\\circ with the exact radian value for common angles, or a
    simplified expression for arbitrary ones. parse_latex handles fractions
    much more reliably than \\cdot \\frac{...}{...} inside function arguments.
    """
    def _sub(m: re.Match) -> str:
        n = m.group(1).strip()
        if n in _COMMON_DEGREE_VALUES:
            return _COMMON_DEGREE_VALUES[n]
        return f"\\frac{{{n} \\pi}}{{180}}"

    # Match patterns like 30^{\circ} or 30^\circ
    s = re.sub(r"(\d+(?:\.\d+)?)\s*\^\{\\circ\}", _sub, s)
    s = re.sub(r"(\d+(?:\.\d+)?)\s*\^\\circ\b", _sub, s)
    return s


def _preprocess(latex: str) -> str:
    """Light cleanup before handing to parse_latex.

    - Strip enclosing $...$ delimiters
    - Replace n^\\circ degree markers with exact radian fractions
    - Strip \\text{...} wrappers (pure text annotations can't be parsed as math)
    - Strip trailing question marks (problem statement placeholders)
    - Normalize whitespace
    """
    s = latex.strip()
    if s.startswith("$") and s.endswith("$"):
        s = s[1:-1]
    s = _replace_degrees(s)
    # Remove \text{...} wrappers — keep their inner content where meaningful
    s = re.sub(r"\\text\{[^}]*\}", "", s)
    # Strip trailing = ? or ? that appears in problem statements
    s = re.sub(r"\s*=\s*\?$", "", s)
    s = re.sub(r"\s*\?$", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _latex_to_sympy_fallback(latex: str) -> str:
    """Fallback translator for common LaTeX patterns when ANTLR parse_latex fails.

    Handles fractions, roots, trig functions, Greek letters, and basic operators.
    Processes longest/most-specific patterns first to avoid partial substitutions.
    """
    s = latex
    # Multi-char sequences first
    replacements = [
        # Nested \frac with braces
        (r"\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}",
         r"((\1)/(\2))"),
        (r"\\sqrt\{([^{}]*)\}", r"sqrt(\1)"),
        # Trig functions
        (r"\\sin\^2", "sin**2"),
        (r"\\cos\^2", "cos**2"),
        (r"\\tan\^2", "tan**2"),
        (r"\\arcsin", "asin"),
        (r"\\arccos", "acos"),
        (r"\\arctan", "atan"),
        (r"\\sin", "sin"),
        (r"\\cos", "cos"),
        (r"\\tan", "tan"),
        # Greek / constants
        (r"\\theta", "theta"),
        (r"\\alpha", "alpha"),
        (r"\\beta", "beta"),
        (r"\\pi", "pi"),
        # Operators
        (r"\\cdot", "*"),
        (r"\\times", "*"),
        (r"\\left\(", "("),
        (r"\\right\)", ")"),
        (r"\\left", ""),
        (r"\\right", ""),
        # Superscripts
        (r"\^\{([^}]*)\}", r"**(\1)"),
        (r"\^(\w)", r"**\1"),
    ]
    for pattern, repl in replacements:
        s = re.sub(pattern, repl, s)
    return s.strip()
