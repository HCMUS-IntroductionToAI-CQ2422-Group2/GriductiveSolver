import pytest

from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.constraints import (
    Comparison,
    Count,
    CountConstraint,
)
from BackEnd.GameEngine.GameObject.objects import PuzzleDefinition, Verdict
from tests.helpers import make_board, make_clue

# 2x2 board:  0 1
#             2 3
# Solution: 0 criminal, 1/2/3 innocent.
# Public:  C1 "exactly one criminal",  C2 "no criminal in bottom row".
# Hidden:  C3 (unlocked by cell 2) "cell 1 is innocent".
BOARD = make_board(2, 2)
C1 = make_clue(1, CountConstraint(Count((0, 1, 2, 3)), Comparison.EQ, 1))
C2 = make_clue(2, CountConstraint(Count((2, 3)), Comparison.EQ, 0))
C3 = make_clue(3, CountConstraint(Count((1,)), Comparison.EQ, 0), source_cell_id=2)
SOLUTION = (
    Verdict(0, True), Verdict(1, False), Verdict(2, False), Verdict(3, False),
)


def make_puzzle(initial_verdicts=()):
    return PuzzleDefinition(
        id="tiny",
        board=BOARD,
        clues=(C1, C2, C3),
        solution=SOLUTION,
        initial_verdicts=tuple(initial_verdicts),
    )


@pytest.fixture
def engine():
    return GameEngine(make_puzzle(), BruteForceChecker())


def clue_ids(state):
    return {clue.id for clue in state.revealed_clues}


# ---- initial state / get_public_state ------------------------------------

def test_initial_state_shows_only_public_clues(engine):
    state = engine.get_public_state()
    assert state.puzzle_id == "tiny"
    assert state.board is BOARD
    assert clue_ids(state) == {1, 2}
    assert dict(state.proved_statuses) == {}
    assert not hasattr(state, "solution")


def test_initial_verdicts_are_proved_and_reveal_their_clues():
    engine = GameEngine(make_puzzle([Verdict(2, False)]), BruteForceChecker())
    state = engine.get_public_state()
    assert dict(state.proved_statuses) == {2: False}
    assert clue_ids(state) == {1, 2, 3}


def test_public_state_is_read_only_and_detached(engine):
    before = engine.get_public_state()
    with pytest.raises(TypeError):
        before.proved_statuses[0] = True  # type: ignore[index]
    engine.submit_verdict(2, False)
    assert dict(before.proved_statuses) == {}
    assert clue_ids(before) == {1, 2}


# ---- submit_verdict: one test per outcome --------------------------------

def test_submit_accepted_records_verdict_and_reveals_clue(engine):
    result = engine.submit_verdict(2, False)
    assert result.outcome is SubmitOutcome.ACCEPTED
    assert result.verdict == Verdict(2, False)
    assert dict(result.public_state.proved_statuses) == {2: False}
    assert clue_ids(result.public_state) == {1, 2, 3}
    assert engine.get_public_state() == result.public_state


def test_submit_not_provable(engine):
    # Either 0 or 1 could be the criminal with only the public clues.
    before = engine.get_public_state()
    result = engine.submit_verdict(0, True)
    assert result.outcome is SubmitOutcome.NOT_PROVABLE
    assert result.public_state == before
    assert engine.get_public_state() == before


def test_submit_contradicted(engine):
    before = engine.get_public_state()
    result = engine.submit_verdict(2, True)
    assert result.outcome is SubmitOutcome.CONTRADICTED
    assert engine.get_public_state() == before


def test_submit_already_proved(engine):
    engine.submit_verdict(2, False)
    before = engine.get_public_state()
    result = engine.submit_verdict(2, False)
    assert result.outcome is SubmitOutcome.ALREADY_PROVED
    assert engine.get_public_state() == before


def test_submit_invalid_cell(engine):
    before = engine.get_public_state()
    result = engine.submit_verdict(99, True)
    assert result.outcome is SubmitOutcome.INVALID_CELL
    assert result.verdict == Verdict(99, True)
    assert engine.get_public_state() == before


def test_revealed_clue_makes_new_cell_provable(engine):
    assert engine.submit_verdict(1, False).outcome is SubmitOutcome.NOT_PROVABLE
    engine.submit_verdict(2, False)  # unlocks C3
    assert engine.submit_verdict(1, False).outcome is SubmitOutcome.ACCEPTED
    assert engine.submit_verdict(0, True).outcome is SubmitOutcome.ACCEPTED
    assert engine.submit_verdict(3, False).outcome is SubmitOutcome.ACCEPTED
    assert engine.get_public_state().is_complete


# ---- restart --------------------------------------------------------------

def test_restart_after_moves(engine):
    initial = engine.get_public_state()
    engine.submit_verdict(2, False)
    engine.submit_verdict(1, False)
    state = engine.restart()
    assert state == initial
    assert engine.get_public_state() == initial
    # Game is playable again from scratch.
    assert engine.submit_verdict(2, False).outcome is SubmitOutcome.ACCEPTED


def test_restart_keeps_initial_verdicts():
    engine = GameEngine(make_puzzle([Verdict(2, False)]), BruteForceChecker())
    engine.submit_verdict(1, False)
    state = engine.restart()
    assert dict(state.proved_statuses) == {2: False}
    assert clue_ids(state) == {1, 2, 3}
