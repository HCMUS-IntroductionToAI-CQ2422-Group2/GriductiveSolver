"""Deductive logic agent: plays only moves that the public clues prove.

For every unresolved cell the agent asks the checker two questions, "can this
cell be a criminal?" and "can it be innocent?". If exactly one answer is yes,
the other status is refuted and the verdict is forced. The agent never guesses.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Literal, Mapping

from BackEnd.GameEngine.ConstraintChecker import ConstraintChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.GameState import PublicState

MoveStatus = Literal["FOUND", "SOLVED", "UNKNOWN", "INCONSISTENT"]
SolveStatus = Literal["SOLVED", "STUCK", "INCONSISTENT"]
CellClassification = Literal["CRIMINAL", "INNOCENT", "UNKNOWN"]
ClassificationStatus = Literal["CONSISTENT", "INCONSISTENT"]


@dataclass(frozen=True)
class Query:
    """One checker call: is the public state satisfiable under `assumption`?"""

    assumption: Verdict | None
    satisfiable: bool


@dataclass(frozen=True)
class Move:
    status: MoveStatus
    verdict: Verdict | None = None
    queries: tuple[Query, ...] = ()


@dataclass(frozen=True)
class ClassificationResult:
    status: ClassificationStatus
    classifications: Mapping[int, CellClassification] = field(
        default_factory=lambda: MappingProxyType({})
    )
    queries: tuple[Query, ...] = ()


@dataclass(frozen=True)
class Step:
    step: int
    verdict: Verdict
    queries: tuple[Query, ...]
    active_clue_ids: tuple[int, ...]
    revealed_clue_ids: tuple[int, ...]


@dataclass(frozen=True)
class SolveResult:
    status: SolveStatus
    state: PublicState
    trace: tuple[Step, ...] = field(default_factory=tuple)


class MoveRejected(RuntimeError):
    """The engine refused a move the agent believed was proved."""

    def __init__(self, verdict: Verdict, outcome: SubmitOutcome):
        super().__init__(f"Agent move {verdict} rejected: {outcome.value}")
        self.verdict = verdict
        self.outcome = outcome


class DeductiveAgent:
    def __init__(self, checker: ConstraintChecker):
        self._checker = checker

    def next_move(self, state: PublicState) -> Move:
        """Return the first provable verdict, or why none exists."""
        queries: list[Query] = []

        def check(assumption: Verdict | None = None) -> bool:
            satisfiable = self._checker.has_solution(state, assumption)
            queries.append(Query(assumption, satisfiable))
            return satisfiable

        if not check():
            return Move("INCONSISTENT", queries=tuple(queries))

        unresolved = [
            cell.id for row in state.board.cells for cell in row
            if cell.id not in state.proved_statuses
        ]
        for cell_id in unresolved:
            criminal = Verdict(cell_id, True)
            innocent = Verdict(cell_id, False)
            can_be_criminal = check(criminal)
            can_be_innocent = check(innocent)
            if can_be_criminal != can_be_innocent:
                return Move(
                    "FOUND",
                    criminal if can_be_criminal else innocent,
                    tuple(queries),
                )

        return Move("UNKNOWN" if unresolved else "SOLVED", queries=tuple(queries))

    def classify_all(self, public_state: PublicState) -> ClassificationResult:
        """Classify every unresolved cell as CRIMINAL, INNOCENT, or UNKNOWN."""
        queries: list[Query] = []

        def check(assumption: Verdict | None = None) -> bool:
            satisfiable = self._checker.has_solution(public_state, assumption)
            queries.append(Query(assumption, satisfiable))
            return satisfiable

        if not check():
            return ClassificationResult("INCONSISTENT", queries=tuple(queries))

        unresolved = [
            cell.id for row in public_state.board.cells for cell in row
            if cell.id not in public_state.proved_statuses
        ]
        classifications: dict[int, CellClassification] = {}
        for cell_id in unresolved:
            can_be_criminal = check(Verdict(cell_id, True))
            can_be_innocent = check(Verdict(cell_id, False))
            if can_be_criminal and not can_be_innocent:
                classifications[cell_id] = "CRIMINAL"
            elif can_be_innocent and not can_be_criminal:
                classifications[cell_id] = "INNOCENT"
            elif can_be_criminal and can_be_innocent:
                classifications[cell_id] = "UNKNOWN"
            else:
                return ClassificationResult("INCONSISTENT", queries=tuple(queries))

        return ClassificationResult(
            "CONSISTENT",
            MappingProxyType(classifications),
            tuple(queries),
        )

    def solve(self, engine: GameEngine) -> SolveResult:
        """Keep playing provable moves until solved or no move is provable."""
        trace: list[Step] = []
        state = engine.get_public_state()
        while True:
            move = self.next_move(state)
            verdict = move.verdict
            if verdict is None:
                status: SolveStatus = "STUCK" if move.status == "UNKNOWN" else move.status
                return SolveResult(status, state, tuple(trace))

            result = engine.submit_verdict(verdict.cell_id, verdict.is_criminal)
            if result.outcome is not SubmitOutcome.ACCEPTED:
                raise MoveRejected(verdict, result.outcome)

            active = tuple(clue.id for clue in state.revealed_clues)
            trace.append(Step(
                step=len(trace) + 1,
                verdict=verdict,
                queries=move.queries,
                active_clue_ids=active,
                revealed_clue_ids=tuple(
                    clue.id for clue in result.public_state.revealed_clues
                    if clue.id not in active
                ),
            ))
            state = result.public_state
