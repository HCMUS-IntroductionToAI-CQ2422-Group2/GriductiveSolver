import { initialPublicState } from "../../mock/state.js";

// API contract is not finalized yet. This adapter intentionally stays in mock mode.
export class GameApi {
  constructor() { this.state = structuredClone(initialPublicState); }
  async load() { return structuredClone(this.state); }
  async restart() { this.state = structuredClone(initialPublicState); return this.load(); }
  async submitVerdict(_cellId, _status) {
    // Do not fabricate accepted verdicts: the mock contains no hidden solution.
    return { outcome: "MOCK_UNAVAILABLE", message: "Verdict checking is waiting for the agreed API contract." };
  }
  async hint() { return { available: false, message: "Hint endpoint is not available in the current API contract." }; }
  async autoSolve() { return { available: false, message: "Auto Solve endpoint is not available in the current API contract." }; }
}
