"""Medium: An opens a three-wave chain of counts, relations and corner parity."""

from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    Count,
    CountConstraint,
    Different,
    Fact,
    ParityConstraint,
    Same,
)
from BackEnd.GameEngine.GameObject.objects import Clue, PuzzleDefinition, Verdict
from .common import make_board

DIFFICULTY = "medium"

CRIMINALS = {1, 4, 6, 8}

CLUES = (
    Clue(
        id=1,
        source_cell_id=0,
        constraint=AllOf((
            Fact(3, False),
            Fact(2, False),
        )),
        description_nl=(
            "Dũng (A2) và Chi (C1) đều vô tội."
        ),
    ),
    Clue(
        id=2,
        source_cell_id=3,
        constraint=AllOf((
            CountConstraint(Count((0, 1, 2)), Comparison.EQ, 1),
            Same(1, 4),
        )),
        description_nl=(
            "Hàng 1 có đúng một tội phạm. "
            "Bình (B1) và Giang (B2) hoặc cùng vô tội, hoặc cùng là tội phạm."
        ),
    ),
    Clue(
        id=3,
        source_cell_id=2,
        constraint=AllOf((
            Fact(5, False),
            Different(5, 8),
        )),
        description_nl=(
            "Hà (C2) vô tội. Trong Hà (C2) và Lan (C3), đúng một người là tội phạm."
        ),
    ),
    Clue(
        id=4,
        source_cell_id=1,
        constraint=Fact(7, False),
        description_nl=(
            "Khoa (B3) vô tội."
        ),
    ),
    Clue(
        id=5,
        source_cell_id=4,
        constraint=ParityConstraint(Count((0, 2, 6, 8)), is_odd=False),
        description_nl=(
            "Số tội phạm ở bốn góc A1, C1, A3 và C3 là số chẵn."
        ),
    ),
)

PUZZLE = PuzzleDefinition(
    id="medium-3x3-market",
    board=make_board(3),
    clues=CLUES,
    solution=tuple(Verdict(i, i in CRIMINALS) for i in range(9)),
    initial_verdicts=(Verdict(0, False),),
)
