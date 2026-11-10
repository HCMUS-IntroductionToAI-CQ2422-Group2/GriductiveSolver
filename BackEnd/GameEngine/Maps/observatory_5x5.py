"""Expert: narrow deduction gates, connectivity, parity and overlapping counts.

Lan starts cleared. Initially only C1 is forced: every three-cell run in the first
row contains its centre. Its testimony forces C2 before the remaining first
two rows can be resolved. A second parity/connection gate controls rows 3/4;
the final pair-count comparison forces C5 and unlocks the last clue.
"""

from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    ConnectedConstraint,
    Count,
    CountConstraint,
    Different,
    ParityConstraint,
    Same,
)
from BackEnd.GameEngine.GameObject.objects import Clue, PuzzleDefinition, Verdict

from .common import make_board


DIFFICULTY = "expert"
CRIMINALS = {2, 3, 4, 6, 9, 11, 12, 13, 15, 19, 21, 22, 24}

PUZZLE = PuzzleDefinition(
    id="expert-5x5-observatory",
    board=make_board(5),
    initial_verdicts=(Verdict(8, False),),
    solution=tuple(Verdict(cell_id, cell_id in CRIMINALS) for cell_id in range(25)),
    clues=(
        Clue(1, 8, AllOf((
            CountConstraint(Count((0, 1, 2, 3, 4)), Comparison.EQ, 3),
            ConnectedConstraint((0, 1, 2, 3, 4), is_criminal=True),
        )), "Hàng 1 có đúng ba tội phạm, đứng ở ba ô liên tiếp nhau, không có người vô tội xen giữa."),
        Clue(3, 2, AllOf((
            Different(1, 3),
            Same(0, 5),
            Same(4, 6),
            CountConstraint(Count((5, 6, 7)), Comparison.EQ, 1),
        )), "B1 và D1 khác trạng thái. A1 cùng trạng thái với A2; E1 cùng trạng thái với B2. Trong A2, B2, C2 có đúng một tội phạm."),
        Clue(4, 7, AllOf((
            CountConstraint(Count((5, 6, 7, 8, 9)), Comparison.EQ, 2),
            Same(5, 8),
            ParityConstraint(Count((5, 8, 9)), is_odd=True),
        )), "Hàng 2 có đúng hai tội phạm. A2 và D2 cùng trạng thái. Số tội phạm trong A2, D2, E2 là số lẻ."),
        Clue(5, 4, AllOf((
            CountConstraint(Count((10, 11, 12, 13, 14)), Comparison.EQ, Count((0, 1, 2, 3, 4))),
            ConnectedConstraint((10, 11, 12, 13, 14), is_criminal=True),
        )), "Hàng 3 có số tội phạm bằng hàng 1. Họ đứng ở các ô liên tiếp trong hàng 3, không có người vô tội xen giữa."),
        Clue(6, 12, AllOf((
            ParityConstraint(Count((10, 11, 14)), is_odd=True),
            Same(11, 15),
            Same(14, 16),
            CountConstraint(Count((15, 16, 17)), Comparison.EQ, 1),
        )), "Số tội phạm trong A3, B3, E3 là số lẻ. B3 cùng trạng thái với A4; E3 cùng trạng thái với B4. Trong A4, B4, C4 có đúng một tội phạm."),
        Clue(7, 17, AllOf((
            CountConstraint(Count((15, 16, 17, 18, 19)), Comparison.EQ, Count((5, 6, 7, 8, 9))),
            Same(15, 19),
            ParityConstraint(Count((15, 18, 19)), is_odd=False),
        )), "Hàng 4 và hàng 2 có số tội phạm bằng nhau. A4 và E4 cùng trạng thái. Số tội phạm trong A4, D4, E4 là số chẵn (có thể bằng 0)."),
        Clue(8, 15, CountConstraint(Count((20, 21, 22, 23, 24)), Comparison.EQ, Count((0, 1, 2, 3, 4))),
             "Hàng 5 có số tội phạm bằng hàng 1."),
        Clue(9, 19, CountConstraint(Count((20, 21)), Comparison.EQ, Count((23, 24))),
             "Trong A5 và B5 có số tội phạm bằng trong D5 và E5."),
        Clue(10, 22, AllOf((
            Same(20, 23),
            CountConstraint(Count((20, 23)), Comparison.LT, Count((21, 24))),
        )), "A5 và D5 cùng trạng thái. Trong A5 và D5 có ít tội phạm hơn trong B5 và E5."),
    ),
)
