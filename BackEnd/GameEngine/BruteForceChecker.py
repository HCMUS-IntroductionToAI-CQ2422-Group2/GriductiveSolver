"""Simple backtracking implementation of the ConstraintChecker protocol.

Intended for small boards: it searches assignments cell by cell and prunes
as soon as any revealed clue is definitely violated.
"""

from __future__ import annotations

from collections import Counter, deque
from typing import Iterator, Mapping

from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    AnyOf,
    Comparison,
    ConnectedConstraint,
    Constraint,
    Count,
    CountConstraint,
    Fact,
    Not,
    ParityConstraint,
)
from BackEnd.GameEngine.GameObject.objects import Board, Verdict
from BackEnd.GameEngine.GameState import PublicState

Assignment = Mapping[int, bool]
Positions = Mapping[int, tuple[int, int]]


def cell_positions(board: Board) -> dict[int, tuple[int, int]]:
    """Map each cell id to its (row, column) coordinates."""
    return {cell.id: cell.coordinates for row in board.cells for cell in row}


def _count_range(count: Count, assignment: Assignment) -> tuple[int, int]:
    """Return (min, max) possible value of `count` under a partial assignment."""
    known = 0
    unknown = 0
    for cell_id in count.targets:
        value = assignment.get(cell_id)
        if value is None:
            unknown += 1
        elif value == count.is_criminal:
            known += 1
    return known, known + unknown


def _compare_ranges(
    left: tuple[int, int],
    comparison: Comparison,
    right: tuple[int, int],
) -> bool | None:
    """Decide `left <comparison> right` for value ranges, or None if open."""
    a_lo, a_hi = left
    b_lo, b_hi = right
    if comparison in (Comparison.EQ, Comparison.NE):
        if a_lo == a_hi == b_lo == b_hi:
            equal: bool | None = True
        elif a_hi < b_lo or b_hi < a_lo:
            equal = False
        else:
            equal = None
        if equal is None or comparison is Comparison.EQ:
            return equal
        return not equal
    if comparison is Comparison.LT:
        if a_hi < b_lo:
            return True
        if a_lo >= b_hi:
            return False
        return None
    if comparison is Comparison.LE:
        if a_hi <= b_lo:
            return True
        if a_lo > b_hi:
            return False
        return None
    if comparison is Comparison.GT:
        return _compare_ranges(right, Comparison.LT, left)
    if comparison is Comparison.GE:
        return _compare_ranges(right, Comparison.LE, left)
    raise ValueError(f"Unknown comparison: {comparison!r}")


def _is_connected(cell_ids: set[int], positions: Positions) -> bool:
    """True if the cells form one component via orthogonal adjacency."""
    by_position = {positions[cid]: cid for cid in cell_ids if cid in positions}
    if len(by_position) != len(cell_ids):
        return False  # Some target is not on the board.
    start = next(iter(cell_ids))
    seen = {start}
    queue = deque([start])
    while queue:
        row, col = positions[queue.popleft()]
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            neighbor = by_position.get((row + dr, col + dc))
            if neighbor is not None and neighbor not in seen:
                seen.add(neighbor)
                queue.append(neighbor)
    return len(seen) == len(cell_ids)


def referenced_cells(constraint: Constraint) -> Iterator[int]:
    """Yield every cell id a constraint reads (for ordering heuristics)."""
    if isinstance(constraint, Fact):
        yield constraint.target
    elif isinstance(constraint, CountConstraint):
        yield from constraint.left.targets
        if isinstance(constraint.right, Count):
            yield from constraint.right.targets
    elif isinstance(constraint, ParityConstraint):
        yield from constraint.count.targets
    elif isinstance(constraint, ConnectedConstraint):
        yield from constraint.targets
    elif isinstance(constraint, (AllOf, AnyOf)):
        for child in constraint.constraints:
            yield from referenced_cells(child)
    elif isinstance(constraint, Not):
        yield from referenced_cells(constraint.constraint)


def order_free_cells_by_degree(
    free_cells: list[int],
    constraints: list[Constraint],
) -> list[int]:
    """Visit cells referenced by the most constraints first.

    `ParityConstraint`/`ConnectedConstraint` only resolve once every one of
    their targets is assigned, so filling in cells outside any tight
    constraint first wastes whole branches before a contradiction can even
    be detected. Degree is computed once per search (the constraint set is
    fixed for the call), not re-evaluated at every node.
    """
    degree = Counter()
    for constraint in constraints:
        degree.update(referenced_cells(constraint))
    return sorted(free_cells, key=lambda cid: degree[cid], reverse=True)


def evaluate_constraint(
    constraint: Constraint,
    assignment: Assignment,
    positions: Positions,
) -> bool | None:
    """Evaluate a constraint under a (possibly partial) assignment.

    Returns True/False when the result is already determined regardless of
    the unassigned cells, and None when it still depends on them.
    """
    if isinstance(constraint, Fact):
        value = assignment.get(constraint.target)
        if value is None:
            return None
        return value == constraint.is_criminal

    if isinstance(constraint, CountConstraint):
        left = _count_range(constraint.left, assignment)
        if isinstance(constraint.right, Count):
            right = _count_range(constraint.right, assignment)
        else:
            right = (constraint.right, constraint.right)
        return _compare_ranges(left, constraint.comparison, right)

    if isinstance(constraint, ParityConstraint):
        low, high = _count_range(constraint.count, assignment)
        if low != high:
            return None
        return (low % 2 == 1) == constraint.is_odd

    if isinstance(constraint, ConnectedConstraint):
        if any(cid not in assignment for cid in constraint.targets):
            return None
        matching = {
            cid
            for cid in constraint.targets
            if assignment[cid] == constraint.is_criminal
        }
        if not matching:
            return constraint.allow_empty
        return _is_connected(matching, positions)

    if isinstance(constraint, AllOf):
        undecided = False
        for child in constraint.constraints:
            result = evaluate_constraint(child, assignment, positions)
            if result is False:
                return False
            if result is None:
                undecided = True
        return None if undecided else True

    if isinstance(constraint, AnyOf):
        undecided = False
        for child in constraint.constraints:
            result = evaluate_constraint(child, assignment, positions)
            if result is True:
                return True
            if result is None:
                undecided = True
        return None if undecided else False

    if isinstance(constraint, Not):
        result = evaluate_constraint(constraint.constraint, assignment, positions)
        return None if result is None else not result

    raise TypeError(f"Unsupported constraint type: {type(constraint).__name__}")


class BruteForceChecker:
    """ConstraintChecker that searches all completions of the public state."""

    def has_solution(
        self,
        public_state: PublicState,
        assumption: Verdict | None = None,
    ) -> bool:
        assignment: dict[int, bool] = dict(public_state.proved_statuses)
        if assumption is not None:
            existing = assignment.get(assumption.cell_id)
            if existing is not None and existing != assumption.is_criminal:
                return False
            assignment[assumption.cell_id] = assumption.is_criminal

        positions = cell_positions(public_state.board)
        constraints = [clue.constraint for clue in public_state.revealed_clues]
        free_cells = order_free_cells_by_degree(
            [cid for cid in positions if cid not in assignment], constraints
        )
        return self._search(assignment, free_cells, 0, constraints, positions)

    def _search(
        self,
        assignment: dict[int, bool],
        free_cells: list[int],
        index: int,
        constraints: list[Constraint],
        positions: Positions,
    ) -> bool:
        complete = index == len(free_cells)
        for constraint in constraints:
            result = evaluate_constraint(constraint, assignment, positions)
            # On a complete assignment, "undecided" can only come from
            # targets outside the board; treat that as unsatisfied.
            if result is False or (complete and result is None):
                return False
        if complete:
            return True

        cell_id = free_cells[index]
        for value in (True, False):
            assignment[cell_id] = value
            if self._search(assignment, free_cells, index + 1, constraints, positions):
                del assignment[cell_id]
                return True
        del assignment[cell_id]
        return False
