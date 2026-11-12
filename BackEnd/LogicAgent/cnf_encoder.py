from itertools import combinations

from BackEnd.GameEngine.GameObject.objects import Board
from BackEnd.GameEngine.GameObject.constraints import (
    Comparison,
    Constraint,
    CountConstraint,
    Different,
    Fact,
    Same,
)


class CNFEncoder:
    def __init__(self, board:Board) -> None:
        self.board = board
        cell_ids = [
            cell.id
            for row in board.cells
            for cell in row
        ]
        self.variable_map = {
            cell_id: index
            for index, cell_id in enumerate(
                sorted(cell_ids), start=1
            )
        }

    def get_variable(self, cell_id: int) -> int:
        if cell_id not in self.variable_map:
            raise ValueError(f"Unknown cell ID: {cell_id}")

        return self.variable_map[cell_id]

    def encode_constraint(
        self,
        constraint: Constraint
    ) -> list[list[int]]:

        if isinstance(constraint, Fact):
            return self.encode_fact(constraint)
        if isinstance(constraint, Same):
            return self.encode_same(constraint)
        if isinstance(constraint, Different):
            return self.encode_different(constraint)
        if isinstance(constraint, CountConstraint) and isinstance(constraint.right, int):
            # Positive literals count criminals; negative literals count innocents.
            sign = 1 if constraint.left.is_criminal else -1
            literals = [
                sign * self.get_variable(cell_id)
                for cell_id in constraint.left.targets
            ]
            if constraint.comparison == Comparison.EQ:
                return self.encode_exactly(literals, constraint.right)
            if constraint.comparison == Comparison.GE:
                return self.encode_at_least(literals, constraint.right)
            if constraint.comparison == Comparison.LE:
                return self.encode_at_most(literals, constraint.right)

        raise NotImplementedError(f"Unsupported constraint: {constraint}")

    def encode_fact(self, constraint: Fact) -> list[list[int]]:
        variable = self.get_variable(constraint.target)
        return [[variable if constraint.is_criminal else -variable]]

    def encode_same(self, constraint: Same) -> list[list[int]]:
        left = self.get_variable(constraint.cell_id_1)
        right = self.get_variable(constraint.cell_id_2)
        return [[-left, right], [left, -right]]

    def encode_different(self, constraint: Different) -> list[list[int]]:
        left = self.get_variable(constraint.cell_id_1)
        right = self.get_variable(constraint.cell_id_2)
        return [[left, right], [-left, -right]]

    def encode_exactly(self, literals: list[int], count: int) -> list[list[int]]:
        return self.encode_at_least(literals, count) + self.encode_at_most(literals, count)

    def encode_at_least(self, literals: list[int], count: int) -> list[list[int]]:
        if count <= 0:
            return []
        if count > len(literals):
            return [[]]
        # Every group of n - count + 1 literals must contain a true literal.
        return [list(group) for group in combinations(literals, len(literals) - count + 1)]

    def encode_at_most(self, literals: list[int], count: int) -> list[list[int]]:
        if count < 0:
            return [[]]
        if count >= len(literals):
            return []
        # No group of count + 1 literals can all be true.
        return [
            [-literal for literal in group]
            for group in combinations(literals, count + 1)
        ]
