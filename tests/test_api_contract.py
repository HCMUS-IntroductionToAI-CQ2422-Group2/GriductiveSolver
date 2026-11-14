"""Data contract between BackEnd/APIs and the UI in FrontEnd/.

Human-readable contract: FrontEnd/API_CONTRACT.md.
Machine-readable contract: FrontEnd/contract/openapi.json.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from BackEnd.APIs import main as api
from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome, SubmitResult
from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.Maps import PUZZLES
from FrontEnd.tools.export_contract import CONTRACT_PATH, render_contract

ROOT = Path(__file__).resolve().parents[1]

STATE_KEYS = {"puzzle_id", "height", "width", "cells", "revealed_clues", "is_complete"}
CELL_KEYS = {"id", "row", "column", "character_name", "profession", "is_criminal"}
CLUE_KEYS = {"id", "source_cell_id", "description_nl", "referenced_cell_ids"}
VERDICT_KEYS = {"cell_id", "is_criminal"}
SAT_QUERY_KEYS = {"assumption", "satisfiable"}
STEP_KEYS = {"step", "active_clue_ids", "sat_queries", "verdict", "revealed_clue_ids"}
# Schemas FastAPI generates itself; their shape depends on the installed version.
FRAMEWORK_SCHEMAS = {"HTTPValidationError", "ValidationError"}


@pytest.fixture
def client():
    previous = api.app.state.engine
    api.app.state.engine = GameEngine(PUZZLES[0], api.checker)
    try:
        with TestClient(api.app) as test_client:
            yield test_client
    finally:
        api.app.state.engine = previous


def assert_public_state(state, puzzle=None):
    assert set(state) == STATE_KEYS
    assert len(state["cells"]) == state["height"] * state["width"]
    # Row-major order, ids 0..n-1 matching their position.
    for index, cell in enumerate(state["cells"]):
        assert set(cell) == CELL_KEYS
        assert cell["id"] == index
        assert (cell["row"], cell["column"]) == divmod(index, state["width"])
        assert cell["is_criminal"] in (True, False, None)
    cell_ids = {cell["id"] for cell in state["cells"]}
    for clue in state["revealed_clues"]:
        assert set(clue) == CLUE_KEYS
        assert clue["source_cell_id"] is None or clue["source_cell_id"] in cell_ids
        assert clue["referenced_cell_ids"] == sorted(set(clue["referenced_cell_ids"]))
        assert set(clue["referenced_cell_ids"]) <= cell_ids
    assert state["is_complete"] == all(c["is_criminal"] is not None for c in state["cells"])
    if puzzle is not None:
        # Only clues of proved cells (or public clues) are ever sent.
        proved = {c["id"] for c in state["cells"] if c["is_criminal"] is not None}
        expected = {clue.id for clue in puzzle.clues
                    if clue.source_cell_id is None or clue.source_cell_id in proved}
        assert {clue["id"] for clue in state["revealed_clues"]} == expected
        solution = {v.cell_id: v.is_criminal for v in puzzle.solution}
        assert all(c["is_criminal"] in (None, solution[c["id"]]) for c in state["cells"])


def assert_verdict(verdict):
    assert set(verdict) == VERDICT_KEYS
    assert isinstance(verdict["cell_id"], int)
    assert isinstance(verdict["is_criminal"], bool)


def assert_sat_queries(queries):
    for query in queries:
        assert set(query) == SAT_QUERY_KEYS
        assert isinstance(query["satisfiable"], bool)
        if query["assumption"] is not None:
            assert_verdict(query["assumption"])


def provable_and_open_cells(puzzle):
    """One verdict the clues force, and one cell they leave open."""
    checker = BruteForceChecker()
    state = GameEngine(puzzle, checker).get_public_state()
    forced = open_cell = None
    for cell_id in range(puzzle.board.cell_count):
        if cell_id in state.proved_statuses:
            continue
        criminal = checker.has_solution(state, Verdict(cell_id, True))
        innocent = checker.has_solution(state, Verdict(cell_id, False))
        if criminal != innocent and forced is None:
            forced = Verdict(cell_id, criminal)
        if criminal and innocent and open_cell is None:
            open_cell = cell_id
    return forced, open_cell


# ---- Machine-readable contract ---------------------------------------------

def test_openapi_contract_file_is_up_to_date():
    saved = json.loads(CONTRACT_PATH.read_text("utf-8"))
    current = json.loads(render_contract())
    hint = "Run `python -m FrontEnd.tools.export_contract` and commit the result."
    assert saved["paths"] == current["paths"], hint
    ours = lambda doc: {name: schema for name, schema in doc["components"]["schemas"].items()
                        if name not in FRAMEWORK_SCHEMAS}
    assert ours(saved) == ours(current), hint


def test_api_routes_are_exactly_the_documented_ones():
    routes = {(method, route.path)
              for route in api.app.routes if route.path.startswith("/api/")
              for method in route.methods}
    assert routes == {
        ("GET", "/api/puzzles"),
        ("GET", "/api/game"),
        ("POST", "/api/game/load"),
        ("POST", "/api/game/restart"),
        ("POST", "/api/game/verdicts"),
        ("GET", "/api/game/hint"),
        ("POST", "/api/game/auto-solve"),
    }
    documented = (ROOT / "FrontEnd" / "API_CONTRACT.md").read_text("utf-8")
    api_js = (ROOT / "FrontEnd" / "static" / "js" / "api.js").read_text("utf-8")
    for _, path in routes:
        assert f"`{path}`" in documented or f" {path}`" in documented, path
        assert f'"{path}"' in api_js, path


# ---- Success shapes ----------------------------------------------------------

def test_puzzles_is_a_list_of_ids(client):
    assert client.get("/api/puzzles").json() == [puzzle.id for puzzle in PUZZLES]


@pytest.mark.parametrize("puzzle", PUZZLES, ids=lambda p: p.id)
def test_load_get_restart_return_public_state(client, puzzle):
    loaded = client.post("/api/game/load", json={"puzzle_id": puzzle.id}).json()
    assert_public_state(loaded, puzzle)
    assert loaded["puzzle_id"] == puzzle.id
    assert loaded["is_complete"] is False
    assert client.get("/api/game").json() == loaded
    assert client.post("/api/game/restart").json() == loaded


def test_verdict_outcomes_have_documented_shape(client):
    puzzle = PUZZLES[0]
    client.post("/api/game/load", json={"puzzle_id": puzzle.id})
    forced, open_cell = provable_and_open_cells(puzzle)
    starter = puzzle.initial_verdicts[0]
    initial = client.get("/api/game").json()

    def submit(cell_id, is_criminal):
        body = client.post("/api/game/verdicts",
                           json={"cell_id": cell_id, "is_criminal": is_criminal})
        assert body.status_code == 200
        data = body.json()
        assert set(data) == {"outcome", "state"}
        assert_public_state(data["state"], puzzle)
        return data

    rejected = [
        submit(forced.cell_id, not forced.is_criminal),
        submit(open_cell, True),
        submit(starter.cell_id, starter.is_criminal),
    ]
    assert [r["outcome"] for r in rejected] == ["CONTRADICTED", "NOT_PROVABLE", "ALREADY_PROVED"]
    # Rejected verdicts never change the state.
    assert all(r["state"] == initial for r in rejected)

    accepted = submit(forced.cell_id, forced.is_criminal)
    assert accepted["outcome"] == "ACCEPTED"
    assert accepted["state"]["cells"][forced.cell_id]["is_criminal"] == forced.is_criminal


def test_hint_shape(client):
    hint = client.get("/api/game/hint").json()
    assert set(hint) == {"status", "verdict", "sat_queries"}
    assert hint["status"] == "FOUND"
    assert_verdict(hint["verdict"])
    assert_sat_queries(hint["sat_queries"])
    # First query checks the clues themselves, then pairs of assumptions per cell.
    assert hint["sat_queries"][0] == {"assumption": None, "satisfiable": True}

    client.post("/api/game/auto-solve")
    solved = client.get("/api/game/hint").json()
    assert solved["status"] == "SOLVED"
    assert solved["verdict"] is None


def test_auto_solve_trace_shape(client):
    initial = client.get("/api/game").json()
    result = client.post("/api/game/auto-solve").json()
    assert set(result) == {"status", "state", "trace"}
    assert result["status"] == "SOLVED"
    assert_public_state(result["state"], PUZZLES[0])

    # The UI replays the trace on top of the state it had before auto-solve.
    frame = initial
    revealed = {clue["id"] for clue in frame["revealed_clues"]}
    for index, step in enumerate(result["trace"], start=1):
        assert set(step) == STEP_KEYS
        assert step["step"] == index
        assert_verdict(step["verdict"])
        assert_sat_queries(step["sat_queries"])
        assert set(step["active_clue_ids"]) == revealed
        assert frame["cells"][step["verdict"]["cell_id"]]["is_criminal"] is None
        frame["cells"][step["verdict"]["cell_id"]]["is_criminal"] = step["verdict"]["is_criminal"]
        assert not revealed & set(step["revealed_clue_ids"])
        revealed |= set(step["revealed_clue_ids"])
    assert frame["cells"] == result["state"]["cells"]
    assert revealed == {clue["id"] for clue in result["state"]["revealed_clues"]}


# ---- Error shapes -------------------------------------------------------------

def test_unknown_puzzle_is_404(client):
    response = client.post("/api/game/load", json={"puzzle_id": "nope"})
    assert response.status_code == 404
    assert response.json() == {"detail": "PUZZLE_NOT_FOUND"}


def test_unknown_cell_is_404(client):
    response = client.post("/api/game/verdicts", json={"cell_id": 999, "is_criminal": True})
    assert response.status_code == 404
    assert response.json() == {"detail": "INVALID_CELL"}


@pytest.mark.parametrize("body", [
    {"cell_id": "1", "is_criminal": True},
    {"cell_id": 1, "is_criminal": "true"},
    {"cell_id": 1},
])
def test_wrong_types_are_422_with_a_list_detail(client, body):
    response = client.post("/api/game/verdicts", json=body)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, list) and all("msg" in item for item in detail)


def test_engine_rejecting_auto_solve_move_is_409(client):
    real = GameEngine(PUZZLES[0], api.checker)

    class RefusingEngine:
        def get_public_state(self):
            return real.get_public_state()

        def submit_verdict(self, cell_id, status):
            return SubmitResult(Verdict(cell_id, status), SubmitOutcome.NOT_PROVABLE,
                                real.get_public_state())

    api.app.state.engine = RefusingEngine()
    response = client.post("/api/game/auto-solve")
    assert response.status_code == 409
    assert response.json() == {"detail": "NOT_PROVABLE"}


def test_cors_allows_local_dev_servers_only(client):
    def preflight(origin):
        return client.options("/api/game/verdicts", headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }).headers.get("access-control-allow-origin")

    assert preflight("http://127.0.0.1:5500") == "http://127.0.0.1:5500"
    assert preflight("http://localhost:3000") == "http://localhost:3000"
    assert preflight("https://evil.example") is None


# ---- Offline mock -------------------------------------------------------------

@pytest.mark.skipif(shutil.which("node") is None, reason="needs Node.js to read mock/state.js")
def test_offline_mock_states_use_the_same_shape():
    script = ("import * as m from './FrontEnd/mock/state.js';"
              "console.log(JSON.stringify(Object.values(m)));")
    output = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT,
                            capture_output=True, text=True, check=True).stdout
    states = json.loads(output)
    assert states
    for state in states:
        assert_public_state(state)
