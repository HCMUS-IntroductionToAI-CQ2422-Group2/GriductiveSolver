"""Shared builders for tests."""

from BackEnd.GameEngine.GameObject.objects import Board, Cell, Clue
from BackEnd.GameEngine.GameState import PublicState


def make_board(height: int, width: int) -> Board:
    """Board with ids numbered row-major from 0: id = row * width + col."""
    return Board(
        cells=tuple(
            tuple(
                Cell(
                    id=r * width + c,
                    coordinates=(r, c),
                    character_name=f"P{r * width + c}",
                    profession="none",
                )
                for c in range(width)
            )
            for r in range(height)
        )
    )


def make_clue(clue_id: int, constraint, source_cell_id=None) -> Clue:
    return Clue(
        id=clue_id,
        source_cell_id=source_cell_id,
        constraint=constraint,
        description_nl=f"clue {clue_id}",
    )


def make_public_state(board: Board, clues=(), proved=None) -> PublicState:
    return PublicState(
        puzzle_id="test",
        board=board,
        revealed_clues=tuple(clues),
        proved_statuses=dict(proved or {}),
    )
