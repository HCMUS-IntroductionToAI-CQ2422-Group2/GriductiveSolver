from __future__ import annotations

from dataclasses import dataclass

from BackEnd.GameEngine.GameObject.constraints import Constraint


@dataclass(frozen=True)
class Cell:
    id: int
    coordinates: tuple[int, int]  # Zero-based (row, column).
    character_name: str
    profession: str


@dataclass(frozen=True)
class Board:
    cells: tuple[tuple[Cell, ...], ...]

    @property
    def height(self) -> int:
        raise NotImplementedError

    @property
    def width(self) -> int:
        raise NotImplementedError

    @property
    def cell_count(self) -> int:
        raise NotImplementedError


@dataclass(frozen=True)
class Verdict:
    cell_id: int
    is_criminal: bool


@dataclass(frozen=True)
class Clue:
    id: int
    source_cell_id: int | None  # None means a public starting clue.
    constraint: Constraint
    description_nl: str


@dataclass(frozen=True)
class PuzzleDefinition:
    id: str
    board: Board
    clues: tuple[Clue, ...]
    solution: tuple[Verdict, ...]
    initial_verdicts: tuple[Verdict, ...]
