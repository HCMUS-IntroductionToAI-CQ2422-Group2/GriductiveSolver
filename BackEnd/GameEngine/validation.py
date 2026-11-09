from __future__ import annotations

from collections import Counter

from BackEnd.GameEngine.ConstraintChecker import ConstraintChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.constraints import referenced_cell_ids
from BackEnd.GameEngine.GameObject.objects import PuzzleDefinition, Verdict
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


def _check_structure(puzzle: PuzzleDefinition) -> None:
    all_cell_ids = [cell.id for row in puzzle.board.cells for cell in row]
    if not all_cell_ids:
        raise PuzzleValidationError("Board has no cells")
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
        try:
            targets = referenced_cell_ids(clue.constraint)
        except TypeError as error:
            raise PuzzleValidationError(str(error)) from error
        unknown = sorted(targets - cell_ids)
        if unknown:
            raise PuzzleValidationError(
                f"Clue {clue.id} references unknown cells {unknown}"
            )

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
