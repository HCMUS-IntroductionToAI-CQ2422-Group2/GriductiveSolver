import pytest

from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker
from BackEnd.GameEngine.DeductiveAgent import DeductiveAgent, Query
from BackEnd.GameEngine.GameEngine import GameEngine
from BackEnd.GameEngine.GameObject.constraints import Different, Fact, Same
from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.GameState import PublicState
from BackEnd.GameEngine.Maps import PUZZLES
from BackEnd.LogicAgent.dpll_checker import DPLLChecker
from tests.helpers import make_board, make_clue, make_public_state


@pytest.fixture(params=(BruteForceChecker, DPLLChecker), ids=("brute-force", "dpll"))
def checker(request):
    return request.param()


@pytest.mark.parametrize("puzzle", PUZZLES, ids=lambda p: p.id)
def test_agent_solves_every_map_with_proved_moves_only(puzzle, checker):
    engine = GameEngine(puzzle, checker)
    result = DeductiveAgent(checker).solve(engine)
    assert result.status == "SOLVED"
    assert len(result.trace) == puzzle.board.cell_count - len(puzzle.initial_verdicts)
    solution = {v.cell_id: v.is_criminal for v in puzzle.solution}
    assert all(solution[s.verdict.cell_id] == s.verdict.is_criminal for s in result.trace)


def test_next_move_reports_refuted_opposite_in_queries(checker):
    puzzle = PUZZLES[0]
    engine = GameEngine(puzzle, checker)
    move = DeductiveAgent(checker).next_move(engine.get_public_state())
    assert move.status == "FOUND"
    opposite = [q for q in move.queries
                if q.assumption and q.assumption.cell_id == move.verdict.cell_id
                and q.assumption.is_criminal != move.verdict.is_criminal]
    assert opposite and not opposite[0].satisfiable


def test_solved_state_has_no_move(checker):
    engine = GameEngine(PUZZLES[0], checker)
    agent = DeductiveAgent(checker)
    agent.solve(engine)
    assert agent.next_move(engine.get_public_state()).status == "SOLVED"


def test_classify_all_distinguishes_criminal_innocent_and_unknown(checker):
    board = make_board(2, 2)
    clues = (
        make_clue(1, Same(0, 1)),
        make_clue(2, Different(0, 2)),
    )
    state = make_public_state(board, clues=clues, proved={0: True})

    result = DeductiveAgent(checker).classify_all(state)

    assert result.status == "CONSISTENT"
    assert dict(result.classifications) == {
        1: "CRIMINAL",
        2: "INNOCENT",
        3: "UNKNOWN",
    }
    assert result.queries == (
        Query(None, True),
        Query(Verdict(1, True), True),
        Query(Verdict(1, False), False),
        Query(Verdict(2, True), False),
        Query(Verdict(2, False), True),
        Query(Verdict(3, True), True),
        Query(Verdict(3, False), True),
    )


def test_classify_all_returns_inconsistent_on_unsat_kb(checker):
    board = make_board(2, 2)
    clues = (
        make_clue(1, Fact(1, True)),
        make_clue(2, Fact(1, False)),
    )
    state = make_public_state(board, clues=clues, proved={0: True})

    result = DeductiveAgent(checker).classify_all(state)

    assert result.status == "INCONSISTENT"
    assert dict(result.classifications) == {}
    assert result.queries == (Query(None, False),)


def test_classify_all_does_not_mutate_input_public_state(checker):
    board = make_board(2, 2)
    clues = (
        make_clue(1, Same(0, 1)),
        make_clue(2, Different(0, 2)),
    )
    proved = {0: True}
    state = PublicState(
        puzzle_id="immutability-check",
        board=board,
        revealed_clues=clues,
        proved_statuses=proved,
    )
    snapshot = PublicState(
        puzzle_id=state.puzzle_id,
        board=state.board,
        revealed_clues=state.revealed_clues,
        proved_statuses=dict(state.proved_statuses),
    )

    DeductiveAgent(checker).classify_all(state)

    assert state == snapshot
    assert state.proved_statuses is proved
    assert proved == {0: True}
    assert state.revealed_clues == clues
