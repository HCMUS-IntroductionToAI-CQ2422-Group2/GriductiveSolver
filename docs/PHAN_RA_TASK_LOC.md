# Phân rã task — phần Game Engine (Lộc)

> Phân rã chi tiết 4 file `GameEngine.py`, `GameState.py`, `ConstraintChecker.py`, `validation.py` thành các task nhỏ, có thứ tự và tiêu chí hoàn thành, để làm và review từng phần thay vì một khối lớn. Dựa trên code tại nhánh `game_engine`, 08/11/2026.

Quy ước checklist: `[ ]` chưa làm, mỗi task nên commit riêng để dễ review.

## Nhóm 0 — Chốt thiết kế trước khi code (làm trước, không tốn nhiều thời gian nhưng bắt buộc)

- [x] **0.1 Chốt nơi lưu "clue đã mở".** `PublicState.revealed_clues` cần dữ liệu nhưng `GameState` hiện chưa có field nào lưu id clue đã mở. Quyết định: thêm `revealed_clue_ids: set[int] = field(default_factory=set)` vào `GameState`. Vì đây là sửa file `GameState.py` (đã thuộc phạm vi của Lộc) nên có thể tự quyết, không cần hỏi Minh/Minh Phan — chỉ cần báo cho nhóm biết field mới này tồn tại.
  - **Đã chốt:** `revealed_clue_ids` chỉ chứa id clue **được mở trong ván** (clue có `source_cell_id` khác `None`). Clue công khai (`source_cell_id is None`) luôn hiển thị, không cần lưu vào set.
  - **Đã chốt thêm (bổ sung so với bản gốc):** ô nằm trong `initial_verdicts` coi như đã được chứng minh từ đầu, nên clue gắn với các ô đó cũng được mở ngay khi khởi tạo/`restart()`. Nếu không, những clue này sẽ không bao giờ mở được (vì submit ô đó sẽ trả `ALREADY_PROVED`).
- [x] **0.2 Chốt ai viết implementation thật của `ConstraintChecker`.** Hỏi nhóm: có ai khác nhận viết class cụ thể (ví dụ brute-force) không, hay Lộc viết luôn một bản tối thiểu để tự test được `GameEngine`/`validate_puzzle`. Khuyến nghị: Lộc viết một bản `BruteForceChecker` đơn giản (xem nhóm 2) chỉ để có checker chạy được — không cần tối ưu, vì engine chỉ cần đúng hợp đồng `has_solution`.
  - **Đã chốt:** Lộc viết `BruteForceChecker` trong file mới `BackEnd/GameEngine/BruteForceChecker.py` (giữ nguyên Protocol trong `ConstraintChecker.py`). Checker chỉ đọc `public_state.board.cells` trực tiếp (không gọi `Board.cell_count`/`board_utils`) để không bị block bởi phần của Minh. Nếu nhóm có checker khác tốt hơn, chỉ cần thay class truyền vào `GameEngine`.
- [x] **0.3 Chốt cách `validate_puzzle` báo lỗi.** Quyết định: raise exception riêng (`class PuzzleValidationError(Exception)`) với message mô tả lỗi, thay vì trả `None`/`bool` im lặng. Ghi quyết định này vào docstring của hàm.
  - **Đã chốt:** `PuzzleValidationError` đặt trong `validation.py`; hợp lệ thì trả `None`, không hợp lệ thì raise với message tiếng Anh ngắn gọn. Cần báo Hải để API bắt exception này.
- [x] **0.4 (bổ sung) Chốt cách test.** Dùng `pytest` (đã có sẵn, bản 9.1.1), test đặt trong thư mục mới `tests/` ở gốc repo, chạy bằng `python -m pytest` từ gốc repo.

## Nhóm 1 — `GameState.py`

- [x] **1.1** Thêm field `revealed_clue_ids: set[int]` vào `GameState` (theo quyết định 0.1).
- [x] **1.2** Cài `PublicState.is_complete`: so sánh `len(proved_statuses) == board.cell_count`.
  - Phụ thuộc: cần `Board.cell_count` đã được Minh cài (nếu Minh chưa xong, tạm viết `sum(len(r) for r in board.cells)` để không bị block, rồi đổi lại sau).
- [x] **1.3** Viết unit test riêng cho `is_complete`: case thiếu 1 ô → `False`; case đủ hết → `True`.

## Nhóm 2 — `ConstraintChecker.py`

- [ ] **2.1** Xác nhận `Protocol` hiện tại đủ dùng (không cần sửa file này) — chỉ cần implement một class tuân theo nó ở nơi khác (ví dụ file mới `BackEnd/GameEngine/SimpleChecker.py`, hoặc trong thư mục test).
- [ ] **2.2** (nếu theo khuyến nghị 0.2) Viết `evaluate_constraint(constraint, assignment: dict[int, bool]) -> bool | None` — trả `None` nếu assignment chưa đủ dữ liệu để quyết định, `True/False` nếu đủ:
  - [ ] 2.2.1 Case `CountConstraint`: đếm số `cell_id` trong `targets` có `assignment[id] == is_criminal`, so sánh theo `comparison`.
  - [ ] 2.2.2 Case `ParityConstraint`: đếm rồi kiểm tra chẵn/lẻ.
  - [ ] 2.2.3 Case `ConnectedConstraint`: lọc các ô thỏa `is_criminal`, kiểm tra liên thông bằng BFS/DFS qua 4 hướng orthogonal.
  - [ ] 2.2.4 Case `AllOf`: tất cả constraint con đều `True`.
- [ ] **2.3** Viết `has_solution(public_state, assumption=None)`:
  - [ ] 2.3.1 Ghép `proved_statuses` hiện tại + `assumption` (nếu có) thành partial assignment.
  - [ ] 2.3.2 Liệt kê các ô chưa có verdict, thử toàn bộ `2^n` tổ hợp còn lại (board nhỏ nên chấp nhận brute-force).
  - [ ] 2.3.3 Với mỗi tổ hợp đầy đủ, kiểm tra **mọi** clue đang có trong `public_state.revealed_clues` đều thỏa (dùng 2.2) — chỉ cần ≥1 tổ hợp thỏa hết thì trả `True`.
- [ ] **2.4** Viết test riêng cho `has_solution` với 1 puzzle nhỏ dựng tay (3–4 ô), không phụ thuộc `GameEngine`.

## Nhóm 3 — `GameEngine.py`

- [ ] **3.1** `__init__`: lưu `_puzzle`, `_checker`; tạo `_state = GameState(proved_statuses={v.cell_id: v.is_criminal for v in puzzle.initial_verdicts})`.
- [ ] **3.2** Viết helper nội bộ `_cell_exists(cell_id) -> bool` (quét `puzzle.board.cells`).
- [ ] **3.3** `get_public_state()`:
  - [ ] 3.3.1 Lọc `puzzle.clues` theo `clue.id in _state.revealed_clue_ids` hoặc `clue.source_cell_id is None` (clue công khai từ đầu) → `revealed_clues`.
  - [ ] 3.3.2 Dựng `PublicState(puzzle_id=puzzle.id, board=puzzle.board, revealed_clues=..., proved_statuses=dict(_state.proved_statuses))` — dùng `dict(...)` để trả **bản sao**, không trả tham chiếu trực tiếp vào state nội bộ.
- [ ] **3.4** `submit_verdict` — bước kiểm tra đầu vào:
  - [ ] 3.4.1 `cell_id` không tồn tại trên board → trả `SubmitResult(..., outcome=INVALID_CELL, ...)`.
  - [ ] 3.4.2 `cell_id` đã có trong `proved_statuses` → `ALREADY_PROVED`.
- [ ] **3.5** `submit_verdict` — phần suy luận logic (sau khi qua bước 3.4):
  - [ ] 3.5.1 Lấy `public_state = get_public_state()` hiện tại.
  - [ ] 3.5.2 Gọi `checker.has_solution(public_state, Verdict(cell_id, not status))` → nếu `False` thì verdict `status` bắt buộc đúng.
  - [ ] 3.5.3 Nếu không bắt buộc đúng, gọi tiếp `checker.has_solution(public_state, Verdict(cell_id, status))` để phân biệt `NOT_PROVABLE` (còn nghiệm) và `CONTRADICTED` (không còn nghiệm nào thỏa `status`).
- [ ] **3.6** `submit_verdict` — áp dụng kết quả khi `ACCEPTED`:
  - [ ] 3.6.1 Cập nhật `_state.proved_statuses[cell_id] = status`.
  - [ ] 3.6.2 Mở clue: thêm vào `_state.revealed_clue_ids` mọi `clue.id` có `clue.source_cell_id == cell_id`.
  - [ ] 3.6.3 Trả `SubmitResult(verdict=Verdict(cell_id, status), outcome=ACCEPTED, public_state=get_public_state())` (state mới, sau khi mở clue).
- [ ] **3.7** `submit_verdict` — các nhánh còn lại (`NOT_PROVABLE`, `CONTRADICTED`, `INVALID_CELL`, `ALREADY_PROVED`): trả `public_state` **không đổi** (không có side effect).
- [ ] **3.8** `restart()`: tạo lại `_state` như trong `__init__`, trả `get_public_state()`.
- [ ] **3.9** Viết test riêng cho từng outcome của `submit_verdict` (5 test case ứng với 5 giá trị `SubmitOutcome`), và 1 test cho `restart()` sau khi đã submit vài lượt.

## Nhóm 4 — `validation.py`

- [ ] **4.1** Định nghĩa `class PuzzleValidationError(Exception)` (theo quyết định 0.3) trong cùng file hoặc file riêng.
- [ ] **4.2** Kiểm tra cấu trúc:
  - [ ] 4.2.1 Tất cả `Cell.id` trong board là duy nhất.
  - [ ] 4.2.2 Mọi `cell_id` xuất hiện trong `clues[*].source_cell_id`, `solution[*].cell_id`, `initial_verdicts[*].cell_id`, và trong các `targets` của constraint đều tồn tại trong board.
  - [ ] 4.2.3 `solution` có đúng một `Verdict` cho mỗi `Cell` (không thiếu, không trùng).
- [ ] **4.3** Kiểm tra đáp án duy nhất:
  - [ ] 4.3.1 Build `PublicState` giả với **toàn bộ** `clues` đã mở (không chỉ clue công khai) và `proved_statuses` rỗng.
  - [ ] 4.3.2 Đếm số tổ hợp assignment đầy đủ thỏa hết constraint (dùng lại cơ chế enumerate ở 2.3.2, hoặc gọi `checker.has_solution` lặp lại với từng giả định để đếm). Nếu > 1 → raise lỗi "đáp án không duy nhất".
  - [ ] 4.3.3 Assignment duy nhất đó phải khớp với `puzzle.solution`, nếu không → raise lỗi "solution khai báo sai".
- [ ] **4.4** Kiểm tra giải được không cần đoán — mô phỏng ván chơi "hoàn hảo":
  - [ ] 4.4.1 Khởi tạo state giả giống `initial_verdicts`, clue công khai ban đầu.
  - [ ] 4.4.2 Lặp: với mỗi ô chưa `proved`, thử xem `checker.has_solution(state, Verdict(id, not solution[id]))` có `False` không (tức suy ra được từ thông tin **hiện có**, dùng đúng giá trị trong `solution` để mô phỏng người chơi chơi đúng).
  - [ ] 4.4.3 Nếu tìm được ≥1 ô suy ra được → cập nhật state, mở clue liên quan, lặp lại.
  - [ ] 4.4.4 Nếu một vòng không tìm được ô nào mà `is_complete` vẫn `False` → raise lỗi "đề yêu cầu đoán mò, không giải được tuần tự".
- [ ] **4.5** Viết test với ≥2 đề mẫu: 1 đề hợp lệ (phải pass), 1 đề cố ý lỗi (ví dụ 2 đáp án đều thỏa) để chắc `validate_puzzle` raise đúng lỗi.

## Nhóm 5 — Kiểm thử tích hợp (sau khi nhóm 1–4 xong)

- [ ] **5.1** Dựng 1 `PuzzleDefinition` mẫu nhỏ (3×3, 2–3 clue) thủ công trong file test, không phụ thuộc đề thật của game.
- [ ] **5.2** Test full flow: `validate_puzzle` pass → `GameEngine(puzzle, checker)` → submit đủ các ô theo đúng thứ tự suy luận được → `get_public_state().is_complete == True`.
- [ ] **5.3** Test `restart()` giữa ván: submit vài lượt, restart, kiểm tra state về lại như `initial_verdicts`.

## Thứ tự khuyến nghị khi làm

1. Nhóm 0 (quyết định) — vài phút.
2. Nhóm 1 (`GameState`) — nhỏ, làm trước để các nhóm sau có đủ field dùng.
3. Nhóm 2 (`ConstraintChecker` bản thật) — cần có trước để test được nhóm 3 và 4.
4. Nhóm 3 (`GameEngine`) — phần trung tâm.
5. Nhóm 4 (`validation`) — dùng lại nhiều logic đã viết ở nhóm 2.
6. Nhóm 5 (test tích hợp) — xác nhận toàn bộ ăn khớp.

Mỗi task đánh dấu `[x]` sau khi code + test tương ứng pass, để dễ theo dõi tiến độ tới hạn **trưa 8/11**.
