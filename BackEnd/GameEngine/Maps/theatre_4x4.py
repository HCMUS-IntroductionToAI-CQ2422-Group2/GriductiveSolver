"""Medium: Dũng opens the case; an adjacent pair eventually forces the L-shape elbow."""

from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    ConnectedConstraint,
    Count,
    CountConstraint,
    Fact,
    Same,
)
from BackEnd.GameEngine.GameObject.objects import Clue, PuzzleDefinition, Verdict
from .common import make_board

DIFFICULTY = "medium"

CRIMINALS = {2, 5, 6, 12}

CLUES = (
    Clue(
        id=1,
        source_cell_id=3,
        constraint=CountConstraint(Count((3, 7, 11, 15)), Comparison.EQ, 0),
        description_nl=(
            "Không có tội phạm nào trong cột D."
        ),
    ),
    Clue(
        id=2,
        source_cell_id=7,
        constraint=CountConstraint(Count((0, 1)), Comparison.EQ, 0),
        description_nl=(
            "An (A1) và Bình (B1) đều vô tội."
        ),
    ),
    Clue(
        id=3,
        source_cell_id=0,
        constraint=AllOf((
            CountConstraint(Count((4, 8)), Comparison.EQ, 0),
            Same(2, 12),
        )),
        description_nl=(
            "Giang (A2) và Lan (A3) đều vô tội. "
            "Chi (C1) và Nam (A4) hoặc cùng vô tội, hoặc cùng là tội phạm."
        ),
    ),
    Clue(
        id=4,
        source_cell_id=1,
        constraint=CountConstraint(Count((0, 4, 8, 12)), Comparison.EQ, 1),
        description_nl=(
            "Cột A có đúng một tội phạm."
        ),
    ),
    Clue(
        id=5,
        source_cell_id=12,
        constraint=CountConstraint(Count((13, 14)), Comparison.EQ, 0),
        description_nl=(
            "Ngọc (B4) và Oanh (C4) đều vô tội."
        ),
    ),
    Clue(
        id=6,
        source_cell_id=2,
        constraint=Fact(10, False),
        description_nl=(
            "Mai (C3) vô tội."
        ),
    ),
    Clue(
        id=7,
        source_cell_id=10,
        constraint=AllOf((
            CountConstraint(Count((5, 6, 9)), Comparison.EQ, 2),
            ConnectedConstraint(targets=(5, 6, 9), is_criminal=True),
        )),
        description_nl=(
            "Trong Hà (B2), Hùng (C2) và Long (B3), có đúng hai tội phạm. "
            "Hai người đó ở hai ô chung cạnh, không tính đường chéo."
        ),
    ),
    Clue(
        id=8,
        source_cell_id=5,
        constraint=CountConstraint(Count((2, 6, 10, 14)), Comparison.EQ, 2),
        description_nl="Cột C có đúng hai tội phạm.",
    ),
)

PUZZLE = PuzzleDefinition(
    id="medium-4x4-theatre",
    board=make_board(4),
    clues=CLUES,
    solution=tuple(Verdict(i, i in CRIMINALS) for i in range(16)),
    initial_verdicts=(Verdict(3, False),),
)
