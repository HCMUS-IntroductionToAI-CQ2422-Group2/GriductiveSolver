from BackEnd.GameEngine.BruteForceChecker import (
    BruteForceChecker,
    cell_positions,
    evaluate_constraint,
    order_free_cells_by_degree,
    referenced_cells,
)
from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    AnyOf,
    Comparison,
    ConnectedConstraint,
    Count,
    CountConstraint,
    Fact,
    Not,
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


# ---- Fact -------------------------------------------------------------------

def test_fact_criminal():
    f = Fact(0, is_criminal=True)
    assert ev(f, {0: True}) is True
    assert ev(f, {0: False}) is False
    assert ev(f, {}) is None


def test_fact_innocent():
    f = Fact(0, is_criminal=False)
    assert ev(f, {0: False}) is True
    assert ev(f, {0: True}) is False


# ---- AnyOf ------------------------------------------------------------------

def test_any_of():
    a = AnyOf((Fact(0, True), Fact(1, True)))
    assert ev(a, {0: True}) is True  # short-circuits before cell 1 is known
    assert ev(a, {0: False, 1: True}) is True
    assert ev(a, {0: False, 1: False}) is False
    assert ev(a, {0: False}) is None  # still waiting on cell 1


# ---- Not ----------------------------------------------------------------------

def test_not():
    n = Not(Fact(0, True))
    assert ev(n, {0: True}) is False
    assert ev(n, {0: False}) is True
    assert ev(n, {}) is None


# ---- AllOf ----------------------------------------------------------------

def test_all_of():
    two = CountConstraint(Count(ALL), Comparison.EQ, 2)
    conn = ConnectedConstraint(ALL, True)
    c = AllOf((two, conn))
    assert ev(c, {0: True, 1: True, 2: False, 3: False}) is True
    assert ev(c, {0: True, 1: False, 2: False, 3: True}) is False
    assert ev(c, {0: False, 1: False, 2: False}) is False  # count fails early
    assert ev(c, {0: True}) is None


# ---- degree-ordering heuristic ---------------------------------------------

def test_referenced_cells_covers_all_constraint_kinds():
    nested = AllOf((
        CountConstraint(Count((0, 1)), Comparison.EQ, Count((2,))),
        AnyOf((Fact(3, True), Not(ParityConstraint(Count((1,)), is_odd=True)))),
        ConnectedConstraint((0, 2), is_criminal=True),
    ))
    assert sorted(referenced_cells(nested)) == [0, 0, 1, 1, 2, 2, 3]


def test_order_by_degree_prioritizes_most_referenced_cells():
    # Cell 0 is read by both constraints, cell 1 by one, cells 2 and 3 by none.
    constraints = [
        CountConstraint(Count((0, 1)), Comparison.EQ, 1),
        Fact(0, True),
    ]
    ordered = order_free_cells_by_degree([3, 2, 1, 0], constraints)
    assert ordered == [0, 1, 3, 2]  # ties keep their original relative order


def test_order_by_degree_is_a_no_op_without_constraints():
    assert order_free_cells_by_degree([3, 2, 1, 0], []) == [3, 2, 1, 0]


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


def test_has_solution_with_fact_and_any_of():
    # Clue: cell 0 or cell 1 is the criminal.
    either = make_clue(5, AnyOf((Fact(0, True), Fact(1, True))))
    state = make_public_state(BOARD, clues=[either])
    assert CHECKER.has_solution(state) is True
    assert CHECKER.has_solution(state, Verdict(0, False)) is True  # 1 can be it

    # Once 0 is known innocent, 1 is forced to be the criminal.
    narrowed = make_public_state(BOARD, clues=[either], proved={0: False})
    assert CHECKER.has_solution(narrowed, Verdict(1, False)) is False
    assert CHECKER.has_solution(narrowed, Verdict(1, True)) is True


def test_has_solution_ignores_unrevealed_information():
    # Only revealed clues count: without clues, cell 2 may be criminal.
    state = make_public_state(BOARD, clues=[EXACTLY_ONE])
    assert CHECKER.has_solution(state, Verdict(2, True)) is True
