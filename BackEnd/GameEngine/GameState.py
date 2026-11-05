from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping

from BackEnd.GameEngine.GameObject.objects import Board, Clue


@dataclass
class GameState:
    proved_statuses: dict[int, bool] = field(default_factory=dict)


@dataclass(frozen=True)
class PublicState:
    puzzle_id: str
    board: Board
    revealed_clues: tuple[Clue, ...]
    proved_statuses: Mapping[int, bool]

    @property
    def is_complete(self) -> bool:
        raise NotImplementedError
