from collections import Counter

import pytest
from fastapi.testclient import TestClient

from BackEnd.APIs import main as api
from BackEnd.APIs.schemas import to_public_json
from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.Maps import OBSERVATORY_5X5, PUZZLES
from BackEnd.GameEngine.validation import validate_puzzle


def test_map_catalog_has_requested_sizes():
    assert len({puzzle.id for puzzle in PUZZLES}) == 6
    assert Counter((puzzle.board.height, puzzle.board.width) for puzzle in PUZZLES) == {
        (3, 3): 2, (4, 4): 2, (5, 5): 2,
    }
    assert sum(puzzle.id.startswith("medium-") for puzzle in PUZZLES) == 5
    assert sum(puzzle.id.startswith("expert-") for puzzle in PUZZLES) == 1


@pytest.mark.parametrize("puzzle", PUZZLES, ids=lambda puzzle: puzzle.id)
def test_map_is_valid_unique_and_solvable_without_guessing(puzzle):
    validate_puzzle(puzzle, BruteForceChecker())


@pytest.mark.parametrize("puzzle", PUZZLES, ids=lambda puzzle: puzzle.id)
def test_initial_state_does_not_expose_hidden_clues_or_answers(puzzle):
    engine = GameEngine(puzzle, BruteForceChecker())
    public = to_public_json(engine.get_public_state())
    assert len(puzzle.initial_verdicts) == 1
    starter = puzzle.initial_verdicts[0]
    assert starter.is_criminal is False
    assert {cell["id"]: cell["is_criminal"] for cell in public["cells"]
            if cell["is_criminal"] is not None} == {starter.cell_id: False}
    assert len(public["revealed_clues"]) == 1
    assert public["revealed_clues"][0]["source_cell_id"] == starter.cell_id
    assert all(clue.source_cell_id is not None for clue in puzzle.clues)
    assert len({clue.source_cell_id for clue in puzzle.clues}) == len(puzzle.clues)
    assert {clue["id"] for clue in public["revealed_clues"]} == {
        clue.id for clue in puzzle.clues if clue.source_cell_id == starter.cell_id
    }
    assert "solution" not in public


def test_expert_opening_requires_two_distinct_deduction_gates():
    checker = BruteForceChecker()
    engine = GameEngine(OBSERVATORY_5X5, checker)

    def forced_verdicts():
        state = engine.get_public_state()
        forced = set()
        for row in state.board.cells:
            for cell in row:
                if cell.id in state.proved_statuses:
                    continue
                for status in (False, True):
                    if not checker.has_solution(state, Verdict(cell.id, not status)):
                        forced.add(Verdict(cell.id, status))
        return forced

    assert forced_verdicts() == {Verdict(2, True)}
    assert engine.submit_verdict(0, False).outcome is SubmitOutcome.NOT_PROVABLE
    assert engine.submit_verdict(2, True).outcome is SubmitOutcome.ACCEPTED
    assert forced_verdicts() == {Verdict(7, False)}
    assert engine.submit_verdict(7, False).outcome is SubmitOutcome.ACCEPTED


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api.app.state, "engine", GameEngine(PUZZLES[0], api.checker))
    with TestClient(api.app) as test_client:
        yield test_client


def test_api_lists_six_real_maps_and_starts_with_medium_3x3(client):
    assert client.get("/api/puzzles").json() == [puzzle.id for puzzle in PUZZLES]
    state = client.get("/api/game").json()
    assert state["puzzle_id"] == PUZZLES[0].id
    assert (state["height"], state["width"]) == (3, 3)


@pytest.mark.parametrize("puzzle", PUZZLES, ids=lambda puzzle: puzzle.id)
def test_api_can_load_solve_and_restart_each_map(client, puzzle):
    loaded = client.post("/api/game/load", json={"puzzle_id": puzzle.id})
    assert loaded.status_code == 200
    initial = loaded.json()
    assert initial["puzzle_id"] == puzzle.id
    assert len(initial["cells"]) == puzzle.board.cell_count

    state = initial
    steps = 0
    while not state["is_complete"]:
        # Play using only the public API, never the stored answer or hidden clues.
        hint = client.get("/api/game/hint").json()
        assert hint["status"] == "FOUND"
        verdict = hint["verdict"]
        response = client.post("/api/game/verdicts", json=verdict)
        assert response.status_code == 200
        result = response.json()
        assert result["outcome"] == "ACCEPTED"
        previous_clues = {clue["id"] for clue in state["revealed_clues"]}
        state = result["state"]
        assert all(clue["source_cell_id"] == verdict["cell_id"]
                   for clue in state["revealed_clues"]
                   if clue["id"] not in previous_clues)
        steps += 1
        assert steps < puzzle.board.cell_count
    assert steps == puzzle.board.cell_count - 1
    assert client.get("/api/game/hint").json()["status"] == "SOLVED"
    assert client.post("/api/game/restart").json() == initial

    solved = client.post("/api/game/auto-solve")
    assert solved.status_code == 200
    result = solved.json()
    assert result["status"] == "SOLVED"
    assert result["state"]["is_complete"] is True
    assert len(result["trace"]) == puzzle.board.cell_count - 1
    assert {cell["id"]: cell["is_criminal"] for cell in result["state"]["cells"]} == {
        verdict.cell_id: verdict.is_criminal for verdict in puzzle.solution
    }
    assert client.post("/api/game/restart").json() == initial
