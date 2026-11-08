"""Playable API demo while the team's GameEngine and DPLL are in development."""

from itertools import product
from types import MappingProxyType

from BackEnd.GameEngine.ConstraintChecker import ConstraintChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome, SubmitResult
from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    Constraint,
    Count,
    CountConstraint,
)
from BackEnd.GameEngine.GameObject.objects import Board, Cell, Clue, PuzzleDefinition, Verdict
from BackEnd.GameEngine.GameState import GameState, PublicState


def make_demo_puzzle() -> PuzzleDefinition:
    characters = [
        ("An", "Thợ mộc"), ("Bình", "Bác sĩ"), ("Chi", "Đầu bếp"),
        ("Dũng", "Tài xế"), ("Giang", "Giáo viên"), ("Hà", "Thợ may"),
        ("Lan", "Họa sĩ"), ("Minh", "Kỹ sư"), ("Nam", "Nhạc sĩ"),
    ]
    cells = tuple(
        Cell(cell_id, divmod(cell_id, 3), name, profession)
        for cell_id, (name, profession) in enumerate(characters)
    )
    criminals = {1, 5, 6, 8}
    solution = tuple(Verdict(cell.id, cell.id in criminals) for cell in cells)
    clues = [
        Clue(
            id=1,
            source_cell_id=0,
            constraint=AllOf((
                CountConstraint(Count((3, 4, 5)), Comparison.EQ, 1),
                CountConstraint(Count((3, 4)), Comparison.EQ, 0),
            )),
            description_nl="Có đúng một tội phạm ở hàng 2. Dũng và Giang vô tội.",
        )
    ]

    # Revealing each of these cards provides a fact about another cell.
    links = [(1, 2), (2, 6), (3, 1), (4, 5), (5, 0), (6, 7), (7, 8), (8, 4)]
    for source_id, target_id in links:
        target = cells[target_id]
        is_criminal = target_id in criminals
        status = "là tội phạm" if is_criminal else "vô tội"
        clues.append(Clue(
            id=source_id + 1,
            source_cell_id=source_id,
            constraint=CountConstraint(
                Count((target_id,)), Comparison.EQ, int(is_criminal)
            ),
            description_nl=f"{target.character_name} {status}.",
        ))

    return PuzzleDefinition(
        id="demo-3x3",
        board=Board((cells[:3], cells[3:6], cells[6:])),
        clues=tuple(clues),
        solution=solution,
        initial_verdicts=(solution[0],),
    )


class DemoConstraintChecker:
    """Enumerate assignments for the small demo using public clues only."""

    def has_solution(self, public_state: PublicState, assumption: Verdict | None = None) -> bool:
        cell_ids = [cell.id for row in public_state.board.cells for cell in row]
        known = dict(public_state.proved_statuses)
        if assumption is not None:
            if assumption.cell_id not in cell_ids:
                return False
            if known.get(assumption.cell_id, assumption.is_criminal) != assumption.is_criminal:
                return False
            known[assumption.cell_id] = assumption.is_criminal

        unknown = [cell_id for cell_id in cell_ids if cell_id not in known]
        for values in product((False, True), repeat=len(unknown)):
            assignment = known | dict(zip(unknown, values))
            if all(self._matches(clue.constraint, assignment) for clue in public_state.revealed_clues):
                return True
        return False

    def _matches(self, constraint: Constraint, assignment: dict[int, bool]) -> bool:
        if isinstance(constraint, AllOf):
            return all(self._matches(part, assignment) for part in constraint.constraints)

        if (
            isinstance(constraint, CountConstraint)
            and constraint.comparison is Comparison.EQ
            and isinstance(constraint.right, int)
        ):
            count = sum(
                assignment[cell_id] == constraint.left.is_criminal
                for cell_id in constraint.left.targets
            )
            return count == constraint.right

        raise ValueError(f"Constraint outside the demo: {constraint!r}")


class DemoGameEngine(GameEngine):
    def __init__(self, puzzle: PuzzleDefinition, checker: ConstraintChecker):
        self._puzzle = puzzle
        self._checker = checker
        self.restart()

    def get_public_state(self) -> PublicState:
        proved = self._state.proved_statuses.copy()
        return PublicState(
            puzzle_id=self._puzzle.id,
            board=self._puzzle.board,
            revealed_clues=tuple(
                clue for clue in self._puzzle.clues
                if clue.source_cell_id is None or clue.source_cell_id in proved
            ),
            proved_statuses=MappingProxyType(proved),
        )

    def submit_verdict(self, cell_id: int, status: bool) -> SubmitResult:
        verdict = Verdict(cell_id, status)
        state = self.get_public_state()
        if not any(cell.id == cell_id for row in state.board.cells for cell in row):
            return SubmitResult(verdict, SubmitOutcome.INVALID_CELL, state)
        if cell_id in state.proved_statuses:
            return SubmitResult(verdict, SubmitOutcome.ALREADY_PROVED, state)

        possible = self._checker.has_solution(state, verdict)
        opposite = self._checker.has_solution(state, Verdict(cell_id, not status))
        if possible and not opposite:
            self._state.proved_statuses[cell_id] = status
            return SubmitResult(verdict, SubmitOutcome.ACCEPTED, self.get_public_state())
        if opposite and not possible:
            return SubmitResult(verdict, SubmitOutcome.CONTRADICTED, state)
        return SubmitResult(verdict, SubmitOutcome.NOT_PROVABLE, state)

    def restart(self) -> PublicState:
        self._state = GameState({
            verdict.cell_id: verdict.is_criminal for verdict in self._puzzle.initial_verdicts
        })
        return self.get_public_state()
