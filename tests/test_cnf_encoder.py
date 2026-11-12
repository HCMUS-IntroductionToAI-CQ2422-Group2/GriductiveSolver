from itertools import product

from BackEnd.GameEngine.BruteForceChecker import evaluate_constraint
from BackEnd.GameEngine.GameObject.constraints import (
    Comparison,
    Count,
    CountConstraint,
    Different,
    Fact,
    Same,
)
from BackEnd.GameEngine.GameObject.objects import Board, Cell
from BackEnd.LogicAgent.cnf_encoder import CNFEncoder


BOARD = Board((tuple(Cell(cell_id, (0, column), "", "")
                     for column, cell_id in enumerate((30, 10, 40, 20))),))


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
            for comparison in (Comparison.EQ, Comparison.GE, Comparison.LE):
                for count in range(-1, size + 2):
                    constraints.append(CountConstraint(
                        Count(cell_ids[:size], is_criminal), comparison, count,
                    ))

    for constraint in constraints:
        clauses = encoder.encode_constraint(constraint)
        for values in product((False, True), repeat=len(cell_ids)):
            assignment = dict(zip(cell_ids, values))
            variable_values = {
                encoder.get_variable(cell_id): value
                for cell_id, value in assignment.items()
            }
            actual = all(
                any(variable_values[abs(literal)] == (literal > 0) for literal in clause)
                for clause in clauses
            )
            assert actual == evaluate_constraint(constraint, assignment, {}), (
                constraint, assignment, clauses,
            )
