from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Comparison(Enum):
    EQ = "=="
    NE = "!="
    LT = "<"
    LE = "<="
    GT = ">"
    GE = ">="


@dataclass(frozen=True)
class Count:
    targets: tuple[int, ...]
    is_criminal: bool = True


@dataclass(frozen=True)
class CountConstraint:
    left: Count
    comparison: Comparison
    right: int | Count


@dataclass(frozen=True)
class ParityConstraint:
    count: Count
    is_odd: bool


@dataclass(frozen=True)
class ConnectedConstraint:
    """Matching cells form one component through orthogonal edges."""

    targets: tuple[int, ...]
    is_criminal: bool
    allow_empty: bool = False


@dataclass(frozen=True)
class Fact:
    """A cell has the given status."""

    target: int
    is_criminal: bool = True


@dataclass(frozen=True)
class Same:
    """Two cells have the same status."""

    cell_id_1: int
    cell_id_2: int


@dataclass(frozen=True)
class Different:
    """Two cells have different statuses."""

    cell_id_1: int
    cell_id_2: int


@dataclass(frozen=True)
class AllOf:
    """Compound clue whose parts must all hold."""

    constraints: tuple[Constraint, ...]


Constraint = (
    Fact
    | Same
    | Different
    | CountConstraint
    | ParityConstraint
    | ConnectedConstraint
    | AllOf
)


def referenced_cell_ids(constraint: Constraint) -> set[int]:
    if isinstance(constraint, Fact):
        return {constraint.target}
    if isinstance(constraint, (Same, Different)):
        return {constraint.cell_id_1, constraint.cell_id_2}
    if isinstance(constraint, CountConstraint):
        targets = set(constraint.left.targets)
        if isinstance(constraint.right, Count):
            targets.update(constraint.right.targets)
        return targets
    if isinstance(constraint, ParityConstraint):
        return set(constraint.count.targets)
    if isinstance(constraint, ConnectedConstraint):
        return set(constraint.targets)
    if isinstance(constraint, AllOf):
        return {
            cell_id
            for part in constraint.constraints
            for cell_id in referenced_cell_ids(part)
        }
    raise TypeError(f"Unsupported constraint type: {type(constraint).__name__}")
