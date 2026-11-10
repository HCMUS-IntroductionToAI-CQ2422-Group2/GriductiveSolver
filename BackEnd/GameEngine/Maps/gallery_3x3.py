"""Medium: Bình opens a four-wave chain through column counts and row parity."""

from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    Count,
    CountConstraint,
    Fact,
    ParityConstraint,
    Same,
)
from BackEnd.GameEngine.GameObject.objects import Clue, PuzzleDefinition, Verdict
from .common import make_board

DIFFICULTY = "medium"

CRIMINALS = {2, 3, 4, 8}

CLUES = (
    Clue(
        id=1,
        source_cell_id=1,
        constraint=AllOf((
            Fact(0, False),
            Fact(6, False),
        )),
        description_nl=(
            "An (A1) và Hùng (A3) đều vô tội."
        ),
    ),
    Clue(
        id=2,
        source_cell_id=0,
        constraint=AllOf((
            CountConstraint(Count((0, 3, 6)), Comparison.EQ, 1),
            Same(2, 8),
        )),
        description_nl=(
            "Cột A có đúng một tội phạm. "
            "Chi (C1) và Lan (C3) hoặc cùng vô tội, hoặc cùng là tội phạm."
        ),
    ),
    Clue(
        id=3,
        source_cell_id=6,
        constraint=AllOf((
            Fact(7, False),
            ParityConstraint(Count((3, 4, 5)), is_odd=False),
        )),
        description_nl=(
            "Khoa (B3) vô tội. Số tội phạm ở hàng 2 là số chẵn."
        ),
    ),
    Clue(
        id=4,
        source_cell_id=3,
        constraint=Fact(5, False),
        description_nl=(
            "Hà (C2) vô tội."
        ),
    ),
    Clue(
        id=5,
        source_cell_id=4,
        constraint=Fact(2, True),
        description_nl=(
            "Chi (C1) là tội phạm."
        ),
    ),
)

PUZZLE = PuzzleDefinition(
    id="medium-3x3-gallery",
    board=make_board(3),
    clues=CLUES,
    solution=tuple(Verdict(i, i in CRIMINALS) for i in range(9)),
    initial_verdicts=(Verdict(1, False),),
)
