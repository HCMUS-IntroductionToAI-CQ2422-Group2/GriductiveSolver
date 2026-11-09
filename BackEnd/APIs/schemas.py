from typing import Literal

from pydantic import BaseModel, StrictBool, StrictInt

from BackEnd.GameEngine.GameEngine import SubmitOutcome
from BackEnd.GameEngine.GameObject.constraints import referenced_cell_ids
from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.GameState import PublicState


class CellResponse(BaseModel):
    id: int
    row: int
    column: int
    character_name: str
    profession: str
    is_criminal: bool | None


class ClueResponse(BaseModel):
    id: int
    source_cell_id: int | None
    description_nl: str
    referenced_cell_ids: list[int]


class PublicStateResponse(BaseModel):
    puzzle_id: str
    height: int
    width: int
    cells: list[CellResponse]
    revealed_clues: list[ClueResponse]
    is_complete: bool


class LoadRequest(BaseModel):
    puzzle_id: str


class VerdictRequest(BaseModel):
    cell_id: StrictInt
    is_criminal: StrictBool


class VerdictResponse(BaseModel):
    outcome: SubmitOutcome
    state: PublicStateResponse


class SatQuery(BaseModel):
    assumption: Verdict | None
    satisfiable: bool


class HintResponse(BaseModel):
    status: Literal["FOUND", "UNKNOWN", "SOLVED", "INCONSISTENT"]
    verdict: Verdict | None = None
    sat_queries: list[SatQuery]


class DeductionStep(BaseModel):
    step: int
    active_clue_ids: list[int]
    sat_queries: list[SatQuery]
    verdict: Verdict
    revealed_clue_ids: list[int]


class AutoSolveResponse(BaseModel):
    status: Literal["SOLVED", "STUCK", "INCONSISTENT"]
    state: PublicStateResponse
    trace: list[DeductionStep]


def to_public_json(state: PublicState) -> dict[str, object]:
    cells = [
        {
            "id": cell.id,
            "row": cell.coordinates[0],
            "column": cell.coordinates[1],
            "character_name": cell.character_name,
            "profession": cell.profession,
            "is_criminal": state.proved_statuses.get(cell.id),
        }
        for row in state.board.cells
        for cell in row
    ]

    return {
        "puzzle_id": state.puzzle_id,
        "height": state.board.height,
        "width": state.board.width,
        "cells": cells,
        "revealed_clues": [
            {
                "id": clue.id,
                "source_cell_id": clue.source_cell_id,
                "description_nl": clue.description_nl,
                "referenced_cell_ids": sorted(
                    referenced_cell_ids(clue.constraint)
                ),
            }
            for clue in state.revealed_clues
        ],
        "is_complete": all(
            cell["is_criminal"] is not None for cell in cells
        ),
    }
