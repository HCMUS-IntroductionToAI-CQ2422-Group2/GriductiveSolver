from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.constraints import (
    Comparison,
    Count,
    CountConstraint,
    Different,
    Fact,
    Same,
)
from BackEnd.GameEngine.GameObject.objects import Board, Cell, PuzzleDefinition, Verdict
from BackEnd.LogicAgent.dpll_checker import DPLLChecker
from tests.helpers import make_board, make_clue, make_public_state


def test_checker_uses_encoder_mapping_for_verdicts_and_temporary_assumptions():
    board = Board(((Cell(20, (0, 0), "An", ""), Cell(10, (0, 1), "Bình", "")),))
    state = make_public_state(
        board,
        clues=(make_clue(1, Different(20, 10), source_cell_id=20),),
        proved={20: False},
    )
    checker = DPLLChecker()

    assert not checker.has_solution(state, Verdict(10, False))
    assert checker.has_solution(state, Verdict(10, True))
    assert not checker.has_solution(state, Verdict(20, True))
    assert checker.has_solution(state)
    assert state.proved_statuses == {20: False}


def test_checker_preserves_empty_clause_from_encoder():
    impossible = CountConstraint(Count((0,)), Comparison.GE, 2)
    state = make_public_state(make_board(1, 1), clues=(make_clue(1, impossible),))

    assert not DPLLChecker().has_solution(state)


def test_checker_uses_only_clues_revealed_at_each_step():
    puzzle = PuzzleDefinition(
        id="dpll-reveal-chain",
        board=make_board(1, 3),
        clues=(
            make_clue(1, Different(0, 1), source_cell_id=0),
            make_clue(2, Same(1, 2), source_cell_id=1),
            make_clue(3, Fact(0, False), source_cell_id=2),
        ),
        solution=(Verdict(0, False), Verdict(1, True), Verdict(2, True)),
        initial_verdicts=(Verdict(0, False),),
    )
    checker = DPLLChecker()
    engine = GameEngine(puzzle, checker)

    assert checker.has_solution(engine.get_public_state(), Verdict(2, False))
    assert tuple(clue.id for clue in engine.get_public_state().revealed_clues) == (1,)
    first = engine.submit_verdict(1, True)
    assert first.outcome is SubmitOutcome.ACCEPTED
    assert tuple(clue.id for clue in first.public_state.revealed_clues) == (1, 2)
    assert not checker.has_solution(first.public_state, Verdict(2, False))

    second = engine.submit_verdict(2, True)
    assert second.outcome is SubmitOutcome.ACCEPTED
    assert second.public_state.is_complete
    assert second.public_state.proved_statuses == {0: False, 1: True, 2: True}
    assert tuple(clue.id for clue in second.public_state.revealed_clues) == (1, 2, 3)
