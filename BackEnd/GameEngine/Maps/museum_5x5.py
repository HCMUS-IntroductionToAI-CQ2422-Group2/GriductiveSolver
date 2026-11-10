"""Medium: a testimony chain using overlapping counts and status relations.

Long starts cleared and supplies the first lead. Later rows require combining
testimony from several proved characters.
"""

from BackEnd.GameEngine.GameObject.constraints import (
    AllOf,
    Comparison,
    Count,
    CountConstraint,
    Different,
    Same,
)
from BackEnd.GameEngine.GameObject.objects import Clue, PuzzleDefinition, Verdict

from .common import make_board


DIFFICULTY = "medium"
CRIMINALS = {1, 3, 5, 8, 11, 12, 15, 17, 19, 21, 24}

PUZZLE = PuzzleDefinition(
    id="medium-5x5-museum",
    board=make_board(5),
    initial_verdicts=(Verdict(9, False),),
    solution=tuple(Verdict(cell_id, cell_id in CRIMINALS) for cell_id in range(25)),
    clues=(
        Clue(1, 9, CountConstraint(Count((0, 2, 4)), Comparison.EQ, 0),
             "An (A1), Chi (C1) và Giang (E1) đều vô tội."),
        Clue(2, 0, AllOf((
            CountConstraint(Count((5, 6, 7, 8, 9)), Comparison.EQ, Count((0, 1, 2, 3, 4))),
            Same(6, 7),
        )), "Hàng 2 có số tội phạm bằng hàng 1. B2 và C2 có cùng trạng thái: hoặc cả hai là tội phạm, hoặc cả hai vô tội."),
        Clue(3, 2, Different(5, 6),
             "Trong A2 và B2, đúng một người là tội phạm."),
        Clue(4, 4, Same(6, 9),
             "B2 và E2 hoặc cùng vô tội, hoặc cùng là tội phạm."),
        Clue(5, 5, CountConstraint(Count((0, 1, 2, 3, 4)), Comparison.EQ, 2),
             "Hàng 1 có đúng hai tội phạm."),
        Clue(6, 6, CountConstraint(Count((10, 11, 12)), Comparison.EQ, 2),
             "Trong A3, B3 và C3 có đúng hai tội phạm."),
        Clue(7, 7, AllOf((Different(10, 11), Same(11, 12))),
             "A3 và B3 khác trạng thái; B3 và C3 cùng trạng thái."),
        Clue(8, 8, CountConstraint(Count((10, 11, 12, 13, 14)), Comparison.EQ, Count((5, 6, 7, 8, 9))),
             "Hàng 3 và hàng 2 có số tội phạm bằng nhau."),
        Clue(9, 10, CountConstraint(
            Count((15, 16, 17, 18, 19)), Comparison.EQ,
            Count((10, 11, 12, 13, 14), is_criminal=False),
        ), "Số tội phạm ở hàng 4 bằng số người vô tội ở hàng 3."),
        Clue(10, 11, Same(15, 17),
             "A4 và C4 cùng trạng thái."),
        Clue(11, 12, AllOf((Same(17, 19), Different(15, 16))),
             "C4 và E4 cùng trạng thái. A4 và B4 khác trạng thái."),
        Clue(12, 15, CountConstraint(
            Count((20, 21, 22, 23, 24)), Comparison.EQ,
            Count((15, 16, 17, 18, 19), is_criminal=False),
        ), "Số tội phạm ở hàng 5 bằng số người vô tội ở hàng 4."),
        Clue(13, 16, Same(20, 22),
             "A5 và C5 cùng trạng thái."),
        Clue(14, 17, Different(21, 22),
             "B5 và C5 khác trạng thái."),
        Clue(15, 18, CountConstraint(Count((21, 23, 24)), Comparison.EQ, 2),
             "Trong B5, D5 và E5 có đúng hai tội phạm."),
        Clue(16, 19, Different(21, 23),
             "B5 và D5 khác trạng thái."),
    ),
)
