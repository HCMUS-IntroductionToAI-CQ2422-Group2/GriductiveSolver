"""Medium: An opens a four-wave chain of row budgets and overlapping groups."""

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

CRIMINALS = {1, 3, 6, 8, 13, 14}

CLUES = (
    Clue(
        id=1,
        source_cell_id=0,
        constraint=AllOf((
            Fact(2, False),
            Fact(4, False),
        )),
        description_nl=(
            "Chi (C1) và Giang (A2) đều vô tội."
        ),
    ),
    Clue(
        id=2,
        source_cell_id=2,
        constraint=AllOf((
            CountConstraint(Count((1, 3)), Comparison.EQ, 2),
            CountConstraint(
                Count((0, 1, 2, 3)),
                Comparison.EQ,
                Count((12, 13, 14, 15)),
            ),
        )),
        description_nl=(
            "Bình (B1) và Dũng (D1) đều là tội phạm. "
            "Hàng 1 và hàng 4 có số tội phạm bằng nhau."
        ),
    ),
    Clue(
        id=3,
        source_cell_id=4,
        constraint=AllOf((
            Fact(12, False),
            CountConstraint(Count((0, 4, 8, 12)), Comparison.EQ, 1),
        )),
        description_nl=(
            "Nam (A4) vô tội. Cột A có đúng một tội phạm."
        ),
    ),
    Clue(
        id=4,
        source_cell_id=12,
        constraint=AllOf((
            Fact(15, False),
            ParityConstraint(Count((8, 9, 13)), is_odd=False),
        )),
        description_nl=(
            "Phúc (D4) vô tội. "
            "Trong Lan (A3), Long (B3) và Ngọc (B4), số tội phạm là số chẵn."
        ),
    ),
    Clue(
        id=5,
        source_cell_id=8,
        constraint=AllOf((
            Fact(6, True),
            Same(7, 11),
        )),
        description_nl=(
            "Hùng (C2) là tội phạm. "
            "Khoa (D2) và Minh (D3) hoặc cùng vô tội, hoặc cùng là tội phạm."
        ),
    ),
    Clue(
        id=6,
        source_cell_id=14,
        constraint=AllOf((
            Fact(10, False),
            CountConstraint(Count((3, 7, 11, 15)), Comparison.EQ, 1),
        )),
        description_nl=(
            "Mai (C3) vô tội. Cột D có đúng một tội phạm."
        ),
    ),
    Clue(
        id=7,
        source_cell_id=6,
        constraint=Fact(5, False),
        description_nl=(
            "Hà (B2) vô tội."
        ),
    ),
)

PUZZLE = PuzzleDefinition(
    id="medium-4x4-harbor",
    board=make_board(4),
    clues=CLUES,
    solution=tuple(Verdict(i, i in CRIMINALS) for i in range(16)),
    initial_verdicts=(Verdict(0, False),),
)
