"""FastAPI entrypoint for the SymPy validation sidecar.

This service is the source of truth for math correctness in the Trig Tutor app.
The Next.js layer NEVER decides correctness; it forwards the student's step here,
takes the verdict, and only then asks Claude to phrase a Socratic hint.

Endpoints:
    POST /validate    - full validation flow against canonical solution steps
    POST /equivalent  - check if two LaTeX expressions are mathematically equal
    POST /simplify    - return the simplest form of a LaTeX expression
    GET  /health      - liveness probe
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from latex_parser import LatexParseError, parse_latex_safe
from trig_validator import (
    EquivalenceResult,
    SimplifyResult,
    ValidationVerdict,
    check_equivalent,
    simplify_expression,
    validate_step,
)

logger = logging.getLogger("trig-validator")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Trig Tutor — SymPy validator", version="0.1.0")

EXPECTED_TOKEN = os.environ.get("PYTHON_SERVICE_TOKEN")


def _check_token(x_service_token: Optional[str]) -> None:
    if EXPECTED_TOKEN and x_service_token != EXPECTED_TOKEN:
        raise HTTPException(status_code=401, detail="invalid_service_token")


class CanonicalStepIn(BaseModel):
    index: int
    description: str
    expected_expression: str
    concept_tag: str
    acceptable_forms: List[str] = Field(default_factory=list)


class ValidateRequest(BaseModel):
    previous_latex: str
    new_step_latex: str
    expected_final: str
    canonical_steps: List[CanonicalStepIn] = Field(default_factory=list)


class ValidateResponse(BaseModel):
    status: str
    matched_canonical_step: Optional[int] = None
    detected_concept: Optional[str] = None
    symbolic_form: str
    reason: str


class EquivalentRequest(BaseModel):
    a: str
    b: str


class EquivalentResponse(BaseModel):
    equivalent: bool
    reason: str


class SimplifyRequest(BaseModel):
    latex: str


class SimplifyResponse(BaseModel):
    simplified: str
    latex: str


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "trig-validator"}


@app.post("/validate", response_model=ValidateResponse)
def validate(
    body: ValidateRequest,
    x_service_token: Optional[str] = Header(default=None, alias="X-Service-Token"),
) -> ValidateResponse:
    _check_token(x_service_token)
    try:
        verdict: ValidationVerdict = validate_step(
            previous_latex=body.previous_latex,
            new_step_latex=body.new_step_latex,
            expected_final=body.expected_final,
            canonical_steps=[s.model_dump() for s in body.canonical_steps],
        )
    except LatexParseError as exc:
        logger.info("Unparseable input: %s", exc)
        return ValidateResponse(
            status="unparseable",
            matched_canonical_step=None,
            detected_concept=None,
            symbolic_form="",
            reason=str(exc),
        )

    return ValidateResponse(
        status=verdict.status,
        matched_canonical_step=verdict.matched_canonical_step,
        detected_concept=verdict.detected_concept,
        symbolic_form=verdict.symbolic_form,
        reason=verdict.reason,
    )


@app.post("/equivalent", response_model=EquivalentResponse)
def equivalent(
    body: EquivalentRequest,
    x_service_token: Optional[str] = Header(default=None, alias="X-Service-Token"),
) -> EquivalentResponse:
    _check_token(x_service_token)
    try:
        result: EquivalenceResult = check_equivalent(body.a, body.b)
    except LatexParseError as exc:
        return EquivalentResponse(equivalent=False, reason=f"unparseable: {exc}")
    return EquivalentResponse(equivalent=result.equivalent, reason=result.reason)


@app.post("/simplify", response_model=SimplifyResponse)
def simplify(
    body: SimplifyRequest,
    x_service_token: Optional[str] = Header(default=None, alias="X-Service-Token"),
) -> SimplifyResponse:
    _check_token(x_service_token)
    try:
        result: SimplifyResult = simplify_expression(body.latex)
    except LatexParseError as exc:
        raise HTTPException(status_code=400, detail=f"unparseable: {exc}") from exc
    return SimplifyResponse(simplified=result.simplified_str, latex=result.simplified_latex)


# Convenience: allow `python main.py` to run uvicorn directly in dev.
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
