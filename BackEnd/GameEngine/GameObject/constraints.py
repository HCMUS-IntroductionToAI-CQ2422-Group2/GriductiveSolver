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
class AllOf:
    constraints: tuple[Constraint, ...]


@dataclass(frozen=True)
class Fact:
    """Clue that directly determines the status of a cell (e.g., a face-up card)."""
    target: int
    is_criminal: bool = True

@dataclass(frozen=True)
class AnyOf:
    """Equivalent to logical OR: At least one inner constraint must be satisfied."""
    constraints: tuple[Constraint, ...]

@dataclass(frozen=True)
class Not:
    """Equivalent to logical NOT: The inner constraint must be false."""
    constraint: Constraint

# Nhớ cập nhật lại dòng cuối cùng này để nó bao trùm hết các type mới
Constraint = (
    Fact | CountConstraint | ParityConstraint | ConnectedConstraint | 
    AllOf | AnyOf | Not
)