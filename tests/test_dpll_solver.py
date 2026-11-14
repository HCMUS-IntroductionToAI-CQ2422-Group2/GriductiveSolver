from itertools import product

import pytest

from BackEnd.LogicAgent import DPLL_Solver as dpll


BACKTRACKING_CNF = ((-1, 2), (-1, -2), (1, 3))


@pytest.mark.parametrize(
    ("cnf", "literal", "expected"),
    (
        (BACKTRACKING_CNF, 1, ((2,), (-2,))),
        (BACKTRACKING_CNF, -1, ((3,),)),
        (((-1,),), 1, ((),)),
        (((1,),), 1, ()),
        (((2, 3),), 1, ((2, 3),)),
    ),
)
def test_simplify(cnf, literal, expected):
    assert dpll.simplify(cnf, literal) == expected


def test_propagate_follows_units_created_by_simplification():
    assignment = {4: False}
    cnf = ((1,), (-1, 2), (-2, 3))

    assert dpll.propagate(cnf, assignment) == (
        (),
        {1: True, 2: True, 3: True, 4: False},
    )
    assert assignment == {4: False}


def test_propagate_stops_when_no_units_remain():
    assert dpll.propagate(((-1,), (1, 2, 3)), {}) == (
        ((2, 3),),
        {1: False},
    )


def test_propagate_detects_conflicting_units():
    assert dpll.propagate(((1,), (-1,)), {}) is None


@pytest.mark.parametrize(
    ("cnf", "num_vars"),
    (
        (((),), 0),
        (((1,), (-1,)), 1),
        (((1, 2), (1, -2), (-1, 2), (-1, -2)), 2),
    ),
)
def test_solve_returns_none_for_unsatisfiable_cnf(cnf, num_vars):
    assert dpll.solve(cnf, num_vars) is None


def test_solve_returns_a_complete_model():
    assert dpll.solve((), 0) == {}
    assert dpll.solve(((1,),), 3) == {1: True, 2: False, 3: False}


def test_solve_branches_on_the_smallest_variable_first():
    assert dpll.solve(((2, 1),), 2) == {1: True, 2: False}


def test_solve_backtracks_without_leaking_the_failed_assignment():
    # Trying x1=True forces x2=True before the branch fails.
    # With x1=False, x2 is free and gets the default value False.
    assert dpll.solve(BACKTRACKING_CNF, 3) == {1: False, 2: False, 3: True}


@pytest.mark.parametrize(
    ("counter", "expected"),
    (("decisions", 2), ("propagations", 2), ("backtracks", 1)),
)
def test_solve_records_search_counters(counter, expected):
    stats = dpll.DPLLStats()
    dpll.solve(BACKTRACKING_CNF, 3, stats=stats)

    assert getattr(stats, counter) == expected


@pytest.mark.parametrize("cnf", (((1,),), ((1,), (-1,))))
def test_solve_records_runtime_for_sat_and_unsat(monkeypatch, cnf):
    timestamps = iter((10.0, 10.125))
    monkeypatch.setattr(dpll, "perf_counter", lambda: next(timestamps))
    stats = dpll.DPLLStats()

    dpll.solve(cnf, 1, stats=stats)

    assert stats.runtime_ms == 125.0


def test_solve_agrees_with_truth_table_for_two_variables():
    clauses = tuple(
        tuple(literal for literal in choices if literal)
        for choices in product((0, 1, -1), (0, 2, -2))
    )
    models = [{1: first, 2: second} for first, second in product((False, True), repeat=2)]

    for included in product((False, True), repeat=len(clauses)):
        cnf = tuple(clause for use, clause in zip(included, clauses) if use)
        valid_models = [
            model for model in models
            if all(
                any(model[abs(literal)] == (literal > 0) for literal in clause)
                for clause in cnf
            )
        ]

        result = dpll.solve(cnf, 2)
        if valid_models:
            assert result in valid_models, cnf
        else:
            assert result is None, cnf
