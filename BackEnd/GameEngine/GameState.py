from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping

from BackEnd.GameEngine.GameObject.objects import Board, Clue


@dataclass
class GameState:
    proved_statuses: dict[int, bool] = field(default_factory=dict)
    # Ids of clues unlocked during play (clues with a source cell).
    # Public starting clues (source_cell_id is None) are always visible
    # and are not stored here.
    revealed_clue_ids: set[int] = field(default_factory=set)


@dataclass(frozen=True)
class PublicState:
    puzzle_id: str
    board: Board
    revealed_clues: tuple[Clue, ...]
    proved_statuses: Mapping[int, bool]

    @property
    def is_complete(self) -> bool:
        return len(self.proved_statuses) == self.board.cell_count
