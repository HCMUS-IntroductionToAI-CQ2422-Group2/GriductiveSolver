import pytest

from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker
from BackEnd.GameEngine.DeductiveAgent import DeductiveAgent
from BackEnd.GameEngine.GameEngine import GameEngine
from BackEnd.GameEngine.Maps import PUZZLES
from BackEnd.LogicAgent.dpll_checker import DPLLChecker


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
