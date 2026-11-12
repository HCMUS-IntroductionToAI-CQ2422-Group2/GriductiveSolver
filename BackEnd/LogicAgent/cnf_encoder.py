from itertools import combinations

from BackEnd.GameEngine.GameObject.objects import Board
from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    ConnectedConstraint,
    Constraint,
    Count,
    CountConstraint,
    Different,
    Fact,
    ParityConstraint,
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
        self.next_variable = len(self.variable_map) + 1

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
        if isinstance(constraint, CountConstraint):
            return self.encode_count(constraint)
        if isinstance(constraint, ParityConstraint):
            return self.encode_parity(constraint)
        if isinstance(constraint, ConnectedConstraint):
            return self.encode_connected(constraint)
        if isinstance(constraint, AllOf):
            return self.encode_all_of(constraint)

        raise NotImplementedError(f"Unsupported constraint: {constraint}")

    def new_variable(self) -> int:
        variable = self.next_variable
        self.next_variable += 1
        return variable

    def count_literals(self, count: Count) -> list[int]:
        sign = 1 if count.is_criminal else -1
        return [sign * self.get_variable(cell_id) for cell_id in count.targets]

    def encode_count(self, constraint: CountConstraint) -> list[list[int]]:
        literals = self.count_literals(constraint.left)
        if isinstance(constraint.right, Count):
            right = self.count_literals(constraint.right)
            # L <op> R is equivalent to L + (len(R) - R) <op> len(R).
            literals += [-literal for literal in right]
            count = len(right)
        else:
            count = constraint.right

        if constraint.comparison == Comparison.EQ:
            return self.encode_exactly(literals, count)
        if constraint.comparison == Comparison.NE:
            return self.encode_not_exactly(literals, count)
        if constraint.comparison == Comparison.GE:
            return self.encode_at_least(literals, count)
        if constraint.comparison == Comparison.GT:
            return self.encode_at_least(literals, count + 1)
        if constraint.comparison == Comparison.LE:
            return self.encode_at_most(literals, count)
        return self.encode_at_most(literals, count - 1)

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

    def encode_not_exactly(self, literals: list[int], count: int) -> list[list[int]]:
        if count < 0 or count > len(literals):
            return []
        clauses = []
        # Exclude each assignment with exactly count true literals.
        for group in combinations(range(len(literals)), count):
            selected = set(group)
            clauses.append([
                -literal if index in selected else literal
                for index, literal in enumerate(literals)
            ])
        return clauses

    def encode_parity(self, constraint: ParityConstraint) -> list[list[int]]:
        literals = self.count_literals(constraint.count)
        if not literals:
            return [[]] if constraint.is_odd else []

        clauses = []
        parity = literals[0]
        for literal in literals[1:]:
            result = self.new_variable()
            # result <=> parity XOR literal.
            clauses.extend([
                [parity, literal, -result],
                [-parity, -literal, -result],
                [parity, -literal, result],
                [-parity, literal, result],
            ])
            parity = result
        clauses.append([parity if constraint.is_odd else -parity])
        return clauses

    def encode_connected(self, constraint: ConnectedConstraint) -> list[list[int]]:
        targets = list(dict.fromkeys(constraint.targets))
        selected = self.count_literals(Count(tuple(targets), constraint.is_criminal))
        if not targets:
            return [] if constraint.allow_empty else [[]]

        positions = {cell.id: cell.coordinates for row in self.board.cells for cell in row}
        by_position = {positions[cell_id]: index for index, cell_id in enumerate(targets)}
        neighbors = []
        for cell_id in targets:
            row, col = positions[cell_id]
            neighbors.append([
                by_position[position]
                for position in ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1))
                if position in by_position
            ])

        clauses = [] if constraint.allow_empty else [selected.copy()]
        reached = [self.new_variable() for _ in targets]
        # The first selected cell is the unique root.
        for index, (literal, root) in enumerate(zip(selected, reached)):
            clauses.append([-root, literal])
            clauses.extend([-root, -earlier] for earlier in selected[:index])
            clauses.append([root, -literal, *selected[:index]])

        # After n - 1 steps, every selected cell must be reachable from the root.
        for _ in range(len(targets) - 1):
            next_reached = [self.new_variable() for _ in targets]
            for index, literal in enumerate(selected):
                result = next_reached[index]
                previous = [reached[index], *(reached[neighbor] for neighbor in neighbors[index])]
                clauses.append([-result, literal])
                clauses.append([-result, *previous])
                clauses.extend([-literal, -source, result] for source in previous)
            reached = next_reached
        clauses.extend([-literal, result] for literal, result in zip(selected, reached))
        return clauses

    def encode_all_of(self, constraint: AllOf) -> list[list[int]]:
        return [
            clause
            for part in constraint.constraints
            for clause in self.encode_constraint(part)
        ]
