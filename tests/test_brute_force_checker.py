from BackEnd.GameEngine.BruteForceChecker import (
    BruteForceChecker,
    cell_positions,
    evaluate_constraint,
)
from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    ConnectedConstraint,
    Count,
    CountConstraint,
    ParityConstraint,
)
from BackEnd.GameEngine.GameObject.objects import Verdict
from tests.helpers import make_board, make_clue, make_public_state

# 2x2 board:  0 1
#             2 3
BOARD = make_board(2, 2)
POS = cell_positions(BOARD)
ALL = (0, 1, 2, 3)


def ev(constraint, assignment):
    return evaluate_constraint(constraint, assignment, POS)


# ---- evaluate_constraint: CountConstraint ---------------------------------

def test_count_eq_full_assignment():
    c = CountConstraint(Count(ALL), Comparison.EQ, 2)
    assert ev(c, {0: True, 1: True, 2: False, 3: False}) is True
    assert ev(c, {0: True, 1: False, 2: False, 3: False}) is False


def test_count_counts_innocents_when_is_criminal_false():
    c = CountConstraint(Count(ALL, is_criminal=False), Comparison.EQ, 3)
    assert ev(c, {0: True, 1: False, 2: False, 3: False}) is True


def test_count_partial_undecided_and_early_decisions():
    c = CountConstraint(Count(ALL), Comparison.GE, 2)
    assert ev(c, {0: True}) is None
    assert ev(c, {0: True, 1: True}) is True          # already >= 2
    assert ev(c, {0: False, 1: False, 2: False}) is False  # max 1


def test_count_all_comparisons():
    full = {0: True, 1: False, 2: False, 3: False}  # one criminal
    expected = {
        Comparison.EQ: True, Comparison.NE: False,
        Comparison.LT: False, Comparison.LE: True,
        Comparison.GT: False, Comparison.GE: True,
    }
    for comparison, result in expected.items():
        c = CountConstraint(Count(ALL), comparison, 1)
        assert ev(c, full) is result, comparison


def test_count_vs_count():
    # criminals in row 0 > criminals in row 1
    c = CountConstraint(Count((0, 1)), Comparison.GT, Count((2, 3)))
    assert ev(c, {0: True, 1: False, 2: False, 3: False}) is True
    assert ev(c, {0: True, 1: False, 2: True, 3: False}) is False
    assert ev(c, {0: True, 1: True, 2: False}) is True  # 2 > at most 1


# ---- ParityConstraint -----------------------------------------------------

def test_parity():
    odd = ParityConstraint(Count(ALL), is_odd=True)
    assert ev(odd, {0: True, 1: False, 2: False, 3: False}) is True
    assert ev(odd, {0: True, 1: True, 2: False, 3: False}) is False
    assert ev(odd, {0: True}) is None


# ---- ConnectedConstraint --------------------------------------------------

def test_connected_orthogonal():
    c = ConnectedConstraint(ALL, is_criminal=True)
    assert ev(c, {0: True, 1: True, 2: False, 3: False}) is True
    # Diagonal only (0 and 3) is NOT connected.
    assert ev(c, {0: True, 1: False, 2: False, 3: True}) is False
    assert ev(c, {0: True, 1: True}) is None


def test_connected_empty_respects_allow_empty():
    none_criminal = {0: False, 1: False, 2: False, 3: False}
    assert ev(ConnectedConstraint(ALL, True), none_criminal) is False
    assert ev(ConnectedConstraint(ALL, True, allow_empty=True), none_criminal) is True


# ---- AllOf ----------------------------------------------------------------

def test_all_of():
    two = CountConstraint(Count(ALL), Comparison.EQ, 2)
    conn = ConnectedConstraint(ALL, True)
    c = AllOf((two, conn))
    assert ev(c, {0: True, 1: True, 2: False, 3: False}) is True
    assert ev(c, {0: True, 1: False, 2: False, 3: True}) is False
    assert ev(c, {0: False, 1: False, 2: False}) is False  # count fails early
    assert ev(c, {0: True}) is None


# ---- has_solution ---------------------------------------------------------

CHECKER = BruteForceChecker()
EXACTLY_ONE = make_clue(1, CountConstraint(Count(ALL), Comparison.EQ, 1))
TOP_ROW_ONE = make_clue(2, CountConstraint(Count((0, 1)), Comparison.EQ, 1))


def test_has_solution_no_clues_always_true():
    assert CHECKER.has_solution(make_public_state(BOARD)) is True


def test_has_solution_with_assumption():
    state = make_public_state(BOARD, clues=[EXACTLY_ONE, TOP_ROW_ONE])
    assert CHECKER.has_solution(state) is True
    # Criminal must be in top row -> cell 2 cannot be criminal.
    assert CHECKER.has_solution(state, Verdict(2, True)) is False
    assert CHECKER.has_solution(state, Verdict(2, False)) is True
    # Cell 0 could be either -> both assumptions satisfiable.
    assert CHECKER.has_solution(state, Verdict(0, True)) is True
    assert CHECKER.has_solution(state, Verdict(0, False)) is True


def test_has_solution_uses_proved_statuses():
    state = make_public_state(
        BOARD, clues=[EXACTLY_ONE, TOP_ROW_ONE], proved={1: False}
    )
    # With 1 innocent, 0 must be the criminal.
    assert CHECKER.has_solution(state, Verdict(0, False)) is False
    assert CHECKER.has_solution(state, Verdict(0, True)) is True


def test_has_solution_assumption_conflicts_with_proved():
    state = make_public_state(BOARD, proved={0: True})
    assert CHECKER.has_solution(state, Verdict(0, False)) is False
    assert CHECKER.has_solution(state, Verdict(0, True)) is True


def test_has_solution_contradictory_clues():
    none = make_clue(3, CountConstraint(Count(ALL), Comparison.EQ, 0))
    state = make_public_state(BOARD, clues=[EXACTLY_ONE, none])
    assert CHECKER.has_solution(state) is False


def test_has_solution_ignores_unrevealed_information():
    # Only revealed clues count: without clues, cell 2 may be criminal.
    state = make_public_state(BOARD, clues=[EXACTLY_ONE])
    assert CHECKER.has_solution(state, Verdict(2, True)) is True
