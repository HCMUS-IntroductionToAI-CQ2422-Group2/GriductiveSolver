"""End-to-end tests: validate a 3x3 puzzle, then play it through the engine.

Board ids:   0 1 2
             3 4 5
             6 7 8
Solution: 0 and 1 are criminals, everyone else is innocent.

Public clues
  A: exactly 2 criminals, and they are orthogonally connected.
  B: no criminal in the bottom row (6, 7, 8).
Hidden clues
  C (unlocked by cell 6): no criminal in the middle row (3, 4, 5).
  D (unlocked by cell 1): odd number of criminals in column 0 (0, 3, 6).

Intended deduction:
  B -> 6, 7, 8 innocent; proving 6 reveals C.
  C -> 3, 4, 5 innocent; the connected pair must be {0,1} or {1,2},
       so 1 is a criminal; proving 1 reveals D.
  D -> 0 is a criminal (3 and 6 are innocent), so 2 is innocent.
"""

import pytest

from BackEnd.APIs.schemas import to_public_json
from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    ConnectedConstraint,
    Count,
    CountConstraint,
    Different,
    Fact,
    ParityConstraint,
    Same,
)
from BackEnd.GameEngine.GameObject.objects import PuzzleDefinition, Verdict
from BackEnd.GameEngine.validation import validate_puzzle
from tests.helpers import make_board, make_clue

ALL = tuple(range(9))
CRIMINALS = {0, 1}

CLUE_A = make_clue(1, AllOf((
    CountConstraint(Count(ALL), Comparison.EQ, 2),
    ConnectedConstraint(ALL, is_criminal=True),
)))
CLUE_B = make_clue(2, CountConstraint(Count((6, 7, 8)), Comparison.EQ, 0))
CLUE_C = make_clue(
    3, CountConstraint(Count((3, 4, 5)), Comparison.EQ, 0), source_cell_id=6
)
CLUE_D = make_clue(4, ParityConstraint(Count((0, 3, 6)), is_odd=True), source_cell_id=1)

PUZZLE = PuzzleDefinition(
    id="integration-3x3",
    board=make_board(3, 3),
    clues=(CLUE_A, CLUE_B, CLUE_C, CLUE_D),
    solution=tuple(Verdict(i, i in CRIMINALS) for i in ALL),
    initial_verdicts=(),
)

# A deduction order a real player could follow.
PLAY_ORDER = [
    (6, False), (7, False), (8, False),
    (3, False), (4, False), (5, False),
    (1, True), (0, True), (2, False),
]


@pytest.fixture
def engine():
    checker = BruteForceChecker()
    validate_puzzle(PUZZLE, checker)
    return GameEngine(PUZZLE, checker)


def clue_ids(state):
    return {clue.id for clue in state.revealed_clues}


def test_full_game_flow(engine):
    start = engine.get_public_state()
    assert clue_ids(start) == {1, 2}
    assert not start.is_complete

    # Before C is revealed, the middle row cannot be proved yet.
    assert engine.submit_verdict(3, False).outcome is SubmitOutcome.NOT_PROVABLE

    for cell_id, status in PLAY_ORDER:
        result = engine.submit_verdict(cell_id, status)
        assert result.outcome is SubmitOutcome.ACCEPTED, (cell_id, status)

    final = engine.get_public_state()
    assert final.is_complete
    assert clue_ids(final) == {1, 2, 3, 4}
    assert dict(final.proved_statuses) == {v.cell_id: v.is_criminal for v in PUZZLE.solution}


def test_clues_unlock_at_the_right_moment(engine):
    assert engine.submit_verdict(6, False).outcome is SubmitOutcome.ACCEPTED
    assert clue_ids(engine.get_public_state()) == {1, 2, 3}

    # 0 is still ambiguous ({0,1} vs {1,2}) until D is revealed by cell 1.
    for cell_id in (3, 4, 5):
        engine.submit_verdict(cell_id, False)
    assert engine.submit_verdict(0, True).outcome is SubmitOutcome.NOT_PROVABLE
    assert engine.submit_verdict(1, True).outcome is SubmitOutcome.ACCEPTED
    assert clue_ids(engine.get_public_state()) == {1, 2, 3, 4}
    assert engine.submit_verdict(0, True).outcome is SubmitOutcome.ACCEPTED


def test_wrong_moves_do_not_change_state(engine):
    engine.submit_verdict(6, False)
    before = engine.get_public_state()
    assert engine.submit_verdict(7, True).outcome is SubmitOutcome.CONTRADICTED
    assert engine.submit_verdict(6, True).outcome is SubmitOutcome.ALREADY_PROVED
    assert engine.submit_verdict(42, False).outcome is SubmitOutcome.INVALID_CELL
    assert engine.get_public_state() == before


def test_restart_mid_game(engine):
    initial = engine.get_public_state()
    for cell_id, status in PLAY_ORDER[:7]:  # up to proving cell 1
        engine.submit_verdict(cell_id, status)
    assert clue_ids(engine.get_public_state()) == {1, 2, 3, 4}

    state = engine.restart()
    assert state == initial
    assert dict(state.proved_statuses) == {}
    assert clue_ids(state) == {1, 2}
    # Hidden clues are locked again: middle row is unprovable once more.
    assert engine.submit_verdict(3, False).outcome is SubmitOutcome.NOT_PROVABLE

    for cell_id, status in PLAY_ORDER:
        assert engine.submit_verdict(cell_id, status).outcome is SubmitOutcome.ACCEPTED
    assert engine.get_public_state().is_complete


def test_fact_same_and_different_unlock_and_serialize():
    solution = (
        Verdict(0, False), Verdict(1, False), Verdict(2, True), Verdict(3, True)
    )
    puzzle = PuzzleDefinition(
        id="core-clues",
        board=make_board(2, 2),
        clues=(
            make_clue(1, Fact(0, False)),
            make_clue(2, Same(0, 1), source_cell_id=0),
            make_clue(3, Different(1, 2), source_cell_id=1),
            make_clue(4, Same(2, 3), source_cell_id=2),
        ),
        solution=solution,
        initial_verdicts=(),
    )
    checker = BruteForceChecker()
    validate_puzzle(puzzle, checker)
    engine = GameEngine(puzzle, checker)

    initial = to_public_json(engine.get_public_state())
    assert [
        clue["referenced_cell_ids"] for clue in initial["revealed_clues"]
    ] == [[0]]
    assert engine.submit_verdict(1, False).outcome is SubmitOutcome.NOT_PROVABLE
    for verdict in solution:
        result = engine.submit_verdict(verdict.cell_id, verdict.is_criminal)
        assert result.outcome is SubmitOutcome.ACCEPTED

    final = to_public_json(engine.get_public_state())
    assert [
        clue["referenced_cell_ids"] for clue in final["revealed_clues"]
    ] == [[0], [0, 1], [1, 2], [2, 3]]
    assert final["is_complete"] is True
