from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from BackEnd.GameEngine.ConstraintChecker import ConstraintChecker
from BackEnd.GameEngine.GameObject.objects import PuzzleDefinition, Verdict
from BackEnd.GameEngine.GameState import GameState, PublicState


class SubmitOutcome(Enum):
    ACCEPTED = "ACCEPTED"
    NOT_PROVABLE = "NOT_PROVABLE"
    CONTRADICTED = "CONTRADICTED"
    ALREADY_PROVED = "ALREADY_PROVED"
    INVALID_CELL = "INVALID_CELL"


@dataclass(frozen=True)
class SubmitResult:
    verdict: Verdict
    outcome: SubmitOutcome
    public_state: PublicState


class GameEngine:
    _puzzle: PuzzleDefinition
    _checker: ConstraintChecker
    _state: GameState

    def __init__(
        self,
        puzzle: PuzzleDefinition,
        checker: ConstraintChecker,
    ):
        raise NotImplementedError

    def get_public_state(self) -> PublicState:
        """Return a detached, read-only snapshot of public information."""
        raise NotImplementedError

    def submit_verdict(self, cell_id: int, status: bool) -> SubmitResult:
        """Accept only a verdict forced by the current public information."""
        raise NotImplementedError

    def restart(self) -> PublicState:
        """Restore the puzzle's initial verdicts and visible clues."""
        raise NotImplementedError
