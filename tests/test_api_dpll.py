import pytest

from BackEnd.APIs import main as api
from BackEnd.APIs.demo import make_demo_puzzle
from BackEnd.APIs.schemas import AutoSolveResponse, LoadRequest, VerdictRequest
from BackEnd.GameEngine.GameEngine import SubmitOutcome
from BackEnd.LogicAgent.dpll_checker import DPLLChecker
from tests.test_integration import PUZZLE


@pytest.fixture(params=(make_demo_puzzle(), PUZZLE), ids=lambda puzzle: puzzle.id)
def game(request, monkeypatch):
    puzzle = request.param
    previous_engine = api.app.state.engine
    monkeypatch.setitem(api.puzzles, puzzle.id, puzzle)
    try:
        initial = api.load_game(LoadRequest(puzzle_id=puzzle.id))
        yield puzzle, initial
    finally:
        api.app.state.engine = previous_engine


def test_api_uses_dpll_for_hints_verdicts_and_clue_reveals(game):
    puzzle, initial = game
    assert isinstance(api.checker, DPLLChecker)
    assert api.get_game() == initial
    state = initial

    for _ in range(puzzle.board.cell_count - len(puzzle.initial_verdicts)):
        hint = api.get_hint()
        assert hint.status == "FOUND"
        assert api.get_game() == state

        wrong = api.submit_verdict(VerdictRequest(
            cell_id=hint.verdict.cell_id,
            is_criminal=not hint.verdict.is_criminal,
        ))
        assert wrong["outcome"] is SubmitOutcome.CONTRADICTED
        assert wrong["state"] == state

        result = api.submit_verdict(VerdictRequest(
            cell_id=hint.verdict.cell_id,
            is_criminal=hint.verdict.is_criminal,
        ))
        assert result["outcome"] is SubmitOutcome.ACCEPTED
        state = result["state"]
        proved = {cell["id"] for cell in state["cells"] if cell["is_criminal"] is not None}
        assert {clue["id"] for clue in state["revealed_clues"]} == {
            clue.id for clue in puzzle.clues
            if clue.source_cell_id is None or clue.source_cell_id in proved
        }

    assert state["is_complete"] is True
    assert {cell["id"]: cell["is_criminal"] for cell in state["cells"]} == {
        verdict.cell_id: verdict.is_criminal for verdict in puzzle.solution
    }
    assert api.get_hint().status == "SOLVED"
    assert api.restart_game() == initial


def test_api_auto_solve_with_dpll_preserves_trace_and_restart(game):
    puzzle, initial = game
    result = AutoSolveResponse.model_validate(api.auto_solve())

    assert result.status == "SOLVED"
    assert result.state.is_complete
    assert len(result.trace) == puzzle.board.cell_count - len(puzzle.initial_verdicts)
    assert {cell.id: cell.is_criminal for cell in result.state.cells} == {
        verdict.cell_id: verdict.is_criminal for verdict in puzzle.solution
    }

    active = {clue["id"] for clue in initial["revealed_clues"]}
    for index, step in enumerate(result.trace, start=1):
        assert step.step == index
        assert set(step.active_clue_ids) == active
        assert not active.intersection(step.revealed_clue_ids)
        active.update(step.revealed_clue_ids)
    assert active == {clue.id for clue in result.state.revealed_clues}
    assert api.restart_game() == initial
