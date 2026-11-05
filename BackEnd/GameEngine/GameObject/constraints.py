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


Constraint = (
    CountConstraint
    | ParityConstraint
    | ConnectedConstraint
    | AllOf
)
