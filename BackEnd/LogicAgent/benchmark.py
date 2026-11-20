from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from time import perf_counter

# Thêm đường dẫn gốc vào sys.path để import được BackEnd
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.append(project_root)

from BackEnd.GameEngine.DeductiveAgent import DeductiveAgent, MoveRejected, Step
from BackEnd.GameEngine.GameEngine import GameEngine
from BackEnd.GameEngine.GameObject.constraints import Fact
from BackEnd.GameEngine.GameObject.objects import PuzzleDefinition, Verdict
from BackEnd.GameEngine.GameState import PublicState
from BackEnd.GameEngine.Maps import (
    GALLERY_3X3,
    HARBOR_4X4,
    MARKET_3X3,
    MUSEUM_5X5,
    OBSERVATORY_5X5,
    PUZZLES,
    THEATRE_4X4,
)
from BackEnd.LogicAgent.cnf_encoder import CNFEncoder
from BackEnd.LogicAgent.dpll_checker import DPLLChecker
from BackEnd.LogicAgent.DPLL_Solver import CNF, DPLLStats, solve

DEFAULT_TIMEOUT_MS = 30_000.0


class BenchmarkTimeoutError(TimeoutError):
    """Raised when solving a puzzle exceeds the configured benchmark timeout."""


@dataclass
class KBStats:
    """CNF knowledge base size metrics at a given public state."""

    primary_vars: int = 0
    auxiliary_vars: int = 0
    total_vars: int = 0
    clauses: int = 0
    revealed_clues: int = 0
    proved_cells: int = 0


@dataclass
class BenchmarkResult:
    """Full benchmark metrics for an end-to-end deductive solve of one puzzle."""

    puzzle_id: str
    puzzle_name: str
    board_size: str
    status: str  # "SOLVED", "STUCK", "INCONSISTENT", "TIMEOUT", "FAILED"
    passed: bool
    failure_reason: str | None = None

    # CNF metrics (Initial KB vs Final/Peak KB)
    initial_kb: KBStats = field(default_factory=KBStats)
    final_kb: KBStats = field(default_factory=KBStats)
    peak_auxiliary_vars: int = 0
    peak_clauses: int = 0

    # Cumulative SAT solver metrics across the entire solving process
    sat_calls: int = 0
    agent_sat_calls: int = 0
    engine_sat_calls: int = 0
    decisions: int = 0
    propagations: int = 0
    backtracks: int = 0

    # Deduction progression metrics
    deduction_steps: int = 0
    clue_reveal_steps: int = 0
    reveal_waves: int = 0
    solved_cells: int = 0
    total_cells: int = 0

    # Runtime metrics (milliseconds)
    encode_runtime_ms: float = 0.0
    sat_runtime_ms: float = 0.0
    total_runtime_ms: float = 0.0

    trace: tuple[Step, ...] = ()


def build_initial_public_state(puzzle: PuzzleDefinition) -> PublicState:
    """Construct the initial PublicState including source_cell_id=None public clues."""
    proved_statuses = {v.cell_id: v.is_criminal for v in puzzle.initial_verdicts}
    revealed_clues = tuple(
        clue
        for clue in puzzle.clues
        if clue.source_cell_id is None or clue.source_cell_id in proved_statuses
    )
    return PublicState(
        puzzle_id=puzzle.id,
        board=puzzle.board,
        revealed_clues=revealed_clues,
        proved_statuses=proved_statuses,
    )


def measure_kb(public_state: PublicState) -> KBStats:
    """Measure primary/auxiliary variables and CNF clauses for a PublicState."""
    encoder = CNFEncoder(public_state.board)
    clauses: list[list[int]] = []

    for clue in public_state.revealed_clues:
        clauses.extend(encoder.encode_constraint(clue.constraint))
    for cell_id, is_criminal in public_state.proved_statuses.items():
        clauses.extend(encoder.encode_fact(Fact(cell_id, is_criminal)))

    primary_vars = len(encoder.variable_map)
    total_vars = encoder.next_variable - 1
    auxiliary_vars = total_vars - primary_vars
    return KBStats(
        primary_vars=primary_vars,
        auxiliary_vars=auxiliary_vars,
        total_vars=total_vars,
        clauses=len(clauses),
        revealed_clues=len(public_state.revealed_clues),
        proved_cells=len(public_state.proved_statuses),
    )


class BenchmarkDPLLChecker(DPLLChecker):
    """Instrumented DPLLChecker that aggregates CNF and DPLL stats across all SAT calls."""

    def __init__(self, timeout_ms: float | None = DEFAULT_TIMEOUT_MS) -> None:
        self.timeout_ms = timeout_ms
        self.started_at: float | None = None
        self.sat_calls: int = 0
        self.decisions: int = 0
        self.propagations: int = 0
        self.backtracks: int = 0
        self.encode_runtime_ms: float = 0.0
        self.sat_runtime_ms: float = 0.0
        self.peak_auxiliary_vars: int = 0
        self.peak_clauses: int = 0

    def start_timer(self) -> None:
        self.started_at = perf_counter()

    def _check_timeout(self) -> None:
        if self.timeout_ms is not None and self.started_at is not None:
            elapsed_ms = (perf_counter() - self.started_at) * 1000.0
            if elapsed_ms > self.timeout_ms:
                raise BenchmarkTimeoutError(
                    f"Timeout exceeded ({elapsed_ms:.2f} ms > {self.timeout_ms:.2f} ms)"
                )

    def has_solution(
        self,
        public_state: PublicState,
        assumption: Verdict | None = None,
    ) -> bool:
        self._check_timeout()

        encode_start = perf_counter()
        encoder = CNFEncoder(public_state.board)
        clauses: list[list[int]] = []

        for clue in public_state.revealed_clues:
            clauses.extend(encoder.encode_constraint(clue.constraint))

        for cell_id, is_criminal in public_state.proved_statuses.items():
            clauses.extend(encoder.encode_fact(Fact(cell_id, is_criminal)))

        if assumption is not None:
            clauses.extend(
                encoder.encode_fact(Fact(assumption.cell_id, assumption.is_criminal))
            )

        cnf: CNF = tuple(tuple(clause) for clause in clauses)
        self.encode_runtime_ms += (perf_counter() - encode_start) * 1000.0

        primary_vars = len(encoder.variable_map)
        total_vars = encoder.next_variable - 1
        aux_vars = total_vars - primary_vars
        self.peak_auxiliary_vars = max(self.peak_auxiliary_vars, aux_vars)
        self.peak_clauses = max(self.peak_clauses, len(cnf))

        call_stats = DPLLStats()
        result = solve(cnf, total_vars, call_stats)

        self.sat_calls += 1
        self.decisions += call_stats.decisions
        self.propagations += call_stats.propagations
        self.backtracks += call_stats.backtracks
        self.sat_runtime_ms += call_stats.runtime_ms

        self._check_timeout()
        return result is not None


def count_reveal_waves(puzzle: PuzzleDefinition) -> int:
    """Count deduction/reveal waves needed to solve the puzzle.

    A wave contains all verdicts forced by the public information available at
    the start of that wave; newly unlocked testimony is used in the next wave.
    """
    checker = DPLLChecker()
    engine = GameEngine(puzzle, checker)
    waves = 0

    while True:
        wave_state = engine.get_public_state()
        if wave_state.is_complete:
            break

        if not checker.has_solution(wave_state):
            break

        forced_verdicts: list[Verdict] = []
        for row in wave_state.board.cells:
            for cell in row:
                if cell.id in wave_state.proved_statuses:
                    continue
                can_be_criminal = checker.has_solution(
                    wave_state, Verdict(cell.id, True)
                )
                can_be_innocent = checker.has_solution(
                    wave_state, Verdict(cell.id, False)
                )
                if can_be_criminal != can_be_innocent:
                    forced_verdicts.append(Verdict(cell.id, can_be_criminal))

        if not forced_verdicts:
            break

        waves += 1
        for verdict in forced_verdicts:
            engine.submit_verdict(verdict.cell_id, verdict.is_criminal)

    return waves


def run_benchmark(
    puzzle_name: str,
    puzzle: PuzzleDefinition,
    timeout_ms: float | None = DEFAULT_TIMEOUT_MS,
    verbose: bool = True,
) -> BenchmarkResult:
    """Run full Agent -> Prove Verdict -> Reveal Clue -> Continue benchmark on a puzzle."""
    board_size = f"{puzzle.board.height}x{puzzle.board.width}"
    total_cells = puzzle.board.cell_count

    # 1. Khởi tạo trạng thái công khai ban đầu (bao gồm cả clue có source_cell_id=None)
    initial_state = build_initial_public_state(puzzle)
    initial_kb = measure_kb(initial_state)

    checker = BenchmarkDPLLChecker(timeout_ms=timeout_ms)
    engine = GameEngine(puzzle, checker)
    agent = DeductiveAgent(checker)

    status = "FAILED"
    passed = False
    failure_reason: str | None = None
    trace: tuple[Step, ...] = ()
    final_state = engine.get_public_state()

    # 2. Chạy toàn bộ vòng lặp suy luận: Agent -> Submit Verdict -> Mở Clue -> Tiếp tục
    system_start = perf_counter()
    checker.start_timer()
    try:
        solve_result = agent.solve(engine)
        total_runtime_ms = (perf_counter() - system_start) * 1000.0
        status = solve_result.status
        trace = solve_result.trace
        final_state = solve_result.state

        expected_solution = {v.cell_id: v.is_criminal for v in puzzle.solution}
        if status != "SOLVED":
            unresolved = sorted(
                cell.id
                for row in final_state.board.cells
                for cell in row
                if cell.id not in final_state.proved_statuses
            )
            failure_reason = (
                f"Agent dừng ở trạng thái {status} "
                f"(còn {len(unresolved)} ô chưa giải được: {unresolved})"
            )
        elif not final_state.is_complete:
            failure_reason = "Trạng thái trả về SOLVED nhưng bàn chơi chưa mở hết ô."
        elif dict(final_state.proved_statuses) != expected_solution:
            failure_reason = "Nghiệm suy luận được không khớp với đáp án chuẩn (puzzle.solution)."
        else:
            passed = True
    except BenchmarkTimeoutError as exc:
        total_runtime_ms = (perf_counter() - system_start) * 1000.0
        status = "TIMEOUT"
        failure_reason = str(exc)
        final_state = engine.get_public_state()
    except MoveRejected as exc:
        total_runtime_ms = (perf_counter() - system_start) * 1000.0
        status = "REJECTED"
        failure_reason = str(exc)
        final_state = engine.get_public_state()
    except Exception as exc:  # pragma: no cover - defensive reporting
        total_runtime_ms = (perf_counter() - system_start) * 1000.0
        status = "ERROR"
        failure_reason = f"{type(exc).__name__}: {exc}"
        final_state = engine.get_public_state()

    final_kb = measure_kb(final_state)
    deduction_steps = len(trace)
    clue_reveal_steps = sum(1 for step in trace if step.revealed_clue_ids)
    # Mỗi bước được chấp nhận trong GameEngine.submit_verdict gọi checker.has_solution 2 lần
    engine_sat_calls = min(checker.sat_calls, 2 * deduction_steps)
    agent_sat_calls = max(0, checker.sat_calls - engine_sat_calls)
    reveal_waves = count_reveal_waves(puzzle) if status != "TIMEOUT" else 0

    result = BenchmarkResult(
        puzzle_id=puzzle.id,
        puzzle_name=puzzle_name,
        board_size=board_size,
        status=status,
        passed=passed,
        failure_reason=failure_reason,
        initial_kb=initial_kb,
        final_kb=final_kb,
        peak_auxiliary_vars=max(
            initial_kb.auxiliary_vars,
            final_kb.auxiliary_vars,
            checker.peak_auxiliary_vars,
        ),
        peak_clauses=max(
            initial_kb.clauses,
            final_kb.clauses,
            checker.peak_clauses,
        ),
        sat_calls=checker.sat_calls,
        agent_sat_calls=agent_sat_calls,
        engine_sat_calls=engine_sat_calls,
        decisions=checker.decisions,
        propagations=checker.propagations,
        backtracks=checker.backtracks,
        deduction_steps=deduction_steps,
        clue_reveal_steps=clue_reveal_steps,
        reveal_waves=reveal_waves,
        solved_cells=len(final_state.proved_statuses),
        total_cells=total_cells,
        encode_runtime_ms=checker.encode_runtime_ms,
        sat_runtime_ms=checker.sat_runtime_ms,
        total_runtime_ms=total_runtime_ms,
        trace=trace,
    )

    if verbose:
        print_case_report(result)

    return result


def print_case_report(result: BenchmarkResult) -> None:
    """Print detailed benchmark report for a single puzzle."""
    print(f"\n{'=' * 65}")
    print(f"BENCHMARK MAP: {result.puzzle_name} ({result.puzzle_id} | {result.board_size})")
    print(f"{'=' * 65}")

    print("1. Cấu trúc CNF (Initial KB -> Final / Peak KB)")
    print(
        f"   - Primary Variables (Biến chính):      {result.initial_kb.primary_vars}"
    )
    print(
        f"   - Auxiliary Variables (Biến phụ):      "
        f"Initial = {result.initial_kb.auxiliary_vars} | "
        f"Final = {result.final_kb.auxiliary_vars} | "
        f"Peak = {result.peak_auxiliary_vars}"
    )
    print(
        f"   - Total CNF Clauses (Mệnh đề):         "
        f"Initial = {result.initial_kb.clauses} | "
        f"Final = {result.final_kb.clauses} | "
        f"Peak = {result.peak_clauses}"
    )
    print(
        f"   - Revealed Clues (Số clue đã mở):      "
        f"{result.initial_kb.revealed_clues} -> {result.final_kb.revealed_clues}"
    )

    print("\n2. Quá trình suy luận (Agent -> Verdict -> Reveal Clue -> Continue)")
    print(
        f"   - Deduction Steps (Số bước suy luận):  {result.deduction_steps} bước "
        f"({result.solved_cells}/{result.total_cells} ô đã chứng minh)"
    )
    print(
        f"   - Clue Reveal Steps (Bước mở clue):    {result.clue_reveal_steps} bước"
    )
    print(
        f"   - Reveal Waves (Số đợt suy luận):      {result.reveal_waves} waves"
    )

    print("\n3. Hiệu năng DPLL SAT Solver (Tổng hợp toàn bộ quá trình giải)")
    print(
        f"   - Total SAT Calls (Tổng số lần gọi):   {result.sat_calls} "
        f"(Agent: {result.agent_sat_calls}, Engine verify: {result.engine_sat_calls})"
    )
    print(f"   - Decisions (Tổng phân nhánh):         {result.decisions}")
    print(f"   - Propagations (Tổng lan truyền):      {result.propagations}")
    print(f"   - Backtracks (Tổng quay lui):          {result.backtracks}")
    print(f"   - CNF Encode Runtime (Mã hóa CNF):     {result.encode_runtime_ms:.2f} ms")
    print(f"   - SAT Solver Runtime (Chỉ DPLL):       {result.sat_runtime_ms:.2f} ms")
    print(f"   - Total System Runtime (Toàn hệ thống): {result.total_runtime_ms:.2f} ms")

    outcome_label = "PASS (SOLVED)" if result.passed else f"FAIL ({result.status})"
    print(f"\n4. Kết quả kiểm định: {outcome_label}")
    if result.failure_reason:
        print(f"   - Lý do lỗi/timeout: {result.failure_reason}")


def print_summary_table(results: list[BenchmarkResult]) -> None:
    """Print a compact comparison table across all benchmarked puzzles."""
    print(f"\n{'=' * 118}")
    print("BẢNG TỔNG HỢP BENCHMARK 6 MAPS (MỤC 4.5)")
    print(f"{'=' * 118}")
    header = (
        f"{'Map':<18} | {'Size':<4} | {'Vars(P/A*)':<10} | {'Clauses(I/F)':<12} | "
        f"{'Steps/Waves':<11} | {'SAT Calls':<9} | {'Dec/Prop/Back':<17} | "
        f"{'SAT/Total (ms)':<16} | {'Status':<8}"
    )
    print(header)
    print("-" * 118)
    for r in results:
        vars_col = f"{r.initial_kb.primary_vars}/{r.peak_auxiliary_vars}"
        clauses_col = f"{r.initial_kb.clauses}/{r.final_kb.clauses}"
        steps_col = f"{r.deduction_steps}/{r.reveal_waves}"
        dpb_col = f"{r.decisions}/{r.propagations}/{r.backtracks}"
        time_col = f"{r.sat_runtime_ms:.2f}/{r.total_runtime_ms:.2f}"
        status_col = "PASS" if r.passed else r.status
        print(
            f"{r.puzzle_name:<18} | {r.board_size:<4} | {vars_col:<10} | {clauses_col:<12} | "
            f"{steps_col:<11} | {r.sat_calls:<9} | {dpb_col:<17} | "
            f"{time_col:<16} | {status_col:<8}"
        )
    print("-" * 118)
    passed_count = sum(1 for r in results if r.passed)
    failed_count = len(results) - passed_count
    print(
        f"Tổng kết: {passed_count}/{len(results)} PASS, {failed_count} FAIL/TIMEOUT. "
        "(Vars(P/A*): Primary / Peak Auxiliary; Clauses(I/F): Initial / Final KB)"
    )


NAMED_PUZZLES: tuple[tuple[str, PuzzleDefinition], ...] = (
    ("Market 3x3", MARKET_3X3),
    ("Gallery 3x3", GALLERY_3X3),
    ("Harbor 4x4", HARBOR_4X4),
    ("Theatre 4x4", THEATRE_4X4),
    ("Museum 5x5", MUSEUM_5X5),
    ("Observatory 5x5", OBSERVATORY_5X5),
)


def run_all_benchmarks(
    timeout_ms: float | None = DEFAULT_TIMEOUT_MS,
    verbose: bool = True,
) -> list[BenchmarkResult]:
    results = [
        run_benchmark(name, puzzle, timeout_ms=timeout_ms, verbose=verbose)
        for name, puzzle in NAMED_PUZZLES
    ]
    if verbose:
        print_summary_table(results)
    return results


if __name__ == "__main__":
    run_all_benchmarks()
