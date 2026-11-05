from __future__ import annotations

from BackEnd.GameEngine.ConstraintChecker import ConstraintChecker
from BackEnd.GameEngine.GameObject.objects import PuzzleDefinition


def validate_puzzle(
    puzzle: PuzzleDefinition,
    checker: ConstraintChecker,
) -> None:
    """Check structure, solution uniqueness, and no-guessing progression."""
    raise NotImplementedError
