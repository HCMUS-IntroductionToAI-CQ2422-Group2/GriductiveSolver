# Frontend ↔ Backend API contract

Nguồn sự thật: `BackEnd/APIs/schemas.py` và `BackEnd/APIs/main.py` (nhánh `main`).
`static/js/api.js` gọi đúng các endpoint dưới đây; `app.js` đọc nguyên field snake_case của backend.

## Kiểu dữ liệu

```text
PublicStateResponse = {
  puzzle_id: str, height: int, width: int, is_complete: bool,
  cells: [{ id, row, column, character_name, profession, is_criminal: bool | null }],
  revealed_clues: [{ id, source_cell_id: int | null, description_nl, referenced_cell_ids: int[] }]
}
Verdict  = { cell_id: int, is_criminal: bool }
SatQuery = { assumption: Verdict | null, satisfiable: bool }
```

- `cell.is_criminal`: `null` = chưa chứng minh; `true/false` = đã chứng minh (thay cho `provedStatuses` cũ).
- `source_cell_id: null` = clue công khai từ đầu (hiện trong danh sách "Public clues" của inspector).

## Endpoints

| Hành động UI | Request | Response |
| --- | --- | --- |
| Mở trang | `GET /api/game` | `PublicStateResponse` |
| Load a case | `GET /api/puzzles` → `POST /api/game/load` `{puzzle_id}` | `string[]` → `PublicStateResponse` (404 `PUZZLE_NOT_FOUND`) |
| Restart | `POST /api/game/restart` | `PublicStateResponse` |
| Innocent / Criminal | `POST /api/game/verdicts` `{cell_id, is_criminal}` | `{outcome: "ACCEPTED" \| "NOT_PROVABLE" \| "CONTRADICTED" \| "ALREADY_PROVED", state}` (404 `INVALID_CELL`, 422 sai kiểu) |
| Get a hint | `GET /api/game/hint` | `{status: "FOUND" \| "UNKNOWN" \| "SOLVED" \| "INCONSISTENT", verdict, sat_queries}` |
| Auto solve | `POST /api/game/auto-solve` | `{status: "SOLVED" \| "STUCK" \| "INCONSISTENT", state, trace: DeductionStep[]}` (409 nếu engine từ chối verdict) |

`DeductionStep = { step, active_clue_ids, sat_queries, verdict, revealed_clue_ids }`.

Lỗi HTTP có dạng `{ "detail": ... }`; `api.js` ném `ApiError(status, detail)` và UI hiện modal.

## Cách chạy

`api.js` mặc định gọi **cùng origin** (`/api/...`). Có thể ghi đè bằng `?api=http://localhost:8000`
hoặc đặt `window.GRIDUCTIVE_API_BASE` trước khi load `app.js`.

Hiện `main.py` **chưa serve FrontEnd và chưa bật CORS**, nên cần một trong hai thay đổi phía API (phần của người phụ trách `BackEnd/APIs/`):

1. Serve FrontEnd cùng origin (khuyến nghị) — thêm vào cuối `main.py`:
   ```python
   from pathlib import Path
   from fastapi.staticfiles import StaticFiles
   app.mount("/app", StaticFiles(directory=Path(__file__).resolve().parents[2] / "FrontEnd", html=True), name="frontend")
   ```
   Chạy `uvicorn BackEnd.APIs.main:app --reload` rồi mở `http://localhost:8000/app/`.
2. Hoặc bật CORS (`fastapi.middleware.cors.CORSMiddleware`) và serve FrontEnd riêng
   (`python -m http.server 5500` trong `FrontEnd/`), mở `http://localhost:5500/?api=http://localhost:8000`.

Nếu không gọi được backend, UI tự chuyển sang `mock/state.js` (chế độ "OFFLINE · MOCK", chỉ xem; verdict/hint/auto-solve bị khoá).
`mock/state.js` dùng cùng shape `PublicStateResponse` và cùng dữ liệu với `make_demo_puzzle()`.

Trình duyệt chỉ nhận thông tin công khai. Không bao giờ đưa đáp án hoặc clue chưa mở vào API response hay dữ liệu FrontEnd.
