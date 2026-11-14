from dataclasses import dataclass
from time import perf_counter


@dataclass
class DPLLStats:
    decisions: int = 0
    propagations: int = 0
    backtracks: int = 0
    runtime_ms: float = 0.0


CNF=tuple[tuple[int,...], ...]

def simplify(cnf: CNF, literial: int) -> CNF:
    remaining = []
    for clause in cnf:
        if literial in clause:
            continue

        reduce_clause= tuple(value for value in clause if value != -literial)
        remaining.append(reduce_clause)

    return tuple(remaining)

def propagate(cnf: CNF, assignment: dict[int, bool], stats: DPLLStats | None = None) -> tuple[CNF, dict[int, bool]] | None:
    updated_assignment= assignment.copy()

    while True:
        if () in cnf:
            return None
        unit = next((clause[0] for clause in cnf if len(clause) ==1), None,)

        if unit is None:
            return cnf, updated_assignment
        updated_assignment[abs(unit)] = unit >0
        if stats is not None:
            stats.propagations += 1
        cnf = simplify(cnf, unit)

def solve(cnf: CNF, num_vars: int, stats: DPLLStats | None = None) -> dict[int, bool] | None:
    def search(remaining_cnf: CNF, assignment: dict[int, bool], ) -> dict[int, bool ] | None:
        propagated=propagate(remaining_cnf, assignment, stats)

        if propagated is None:
            return None

        reduced_cnf, propagated_assignment= propagated
        if not reduced_cnf:
            return propagated_assignment

        variable=min(abs(literial) for clause in reduced_cnf for literial in clause)
        for literial in (variable, -variable):
            if stats is not None:
                stats.decisions += 1
            branch_assignment=propagated_assignment.copy()
            branch_assignment[variable]=literial>0
            branch_cnf= simplify(reduced_cnf, literial)
            result= search(branch_cnf, branch_assignment)
            if result is not None:
                return result
            if stats is not None:
                stats.backtracks += 1

        return None
    started_at = perf_counter()
    result = search(cnf, {})

    if stats is not None:
        stats.runtime_ms = (perf_counter() - started_at) * 1000

    if result is None:
        return None
    return {variable: result.get(variable, False) for variable in range(1, num_vars+1)}
