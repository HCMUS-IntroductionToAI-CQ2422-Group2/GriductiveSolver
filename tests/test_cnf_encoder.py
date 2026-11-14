from itertools import product

from BackEnd.GameEngine.BruteForceChecker import evaluate_constraint
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
from BackEnd.GameEngine.GameObject.objects import Board, Cell
from BackEnd.LogicAgent.cnf_encoder import CNFEncoder


BOARD = Board((tuple(Cell(cell_id, (0, column), "", "")
                     for column, cell_id in enumerate((30, 10, 40, 20))),))


def assert_matches_truth_tables(board, constraints):
    encoder = CNFEncoder(board)
    cell_ids = tuple(encoder.variable_map)
    positions = {cell.id: cell.coordinates for row in board.cells for cell in row}
    for constraint in constraints:
        clauses = encoder.encode_constraint(constraint)
        for values in product((False, True), repeat=len(cell_ids)):
            assignment = dict(zip(cell_ids, values))
            variable_values = {
                encoder.get_variable(cell_id): value
                for cell_id, value in assignment.items()
            }
            remaining = clauses
            while remaining:
                remaining = [
                    [literal for literal in clause if abs(literal) not in variable_values]
                    for clause in remaining
                    if not any(variable_values.get(abs(literal)) == (literal > 0)
                               for literal in clause)
                ]
                if [] in remaining:
                    break
                units = [clause[0] for clause in remaining if len(clause) == 1]
                if not units:
                    # Once cells are assigned, the gate encodings determine all auxiliaries.
                    assert not remaining, (constraint, remaining)
                    break
                # Propagate one unit at a time so conflicting units are detected.
                literal = units[0]
                variable_values[abs(literal)] = literal > 0
            actual = [] not in remaining
            assert actual == evaluate_constraint(constraint, assignment, positions), (
                constraint, assignment, clauses,
            )


def test_variable_map_uses_cell_ids_and_positive_variables():
    encoder = CNFEncoder(BOARD)
    assert encoder.variable_map == {10: 1, 20: 2, 30: 3, 40: 4}


def test_encoded_constraints_match_truth_tables():
    encoder = CNFEncoder(BOARD)
    cell_ids = tuple(encoder.variable_map)
    constraints = [
        Fact(10, True), Fact(10, False),
        Same(10, 30), Different(10, 30),
        Same(10, 10), Different(10, 10),
    ]
    for size in range(len(cell_ids) + 1):
        for is_criminal in (True, False):
            for comparison in Comparison:
                for count in range(-1, size + 2):
                    constraints.append(CountConstraint(
                        Count(cell_ids[:size], is_criminal), comparison, count,
                    ))

    assert_matches_truth_tables(BOARD, constraints)


def test_count_vs_count_with_overlap_duplicates_and_opposite_statuses():
    counts = [
        Count(targets, is_criminal)
        for targets in ((), (10,), (10, 30), (30, 20, 40), (10, 10, 20))
        for is_criminal in (True, False)
    ]
    assert_matches_truth_tables(BOARD, [
        CountConstraint(left, comparison, right)
        for left in counts
        for right in counts
        for comparison in Comparison
    ])


def test_parity_with_empty_and_repeated_targets():
    assert_matches_truth_tables(BOARD, [
        ParityConstraint(Count(targets, is_criminal), is_odd)
        for targets in ((), (10,), (10, 20), (10, 20, 30, 40), (10, 10, 20))
        for is_criminal in (True, False)
        for is_odd in (True, False)
    ])


def test_connected_on_lines_and_grids():
    grid = Board((
        (Cell(10, (0, 0), "", ""), Cell(20, (0, 1), "", "")),
        (Cell(30, (1, 0), "", ""), Cell(40, (1, 1), "", "")),
    ))
    constraints = [
        ConnectedConstraint(targets, is_criminal, allow_empty)
        for targets in ((), (10,), (10, 20), (10, 40), (10, 20, 30), (10, 20, 30, 40), (10, 10, 40))
        for is_criminal in (True, False)
        for allow_empty in (True, False)
    ]
    assert_matches_truth_tables(BOARD, constraints)
    assert_matches_truth_tables(grid, constraints)


def test_nested_all_of_and_auxiliary_variables_across_constraints():
    parts = (
        ParityConstraint(Count((10, 20, 30)), True),
        ParityConstraint(Count((20, 30, 40), False), False),
        ConnectedConstraint((10, 20, 30, 40), True, True),
        ConnectedConstraint((10, 20, 30, 40), False, True),
    )
    assert_matches_truth_tables(BOARD, [
        AllOf(()),
        AllOf(parts),
        AllOf((AllOf(parts[:2]), AllOf(parts[2:]), Fact(10))),
        AllOf((Fact(10), Fact(10, False))),
    ])
