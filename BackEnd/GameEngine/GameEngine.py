from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from types import MappingProxyType

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
        self._puzzle = puzzle
        self._checker = checker
        self._cell_ids = frozenset(
            cell.id for row in puzzle.board.cells for cell in row
        )
        self._state = self._initial_state()

    def get_public_state(self) -> PublicState:
        """Return a detached, read-only snapshot of public information."""
        revealed = tuple(
            clue
            for clue in self._puzzle.clues
            if clue.source_cell_id is None
            or clue.id in self._state.revealed_clue_ids
        )
        return PublicState(
            puzzle_id=self._puzzle.id,
            board=self._puzzle.board,
            revealed_clues=revealed,
            # Copy, then wrap: later moves do not change this snapshot, and
            # callers cannot write back into it.
            proved_statuses=MappingProxyType(dict(self._state.proved_statuses)),
        )

    def submit_verdict(self, cell_id: int, status: bool) -> SubmitResult:
        """Accept only a verdict forced by the current public information.

        - INVALID_CELL: `cell_id` is not on the board.
        - ALREADY_PROVED: the cell already has a proved verdict.
        - CONTRADICTED: no solution of the public clues has `status` here.
        - NOT_PROVABLE: both `status` and its opposite are still possible.
        - ACCEPTED: only `status` is possible; the verdict is recorded and
          the clues attached to this cell are revealed.
        Only ACCEPTED changes the game state.
        """
        verdict = Verdict(cell_id, status)
        public_state = self.get_public_state()

        if not self._cell_exists(cell_id):
            return SubmitResult(verdict, SubmitOutcome.INVALID_CELL, public_state)
        if cell_id in self._state.proved_statuses:
            return SubmitResult(verdict, SubmitOutcome.ALREADY_PROVED, public_state)

        if not self._checker.has_solution(public_state, verdict):
            return SubmitResult(verdict, SubmitOutcome.CONTRADICTED, public_state)
        if self._checker.has_solution(public_state, Verdict(cell_id, not status)):
            return SubmitResult(verdict, SubmitOutcome.NOT_PROVABLE, public_state)

        self._prove(cell_id, status)
        return SubmitResult(verdict, SubmitOutcome.ACCEPTED, self.get_public_state())

    def restart(self) -> PublicState:
        """Restore the puzzle's initial verdicts and visible clues."""
        self._state = self._initial_state()
        return self.get_public_state()

    # ---- internal helpers -------------------------------------------------

    def _cell_exists(self, cell_id: int) -> bool:
        return cell_id in self._cell_ids

    def _initial_state(self) -> GameState:
        """Initial verdicts count as proved, so their clues start revealed."""
        state = GameState()
        for verdict in self._puzzle.initial_verdicts:
            self._apply_proof(state, verdict.cell_id, verdict.is_criminal)
        return state

    def _prove(self, cell_id: int, status: bool) -> None:
        self._apply_proof(self._state, cell_id, status)

    def _apply_proof(self, state: GameState, cell_id: int, status: bool) -> None:
        state.proved_statuses[cell_id] = status
        state.revealed_clue_ids.update(
            clue.id for clue in self._puzzle.clues if clue.source_cell_id == cell_id
        )
