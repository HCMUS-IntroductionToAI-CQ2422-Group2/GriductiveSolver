import { initialPublicState } from "../../mock/state.js";

// Adapter cho Backend API (BackEnd/APIs/main.py + schemas.py).
// Mọi field giữ nguyên snake_case như backend trả về; app.js đọc trực tiếp.
//
// API base:
//   - Mặc định "" (cùng origin): dùng khi FrontEnd được serve bởi chính FastAPI.
//   - Ghi đè bằng query `?api=http://localhost:8000` hoặc `window.GRIDUCTIVE_API_BASE`.
const API_BASE = (
  new URLSearchParams(window.location.search).get("api")
  ?? window.GRIDUCTIVE_API_BASE
  ?? ""
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(status, detail) {
    super(formatDetail(detail));
    this.name = "ApiError";
    this.status = status; // 0 = không kết nối được backend
    this.detail = detail; // vd. "PUZZLE_NOT_FOUND", "INVALID_CELL", hoặc list lỗi 422
  }
}

function formatDetail(detail) {
  if (Array.isArray(detail)) return detail.map((item) => item.msg ?? JSON.stringify(item)).join("; ");
  return String(detail ?? "Unknown error");
}

async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(0, `Cannot reach backend at ${API_BASE || window.location.origin} (${error.message})`);
  }
  let data = null;
  try { data = await response.json(); } catch { /* body rỗng hoặc không phải JSON */ }
  if (!response.ok) throw new ApiError(response.status, data?.detail ?? response.statusText);
  return data;
}

/**
 * Kiểu dữ liệu (khớp schemas.py):
 *   PublicStateResponse = { puzzle_id, height, width, is_complete,
 *     cells: [{ id, row, column, character_name, profession, is_criminal: bool|null }],
 *     revealed_clues: [{ id, source_cell_id: int|null, description_nl, referenced_cell_ids: int[] }] }
 *   Verdict       = { cell_id, is_criminal }
 *   SatQuery      = { assumption: Verdict|null, satisfiable }
 */
export class GameApi {
  mode = "live";

  /** GET /api/puzzles -> string[] */
  listPuzzles() { return request("/api/puzzles"); }

  /** GET /api/game -> PublicStateResponse */
  getGame() { return request("/api/game"); }

  /** POST /api/game/load {puzzle_id} -> PublicStateResponse (404 PUZZLE_NOT_FOUND) */
  loadPuzzle(puzzleId) { return request("/api/game/load", { method: "POST", body: { puzzle_id: puzzleId } }); }

  /** POST /api/game/restart -> PublicStateResponse */
  restart() { return request("/api/game/restart", { method: "POST" }); }

  /**
   * POST /api/game/verdicts {cell_id, is_criminal}
   * -> { outcome: "ACCEPTED"|"NOT_PROVABLE"|"CONTRADICTED"|"ALREADY_PROVED", state }
   * (INVALID_CELL trả HTTP 404)
   */
  submitVerdict(cellId, isCriminal) {
    return request("/api/game/verdicts", { method: "POST", body: { cell_id: cellId, is_criminal: isCriminal } });
  }

  /** GET /api/game/hint -> { status: "FOUND"|"UNKNOWN"|"SOLVED"|"INCONSISTENT", verdict, sat_queries } */
  hint() { return request("/api/game/hint"); }

  /** POST /api/game/auto-solve -> { status: "SOLVED"|"STUCK"|"INCONSISTENT", state, trace } */
  autoSolve() { return request("/api/game/auto-solve", { method: "POST" }); }
}

/**
 * Chế độ offline khi không gọi được backend: chỉ hiển thị public state mẫu.
 * Không tự bịa kết quả verdict/hint vì FrontEnd không có đáp án.
 */
export class MockGameApi {
  mode = "mock";
  #state = structuredClone(initialPublicState);
  #offline() { return Promise.reject(new ApiError(0, "Backend is offline — this action needs the live API.")); }
  async listPuzzles() { return [this.#state.puzzle_id]; }
  async getGame() { return structuredClone(this.#state); }
  async loadPuzzle() { return this.restart(); }
  async restart() { this.#state = structuredClone(initialPublicState); return this.getGame(); }
  submitVerdict() { return this.#offline(); }
  hint() { return this.#offline(); }
  autoSolve() { return this.#offline(); }
}
