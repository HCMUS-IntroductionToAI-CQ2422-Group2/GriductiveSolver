from BackEnd.GameEngine.GameObject.constraints import Fact
from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.GameState import PublicState

from .cnf_encoder import CNFEncoder
from .DPLL_Solver import CNF, solve


class DPLLChecker:
    """Check satisfiability using only the public clues and verdicts."""

    def has_solution(
        self,
        public_state: PublicState,
        assumption: Verdict | None = None,
    ) -> bool:
        encoder = CNFEncoder(public_state.board)
        clauses: list[list[int]] = []

        for clue in public_state.revealed_clues:
            clauses.extend(encoder.encode_constraint(clue.constraint))

        for cell_id, is_criminal in public_state.proved_statuses.items():
            clauses.extend(encoder.encode_fact(Fact(cell_id, is_criminal)))

        if assumption is not None:
            clauses.extend(encoder.encode_fact(Fact(
                assumption.cell_id,
                assumption.is_criminal,
            )))

        cnf: CNF = tuple(tuple(clause) for clause in clauses)
        return solve(cnf, len(encoder.variable_map)) is not None
