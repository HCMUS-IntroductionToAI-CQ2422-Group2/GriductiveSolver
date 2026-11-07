from __future__ import annotations

from BackEnd.GameEngine.GameObject.objects import Board


def row_ids(board: Board, row: int) -> tuple[int, ...]:
    res = []
    for item in board.cells[row]:
        res.append(item.id)

    return tuple(res)


def column_ids(board: Board, column: int) -> tuple[int, ...]:
    return tuple(row[column].id for row in board.cells)


def neighbor_ids(board: Board, cell_id: int) -> tuple[int, ...]:
    """Include diagonal neighbors and exclude the source cell."""
    for row_index, row in enumerate(board.cells):
        for column_index, cell in enumerate(row):
            if cell.id == cell_id:
                return tuple(
                    neighbor.id
                    for neighbor_row in board.cells[max(0, row_index - 1):row_index + 2]
                    for neighbor in neighbor_row[max(0, column_index - 1):column_index + 2]
                    if neighbor.id != cell_id
                )
    raise ValueError(f"Cell ID {cell_id} is not on the board")


def profession_ids(board: Board, profession: str) -> tuple[int, ...]:
    return tuple(
        cell.id
        for row in board.cells
        for cell in row
        if cell.profession == profession
    )
