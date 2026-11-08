from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse

from BackEnd.APIs.demo import DemoConstraintChecker, DemoGameEngine, make_demo_puzzle
from BackEnd.APIs.schemas import (
    AutoSolveResponse,
    DeductionStep,
    HintResponse,
    LoadRequest,
    PublicStateResponse,
    SatQuery,
    VerdictRequest,
    VerdictResponse,
    to_public_json,
)
from BackEnd.GameEngine.ConstraintChecker import ConstraintChecker
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.GameState import PublicState
from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker

app = FastAPI(title="Griductive API")

demo_puzzle = make_demo_puzzle()
puzzles = {demo_puzzle.id: demo_puzzle}
checker: ConstraintChecker = BruteForceChecker()
engine_type: type[GameEngine] = GameEngine
app.state.engine = engine_type(demo_puzzle, checker)
game_lock = Lock()


def find_hint(state: PublicState, constraint_checker: ConstraintChecker) -> HintResponse:
    sat_queries: list[SatQuery] = []

    def check(assumption: Verdict | None = None) -> bool:
        satisfiable = constraint_checker.has_solution(state, assumption)
        sat_queries.append(SatQuery(assumption=assumption, satisfiable=satisfiable))
        return satisfiable

    if not check():
        return HintResponse(status="INCONSISTENT", sat_queries=sat_queries)

    unresolved_ids = [
        cell.id for row in state.board.cells for cell in row
        if cell.id not in state.proved_statuses
    ]
    for cell_id in unresolved_ids:
        criminal = Verdict(cell_id, True)
        innocent = Verdict(cell_id, False)
        can_be_criminal = check(criminal)
        can_be_innocent = check(innocent)
        if can_be_criminal != can_be_innocent:
            return HintResponse(
                status="FOUND",
                verdict=criminal if can_be_criminal else innocent,
                sat_queries=sat_queries,
            )

    return HintResponse(
        status="UNKNOWN" if unresolved_ids else "SOLVED",
        sat_queries=sat_queries,
    )


@app.get("/", include_in_schema=False)
def open_docs():
    return RedirectResponse("/docs")


@app.get("/api/puzzles")
def list_puzzles() -> list[str]:
    return sorted(puzzles)


@app.post("/api/game/load", response_model=PublicStateResponse)
def load_game(body: LoadRequest):
    puzzle = puzzles.get(body.puzzle_id)
    if puzzle is None:
        raise HTTPException(status_code=404, detail="PUZZLE_NOT_FOUND")

    with game_lock:
        engine = engine_type(puzzle, checker)
        state = to_public_json(engine.get_public_state())
        app.state.engine = engine
        return state


@app.get("/api/game", response_model=PublicStateResponse)
def get_game():
    with game_lock:
        return to_public_json(app.state.engine.get_public_state())


@app.post("/api/game/verdicts", response_model=VerdictResponse)
def submit_verdict(body: VerdictRequest):
    with game_lock:
        result = app.state.engine.submit_verdict(body.cell_id, body.is_criminal)
        if result.outcome is SubmitOutcome.INVALID_CELL:
            raise HTTPException(status_code=404, detail="INVALID_CELL")
        return {
            "outcome": result.outcome,
            "state": to_public_json(result.public_state),
        }


@app.post("/api/game/restart", response_model=PublicStateResponse)
def restart_game():
    with game_lock:
        return to_public_json(app.state.engine.restart())


@app.get("/api/game/hint", response_model=HintResponse)
def get_hint():
    with game_lock:
        return find_hint(app.state.engine.get_public_state(), checker)


@app.post("/api/game/auto-solve", response_model=AutoSolveResponse)
def auto_solve():
    trace: list[DeductionStep] = []

    with game_lock:
        engine: GameEngine = app.state.engine
        state = engine.get_public_state()
        while True:
            hint = find_hint(state, checker)
            verdict = hint.verdict
            if verdict is None:
                return {
                    "status": "STUCK" if hint.status == "UNKNOWN" else hint.status,
                    "state": to_public_json(state),
                    "trace": trace,
                }

            result = engine.submit_verdict(verdict.cell_id, verdict.is_criminal)
            if result.outcome is not SubmitOutcome.ACCEPTED:
                raise HTTPException(status_code=409, detail=result.outcome.value)

            active_clue_ids = [clue.id for clue in state.revealed_clues]
            trace.append(DeductionStep(
                step=len(trace) + 1,
                active_clue_ids=active_clue_ids,
                sat_queries=hint.sat_queries,
                verdict=verdict,
                revealed_clue_ids=[
                    clue.id for clue in result.public_state.revealed_clues
                    if clue.id not in active_clue_ids
                ],
            ))
            state = result.public_state
