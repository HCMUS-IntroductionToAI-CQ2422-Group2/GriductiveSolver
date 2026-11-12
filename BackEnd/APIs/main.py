from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

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
from BackEnd.GameEngine.BruteForceChecker import BruteForceChecker
from BackEnd.GameEngine.ConstraintChecker import ConstraintChecker
from BackEnd.GameEngine.DeductiveAgent import DeductiveAgent
from BackEnd.GameEngine.GameEngine import GameEngine, SubmitOutcome
from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.GameState import PublicState
from BackEnd.GameEngine.Maps import PUZZLES

app = FastAPI(title="Griductive API")

puzzles = {puzzle.id: puzzle for puzzle in PUZZLES}
checker: ConstraintChecker = BruteForceChecker()
engine_type: type[GameEngine] = GameEngine
app.state.engine = engine_type(PUZZLES[0], checker)
game_lock = Lock()


def find_hint(state: PublicState, constraint_checker: ConstraintChecker) -> HintResponse:
    move = DeductiveAgent(constraint_checker).next_move(state)
    return HintResponse(
        status=move.status,
        verdict=move.verdict,
        sat_queries=[SatQuery(assumption=q.assumption, satisfiable=q.satisfiable)
                     for q in move.queries],
    )


@app.get("/", include_in_schema=False)
def open_frontend():
    return RedirectResponse("/app/")


@app.get("/api/puzzles")
def list_puzzles() -> list[str]:
    return list(puzzles)


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
    with game_lock:
        try:
            result = DeductiveAgent(checker).solve(app.state.engine)
        except RuntimeError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        return {
            "status": result.status,
            "state": to_public_json(result.state),
            "trace": [
                DeductionStep(
                    step=step.step,
                    active_clue_ids=list(step.active_clue_ids),
                    sat_queries=[SatQuery(assumption=q.assumption, satisfiable=q.satisfiable)
                                 for q in step.queries],
                    verdict=step.verdict,
                    revealed_clue_ids=list(step.revealed_clue_ids),
                )
                for step in result.trace
            ],
        }


frontend_dir = Path(__file__).resolve().parents[2] / "FrontEnd"


@app.get("/app/avatars.json", include_in_schema=False)
def list_avatars() -> list[str]:
    avatars_dir = frontend_dir / "static" / "avatars"
    return sorted(file.name for file in avatars_dir.glob("*.svg") if file.is_file())


app.mount("/app", StaticFiles(directory=frontend_dir, html=True), name="frontend")
