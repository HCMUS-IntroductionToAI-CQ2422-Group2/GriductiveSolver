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
    Clue(9, 4, Fact(0, False),
         "An (A1), người ngay phía trên Giang (A2), vô tội."),
    Clue(10, 6, CountConstraint(Count((1, 2, 3, 5, 7, 9, 10, 11)), Comparison.EQ, 2),
         "Trong các hàng xóm của Hùng (C2) (kể cả đường chéo) có đúng hai tội phạm."),
    Clue(11, 8, Fact(4, False),
         "Giang (A2), người ngay phía trên Lan (A3), vô tội."),
    Clue(12, 9, CountConstraint(Count((4, 5, 6, 8, 10, 12, 13, 14)), Comparison.EQ, 3),
         "Trong các hàng xóm của Long (B3) (kể cả đường chéo) có đúng ba tội phạm."),
    Clue(13, 11, Fact(7, False),
         "Khoa (D2), người ngay phía trên Minh (D3), vô tội."),
    Clue(14, 13, CountConstraint(Count((12, 13, 14, 15)), Comparison.EQ, 1),
         "Hàng 4 có đúng một tội phạm."),
    Clue(15, 14, Fact(13, False),
         "Ngọc (B4), người ngay bên trái Oanh (C4), vô tội."),
    Clue(16, 15, Fact(11, False),
         "Minh (D3), người ngay phía trên Phúc (D4), vô tội."),
)

PUZZLE = PuzzleDefinition(
    id="medium-4x4-theatre",
    board=make_board(4),
    clues=CLUES,
    solution=tuple(Verdict(i, i in CRIMINALS) for i in range(16)),
    initial_verdicts=(Verdict(3, False),),
)
