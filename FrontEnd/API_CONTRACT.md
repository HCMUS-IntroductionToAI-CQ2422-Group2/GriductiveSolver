# Data Contract: Frontend ↔ Backend API

Tài liệu này là hợp đồng dữ liệu giữa UI (`FrontEnd/`) và API (`BackEnd/APIs/`).
Hai bên chỉ được dựa vào những gì ghi ở đây.

| Nguồn | Vai trò |
| --- | --- |
| `BackEnd/APIs/schemas.py`, `BackEnd/APIs/main.py` | Cài đặt phía backend (nguồn sự thật cho kiểu dữ liệu). |
| `FrontEnd/contract/openapi.json` | Bản hợp đồng dạng máy đọc được, sinh từ backend. |
| `FrontEnd/static/js/api.js` | Adapter phía UI; gọi đúng các endpoint dưới đây. |
| `tests/test_api_contract.py` | Test giữ cho cả ba thứ trên khớp với tài liệu này. |

Mọi field giữ nguyên **snake_case** như backend trả về; `app.js` đọc trực tiếp, không đổi tên.

## 1. Kiểu dữ liệu

### `PublicStateResponse`

Trạng thái công khai của ván đang chơi. Là response của mở trang, load, restart, và nằm trong `state` của verdict và auto-solve.

| Field | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `puzzle_id` | `string` | Id của đề, một phần tử của `GET /api/puzzles`. |
| `height`, `width` | `int` | Số hàng, số cột. |
| `cells` | `Cell[]` | Đúng `height × width` phần tử. |
| `revealed_clues` | `Clue[]` | Các clue đã được mở. |
| `is_complete` | `bool` | `true` khi mọi ô đều có `is_criminal` khác `null`. |

### `Cell`

| Field | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `id` | `int` | Id ô, từ `0` đến `height × width − 1`. |
| `row`, `column` | `int` | Toạ độ, bắt đầu từ 0. `id = row × width + column`. |
| `character_name` | `string` | Tên nhân vật (UI dùng để chọn avatar). |
| `profession` | `string` | Nghề nghiệp. |
| `is_criminal` | `bool \| null` | `null` = chưa chứng minh; `true` = tội phạm; `false` = vô tội. |

### `Clue`

| Field | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `id` | `int` | Id clue (có thể không liên tục). |
| `source_cell_id` | `int \| null` | Ô có lời khai này. `null` = clue công khai từ đầu (mục "Public clues" của inspector). |
| `description_nl` | `string` | Lời khai bằng tiếng Việt, hiển thị nguyên văn. |
| `referenced_cell_ids` | `int[]` | Các ô mà clue nhắc tới, **tăng dần, không trùng**. UI dùng để tô sáng ô. |

### `Verdict`, `SatQuery`, `DeductionStep`

```text
Verdict       = { cell_id: int, is_criminal: bool }
SatQuery      = { assumption: Verdict | null, satisfiable: bool }
DeductionStep = { step: int, active_clue_ids: int[], sat_queries: SatQuery[],
                  verdict: Verdict, revealed_clue_ids: int[] }
```

- `SatQuery`: một lần hỏi bộ kiểm tra "các clue đang mở có nghiệm không, nếu giả định `assumption`?". `assumption: null` = kiểm tra bản thân các clue.
- `DeductionStep.step`: đánh số từ 1, liên tục.
- `active_clue_ids`: các clue đã mở **trước** bước này, tức là căn cứ của suy luận.
- `revealed_clue_ids`: các clue **mới** mở sau khi verdict của bước được chấp nhận.

### Bất biến backend luôn giữ

1. `cells` sắp theo thứ tự hàng rồi cột, và `cells[i].id == i`.
2. Response không bao giờ chứa đáp án hay clue chưa mở. Clue chỉ xuất hiện khi `source_cell_id` là `null` hoặc ô đó đã có verdict.
3. Một ô đã có `is_criminal` khác `null` thì không đổi nữa cho đến khi restart hoặc load đề khác.
4. Verdict bị từ chối (mọi `outcome` khác `ACCEPTED`) không làm thay đổi trạng thái.

## 2. Endpoints

| Hành động UI | Request | Response thành công | Lỗi |
| --- | --- | --- | --- |
| Mở trang | `GET /api/game` | `PublicStateResponse` | — |
| Danh sách đề | `GET /api/puzzles` | `string[]` (id đề, theo thứ tự từ dễ đến khó) | — |
| Load a case | `POST /api/game/load` body `{ puzzle_id }` | `PublicStateResponse` | 404 `PUZZLE_NOT_FOUND`, 422 |
| Restart | `POST /api/game/restart` | `PublicStateResponse` | — |
| Innocent / Criminal | `POST /api/game/verdicts` body `{ cell_id, is_criminal }` | `{ outcome, state }` | 404 `INVALID_CELL`, 422 |
| Get a hint | `GET /api/game/hint` | `{ status, verdict, sat_queries }` | — |
| Auto solve | `POST /api/game/auto-solve` | `{ status, state, trace }` | 409 |

### `POST /api/game/verdicts`

`cell_id` phải là số nguyên và `is_criminal` phải là boolean thật (`"1"`, `"true"` đều bị từ chối với 422).

| `outcome` | Nghĩa | UI làm gì |
| --- | --- | --- |
| `ACCEPTED` | Verdict được chứng minh; `state` đã cập nhật và có thể có clue mới. | Lật ô, hiện clue mới. |
| `NOT_PROVABLE` | Cả hai khả năng vẫn còn mở. | Toast, tính là một lỗi. |
| `CONTRADICTED` | Verdict trái với các clue đang mở. | Toast, tính là một lỗi. |
| `ALREADY_PROVED` | Ô này đã có verdict. | Toast. |

### `GET /api/game/hint`

| `status` | `verdict` | Nghĩa |
| --- | --- | --- |
| `FOUND` | `Verdict` | Một nước đi đã được chứng minh. |
| `SOLVED` | `null` | Ván đã xong. |
| `UNKNOWN` | `null` | Không ô nào chứng minh được (đề lỗi, cần đoán). |
| `INCONSISTENT` | `null` | Các clue đang mở mâu thuẫn nhau. |

`sat_queries` luôn có ít nhất một phần tử; phần tử đầu là `{ assumption: null, ... }`.
Hint chỉ đọc, không thay đổi trạng thái.

### `POST /api/game/auto-solve`

| `status` | Nghĩa |
| --- | --- |
| `SOLVED` | Đã giải hết; `state.is_complete` là `true`. |
| `STUCK` | Dừng giữa chừng vì không còn nước chứng minh được; `state` là chỗ dừng. |
| `INCONSISTENT` | Các clue đang mở mâu thuẫn nhau. |

Auto-solve chỉ đi tiếp từ trạng thái hiện tại, không restart. UI phát lại `trace` từng bước trên trạng thái trước khi gọi: với mỗi bước, gán `verdict` vào ô và thêm `revealed_clue_ids`. Cuối cùng phải ra đúng `state`.

409 chỉ xảy ra nếu engine từ chối một nước mà agent đã chứng minh (lỗi nội bộ). Khi đó `detail` là mã `outcome`, ví dụ `"NOT_PROVABLE"`.

## 3. Lỗi

Mọi lỗi HTTP có dạng `{ "detail": ... }`.

| HTTP | `detail` | Khi nào |
| --- | --- | --- |
| 404 | `"PUZZLE_NOT_FOUND"` | `puzzle_id` không có trong `GET /api/puzzles`. |
| 404 | `"INVALID_CELL"` | `cell_id` không có trên bảng. |
| 409 | mã `outcome` | Auto-solve bị engine từ chối (lỗi nội bộ). |
| 422 | `[{ loc, msg, type, ... }]` | Body sai kiểu hoặc thiếu field. |

`api.js` ném `ApiError(status, detail)`; `status: 0` nghĩa là không kết nối được backend. UI hiện modal.

## 4. Chạy và kết nối

`api.js` mặc định gọi **cùng origin** (`/api/...`). FastAPI phục vụ UI tại `/app/` và API tại `/api/` trên cùng origin.

Khi chạy UI từ server khác (ví dụ Live Server ở cổng 5500), ghi đè địa chỉ API bằng `?api=http://127.0.0.1:8000` hoặc đặt `window.GRIDUCTIVE_API_BASE` trước khi load `app.js`. Backend cho phép CORS từ `localhost` và `127.0.0.1` ở mọi cổng, chỉ với `GET` và `POST`.

Cài đặt, chạy server, chạy test và các lỗi thường gặp: xem mục **Cách chạy** trong [README.md](../README.md#cách-chạy).

## 5. Chế độ offline

Nếu không gọi được backend, UI tự chuyển sang `mock/state.js` (chế độ "OFFLINE · MOCK", chỉ xem; verdict, hint và auto-solve bị khoá).
Mọi state trong `mock/state.js` phải đúng shape và bất biến của `PublicStateResponse` ở mục 1.
Không bao giờ đưa đáp án hoặc clue chưa mở vào dữ liệu FrontEnd.

## 6. Khi đổi hợp đồng

1. Sửa `BackEnd/APIs/schemas.py` / `main.py`, rồi cập nhật tài liệu này và `static/js/api.js`.
2. Sinh lại bản máy đọc được và commit nó:
   ```bash
   python -m FrontEnd.tools.export_contract
   ```
3. Chạy `python -m pytest tests -q`. `tests/test_api_contract.py` báo lỗi nếu:
   - `contract/openapi.json` cũ hơn backend;
   - backend có endpoint `/api/...` không được ghi ở đây hoặc không có trong `api.js`;
   - response sai shape, lộ dữ liệu ẩn, hoặc sai mã lỗi;
   - `mock/state.js` sai shape (cần Node.js; test tự bỏ qua nếu máy không có).

Chỉ **thêm** field mới thì UI cũ vẫn chạy. **Đổi tên, xoá field hoặc đổi kiểu** thì phải sửa UI trong cùng PR.
