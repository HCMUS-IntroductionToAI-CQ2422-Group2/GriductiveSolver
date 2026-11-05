from __future__ import annotations

from typing import Protocol

from BackEnd.GameEngine.GameObject.objects import Verdict
from BackEnd.GameEngine.GameState import PublicState


class ConstraintChecker(Protocol):
    def has_solution(
        self,
        public_state: PublicState,
        assumption: Verdict | None = None,
    ) -> bool:
        """Check public constraints with an optional temporary verdict."""
        ...
