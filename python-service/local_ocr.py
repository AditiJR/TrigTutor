"""Local OCR via pix2tex (LaTeX-OCR).

This module is OPTIONAL — pix2tex is a heavy dependency (PyTorch + weights)
that we don't want to force on users who only need SymPy validation.

Strategy:
    * The model is loaded lazily on first call.
    * If pix2tex isn't installed, `is_available()` returns False and the
      Next.js layer falls back to "manual entry" UI.
    * The model is cached in a process-level singleton so we only pay the
      load cost once per server lifetime.
"""

from __future__ import annotations

import io
import logging
import threading
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("local-ocr")

_MODEL = None
_MODEL_LOCK = threading.Lock()
_LOAD_FAILED = False


@dataclass
class OcrResult:
    latex: str
    confidence: float  # pix2tex doesn't expose a real confidence; we estimate
    raw_text: str


_IMPORT_ERROR: Optional[str] = None


def is_available() -> bool:
    """Cheap check: did pix2tex import successfully?

    On failure we cache the error message so it's visible at /health and in
    server logs, instead of silently disappearing.
    """
    global _IMPORT_ERROR
    if _LOAD_FAILED:
        return False
    try:
        import pix2tex.cli  # noqa: F401  (import probe)

        _IMPORT_ERROR = None
        return True
    except Exception as exc:  # pragma: no cover — environment-dependent
        msg = f"{type(exc).__name__}: {exc}"
        if msg != _IMPORT_ERROR:
            logger.warning("pix2tex import failed: %s", msg)
            _IMPORT_ERROR = msg
        return False


def get_import_error() -> Optional[str]:
    """Returns the last import error message, or None if pix2tex is loadable."""
    is_available()
    return _IMPORT_ERROR


def _load_model():
    """Load the pix2tex model on first use. Thread-safe singleton."""
    global _MODEL, _LOAD_FAILED
    if _MODEL is not None:
        return _MODEL
    if _LOAD_FAILED:
        raise RuntimeError("pix2tex_load_failed")

    with _MODEL_LOCK:
        if _MODEL is not None:
            return _MODEL
        try:
            from pix2tex.cli import LatexOCR  # type: ignore

            logger.info("Loading pix2tex LaTeX-OCR model (first call)…")
            _MODEL = LatexOCR()
            logger.info("pix2tex model loaded.")
        except Exception as exc:
            _LOAD_FAILED = True
            logger.exception("Failed to load pix2tex model: %s", exc)
            raise RuntimeError("pix2tex_load_failed") from exc
    return _MODEL


def run_ocr(image_bytes: bytes) -> Optional[OcrResult]:
    """Run pix2tex on image bytes. Returns None if pix2tex isn't available."""
    if not is_available():
        return None

    try:
        from PIL import Image  # type: ignore
    except ImportError:
        logger.warning("Pillow not installed; cannot run local OCR.")
        return None

    try:
        model = _load_model()
    except RuntimeError:
        return None

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        logger.warning("Could not decode uploaded image: %s", exc)
        return None

    try:
        latex = model(img)
    except Exception as exc:
        logger.exception("pix2tex inference failed: %s", exc)
        return None

    if not latex or not latex.strip():
        return OcrResult(latex="", confidence=0.0, raw_text="")

    stripped = latex.strip()

    # Quality gate: reject outputs that are clearly garbage.
    # pix2tex often emits long runs of \quad or \qquad (spacing tokens) when
    # given images it can't parse (e.g. full-page word problems with prose).
    if _is_garbage(stripped):
        logger.warning(
            "pix2tex returned low-quality output (spacing-only or too short) — discarding."
        )
        return OcrResult(latex="", confidence=0.0, raw_text=stripped)

    # pix2tex doesn't return a confidence — we approximate based on output
    # length and the presence of meaningful LaTeX command tokens.
    has_command = "\\" in stripped
    estimated_confidence = 0.85 if (len(stripped) > 5 and has_command) else 0.6

    return OcrResult(
        latex=stripped,
        confidence=estimated_confidence,
        raw_text=stripped,
    )


# Commands that are spacing/formatting only — no mathematical content.
_SPACING_ONLY_COMMANDS = {
    r"\quad", r"\qquad", r"\,", r"\;", r"\:", r"\!", r"\ ",
    r"\hspace", r"\vspace", r"\hfill", r"\newline", r"\\",
}


def _is_garbage(latex: str) -> bool:
    """Return True if the LaTeX string has no meaningful math content."""
    # Too short to be useful
    if len(latex) < 3:
        return True

    # Strip all spacing-only tokens and see what's left
    test = latex
    for tok in _SPACING_ONLY_COMMANDS:
        test = test.replace(tok, " ")
    test = test.strip()

    # If nothing meaningful remains, it's garbage
    if not test or all(c in " {}" for c in test):
        return True

    # If > 80% of the original tokens are spacing commands it's likely garbage
    tokens = latex.split()
    spacing_count = sum(
        1 for t in tokens
        if any(t.startswith(cmd) for cmd in _SPACING_ONLY_COMMANDS)
    )
    if tokens and spacing_count / len(tokens) > 0.8:
        return True

    return False
