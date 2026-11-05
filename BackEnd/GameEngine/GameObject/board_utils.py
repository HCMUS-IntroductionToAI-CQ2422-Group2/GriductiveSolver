from __future__ import annotations

from BackEnd.GameEngine.GameObject.objects import Board


def row_ids(board: Board, row: int) -> tuple[int, ...]:
    raise NotImplementedError


def column_ids(board: Board, column: int) -> tuple[int, ...]:
    raise NotImplementedError


def neighbor_ids(board: Board, cell_id: int) -> tuple[int, ...]:
    """Include diagonal neighbors and exclude the source cell."""
    raise NotImplementedError


def profession_ids(board: Board, profession: str) -> tuple[int, ...]:
    raise NotImplementedError
