import dataclasses

import pytest

from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker
from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    Count,
    CountConstraint,
    ParityConstraint,
)
from BackEnd.GameEngine.GameObject.objects import Board, Cell, PuzzleDefinition, Verdict
from BackEnd.GameEngine.validation import PuzzleValidationError, validate_puzzle
from tests.helpers import make_board, make_clue

CHECKER = BruteForceChecker()
ALL = (0, 1, 2, 3)

# Same valid 2x2 puzzle as the engine tests: 0 criminal, others innocent.
BOARD = make_board(2, 2)
C1 = make_clue(1, CountConstraint(Count(ALL), Comparison.EQ, 1))
C2 = make_clue(2, CountConstraint(Count((2, 3)), Comparison.EQ, 0))
C3 = make_clue(3, CountConstraint(Count((1,)), Comparison.EQ, 0), source_cell_id=2)
SOLUTION = (Verdict(0, True), Verdict(1, False), Verdict(2, False), Verdict(3, False))
VALID = PuzzleDefinition(
    id="valid", board=BOARD, clues=(C1, C2, C3),
    solution=SOLUTION, initial_verdicts=(),
)


def with_(**changes) -> PuzzleDefinition:
    return dataclasses.replace(VALID, **changes)


def assert_invalid(puzzle, message_part):
    with pytest.raises(PuzzleValidationError, match=message_part):
        validate_puzzle(puzzle, CHECKER)


# ---- valid puzzles --------------------------------------------------------

def test_valid_puzzle_passes():
    assert validate_puzzle(VALID, CHECKER) is None


def test_valid_puzzle_with_initial_verdict_passes():
    validate_puzzle(with_(initial_verdicts=(Verdict(2, False),)), CHECKER)


# ---- structure ------------------------------------------------------------

def test_duplicate_cell_ids():
    cell = Cell(0, (0, 0), "A", "x")
    twin = Cell(0, (0, 1), "B", "x")
    assert_invalid(with_(board=Board(((cell, twin),))), "Duplicate cell ids")


def test_duplicate_clue_ids():
    assert_invalid(with_(clues=(C1, make_clue(1, C2.constraint))), "Duplicate clue ids")


def test_unknown_source_cell():
    bad = make_clue(9, C3.constraint, source_cell_id=42)
    assert_invalid(with_(clues=(C1, C2, bad)), "unknown source cell 42")


def test_unknown_target_inside_nested_constraint():
    nested = AllOf((
        C1.constraint,
        ParityConstraint(Count((0, 77)), is_odd=True),
    ))
    assert_invalid(with_(clues=(make_clue(9, nested),)), r"unknown cells \[77\]")


def test_solution_missing_cell():
    assert_invalid(with_(solution=SOLUTION[:3]), r"missing cells \[3\]")


def test_solution_repeats_cell():
    assert_invalid(with_(solution=SOLUTION + (Verdict(0, True),)), "repeats cells")


def test_solution_unknown_cell():
    assert_invalid(with_(solution=SOLUTION + (Verdict(8, True),)), "unknown cells")


def test_initial_verdict_unknown_cell():
    assert_invalid(with_(initial_verdicts=(Verdict(8, True),)), "unknown cell 8")


def test_initial_verdict_disagrees_with_solution():
    assert_invalid(with_(initial_verdicts=(Verdict(0, False),)), "disagrees")


# ---- uniqueness -----------------------------------------------------------

def test_declared_solution_violates_clues():
    wrong = (Verdict(0, False), Verdict(1, True), Verdict(2, False), Verdict(3, False))
    assert_invalid(with_(solution=wrong), "does not satisfy")


def test_two_solutions_rejected():
    # Without C3, cell 0 or cell 1 could be the criminal.
    assert_invalid(with_(clues=(C1, C2)), r"not unique: cells \[0, 1\]")


# ---- no-guessing progression ---------------------------------------------

def test_requires_guessing():
    # Unique overall, but the only clue that breaks the 0/1 tie is hidden
    # behind cell 1 itself, which can never be proved first.
    locked = make_clue(3, C3.constraint, source_cell_id=1)
    assert_invalid(with_(clues=(C1, C2, locked)), r"requires guessing.*\[0, 1\]")
