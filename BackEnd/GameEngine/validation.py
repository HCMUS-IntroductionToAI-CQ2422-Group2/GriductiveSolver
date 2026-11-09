from __future__ import annotations

from collections import Counter
from typing import Iterator

from BackEnd.GameEngine.ConstraintChecker import ConstraintChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    AnyOf,
    ConnectedConstraint,
    Constraint,
    Count,
    CountConstraint,
    Fact,
    Not,
    ParityConstraint,
)
from BackEnd.GameEngine.GameObject.objects import Board, PuzzleDefinition, Verdict
from BackEnd.GameEngine.GameState import PublicState


class PuzzleValidationError(Exception):
    """Raised by `validate_puzzle` when a puzzle is not valid."""


def validate_puzzle(
    puzzle: PuzzleDefinition,
    checker: ConstraintChecker,
) -> None:
    """Check structure, solution uniqueness, and no-guessing progression.

    Returns None when the puzzle is valid; otherwise raises
    `PuzzleValidationError` describing the first problem found.
    Checks run in order: structure, then uniqueness, then progression.
    """
    _check_structure(puzzle)
    _check_unique_solution(puzzle, checker)
    _check_solvable_without_guessing(puzzle, checker)


# ---- 1. Structure ---------------------------------------------------------

def _duplicates(values) -> list:
    return sorted(v for v, n in Counter(values).items() if n > 1)


def _constraint_targets(constraint: Constraint) -> Iterator[int]:
    """Yield every cell id referenced by a constraint (recursively)."""
    if isinstance(constraint, Fact):
        yield constraint.target
    elif isinstance(constraint, CountConstraint):
        yield from constraint.left.targets
        if isinstance(constraint.right, Count):
            yield from constraint.right.targets
    elif isinstance(constraint, ParityConstraint):
        yield from constraint.count.targets
    elif isinstance(constraint, ConnectedConstraint):
        yield from constraint.targets
    elif isinstance(constraint, (AllOf, AnyOf)):
        for child in constraint.constraints:
            yield from _constraint_targets(child)
    elif isinstance(constraint, Not):
        yield from _constraint_targets(constraint.constraint)
    else:
        raise PuzzleValidationError(
            f"Unsupported constraint type: {type(constraint).__name__}"
        )


def _check_grid(board: Board) -> None:
    """Rows must share one width, and each cell's declared coordinates must
    match its actual (row, column) position in `board.cells`.

    `BruteForceChecker` trusts `Cell.coordinates` (not array position) to
    find orthogonal neighbors for `ConnectedConstraint`, so a mismatch here
    would make connectivity checks silently wrong.
    """
    rows = board.cells
    if not rows or not rows[0]:
        raise PuzzleValidationError("Board has no cells")
    width = len(rows[0])
    for r, row in enumerate(rows):
        if len(row) != width:
            raise PuzzleValidationError(
                f"Row {r} has {len(row)} cells, expected {width} like row 0"
            )
        for c, cell in enumerate(row):
            if cell.coordinates != (r, c):
                raise PuzzleValidationError(
                    f"Cell {cell.id} has coordinates {cell.coordinates}, "
                    f"expected ({r}, {c}) from its position in board.cells"
                )


def _check_count(count: Count, clue_id: int) -> None:
    """A Count's targets must be distinct cell identifiers (spec 3.2)."""
    duplicated = _duplicates(count.targets)
    if duplicated:
        raise PuzzleValidationError(
            f"Clue {clue_id} has duplicate cell ids in a Count: {duplicated}"
        )


def _check_count_constraints(constraint: Constraint, clue_id: int) -> None:
    """Recursively validate every Count: distinct targets, and any constant
    k compared against a count satisfies 0 <= k <= |targets| (spec 3.2).
    """
    if isinstance(constraint, CountConstraint):
        _check_count(constraint.left, clue_id)
        if isinstance(constraint.right, Count):
            _check_count(constraint.right, clue_id)
        else:
            k = constraint.right
            limit = len(constraint.left.targets)
            if not (0 <= k <= limit):
                raise PuzzleValidationError(
                    f"Clue {clue_id} compares a count to {k}, "
                    f"out of range [0, {limit}]"
                )
    elif isinstance(constraint, ParityConstraint):
        _check_count(constraint.count, clue_id)
    elif isinstance(constraint, (AllOf, AnyOf)):
        for child in constraint.constraints:
            _check_count_constraints(child, clue_id)
    elif isinstance(constraint, Not):
        _check_count_constraints(constraint.constraint, clue_id)
    # Other constraint kinds (e.g. Fact, ConnectedConstraint) have no Count to check.


def _check_structure(puzzle: PuzzleDefinition) -> None:
    _check_grid(puzzle.board)
    all_cell_ids = [cell.id for row in puzzle.board.cells for cell in row]
    duplicated = _duplicates(all_cell_ids)
    if duplicated:
        raise PuzzleValidationError(f"Duplicate cell ids on board: {duplicated}")
    cell_ids = set(all_cell_ids)

    duplicated = _duplicates(clue.id for clue in puzzle.clues)
    if duplicated:
        raise PuzzleValidationError(f"Duplicate clue ids: {duplicated}")

    for clue in puzzle.clues:
        if clue.source_cell_id is not None and clue.source_cell_id not in cell_ids:
            raise PuzzleValidationError(
                f"Clue {clue.id} has unknown source cell {clue.source_cell_id}"
            )
        unknown = sorted(set(_constraint_targets(clue.constraint)) - cell_ids)
        if unknown:
            raise PuzzleValidationError(
                f"Clue {clue.id} references unknown cells {unknown}"
            )
        _check_count_constraints(clue.constraint, clue.id)

    solution_ids = [v.cell_id for v in puzzle.solution]
    duplicated = _duplicates(solution_ids)
    if duplicated:
        raise PuzzleValidationError(f"Solution repeats cells {duplicated}")
    unknown = sorted(set(solution_ids) - cell_ids)
    if unknown:
        raise PuzzleValidationError(f"Solution references unknown cells {unknown}")
    missing = sorted(cell_ids - set(solution_ids))
    if missing:
        raise PuzzleValidationError(f"Solution is missing cells {missing}")

    initial_ids = [v.cell_id for v in puzzle.initial_verdicts]
    duplicated = _duplicates(initial_ids)
    if duplicated:
        raise PuzzleValidationError(f"Initial verdicts repeat cells {duplicated}")
    solution = _solution_map(puzzle)
    for verdict in puzzle.initial_verdicts:
        if verdict.cell_id not in cell_ids:
            raise PuzzleValidationError(
                f"Initial verdict references unknown cell {verdict.cell_id}"
            )
        if solution[verdict.cell_id] != verdict.is_criminal:
            raise PuzzleValidationError(
                f"Initial verdict for cell {verdict.cell_id} disagrees with solution"
            )


def _solution_map(puzzle: PuzzleDefinition) -> dict[int, bool]:
    return {v.cell_id: v.is_criminal for v in puzzle.solution}


# ---- 2. Unique solution ---------------------------------------------------

def _check_unique_solution(
    puzzle: PuzzleDefinition,
    checker: ConstraintChecker,
) -> None:
    """With every clue known, the declared solution must be the only one."""
    solution = _solution_map(puzzle)
    initial = {v.cell_id: v.is_criminal for v in puzzle.initial_verdicts}

    def all_clues_state(proved: dict[int, bool]) -> PublicState:
        return PublicState(
            puzzle_id=puzzle.id,
            board=puzzle.board,
            revealed_clues=puzzle.clues,
            proved_statuses=proved,
        )

    if not checker.has_solution(all_clues_state(solution)):
        raise PuzzleValidationError(
            "Declared solution does not satisfy all clues"
        )

    base = all_clues_state(initial)
    ambiguous = [
        cell_id
        for cell_id, is_criminal in solution.items()
        if cell_id not in initial
        and checker.has_solution(base, Verdict(cell_id, not is_criminal))
    ]
    if ambiguous:
        raise PuzzleValidationError(
            f"Solution is not unique: cells {sorted(ambiguous)} can differ"
        )


# ---- 3. Solvable without guessing ----------------------------------------

def _check_solvable_without_guessing(
    puzzle: PuzzleDefinition,
    checker: ConstraintChecker,
) -> None:
    """Replay a perfect player through the real engine.

    Each round submits the correct verdict for every unproved cell; the
    puzzle is stuck if a whole round accepts nothing before completion.
    """
    solution = _solution_map(puzzle)
    engine = GameEngine(puzzle, checker)

    while True:
        state = engine.get_public_state()
        if state.is_complete:
            return
        progressed = False
        for cell_id in sorted(solution):
            if cell_id in state.proved_statuses:
                continue
            result = engine.submit_verdict(cell_id, solution[cell_id])
            if result.outcome is SubmitOutcome.ACCEPTED:
                progressed = True
                state = result.public_state
            elif result.outcome is SubmitOutcome.CONTRADICTED:
                raise PuzzleValidationError(
                    f"Revealed clues contradict the solution at cell {cell_id}"
                )
        if not progressed:
            stuck = sorted(c for c in solution if c not in state.proved_statuses)
            raise PuzzleValidationError(
                f"Puzzle requires guessing: no cell is provable among {stuck}"
            )
