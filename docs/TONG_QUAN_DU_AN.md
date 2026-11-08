# Tổng quan dự án GriductiveSolver

> Tài liệu này tóm tắt trạng thái hiện tại của repo và phân tích chi tiết phần việc của Lộc, dựa trên code thực tế tại thời điểm viết (06/11/2026, branch `game_engine`).

## 1. Dự án là gì

GriductiveSolver là một game giải đố suy luận logic kiểu "ai là tội phạm": mỗi ô (`Cell`) trên bàn (`Board`) đại diện cho một nhân vật có nghề nghiệp riêng, người chơi phải dùng các manh mối (`Clue`) để suy ra ô nào `is_criminal = True/False` (`Verdict`). Mỗi lượt, người chơi nộp một verdict; engine chỉ chấp nhận nếu verdict đó **được chứng minh chắc chắn** bởi thông tin công khai hiện tại (không cho đoán mò) — nộp đúng sẽ mở thêm clue ẩn gắn với ô đó.

Kiến trúc dự kiến: `BackEnd` (Python, engine + FastAPI) phục vụ `FrontEnd` (UI bàn chơi, chưa có file nào).

## 2. Cấu trúc thư mục hiện tại

```
BackEnd/
  APIs/                         # FastAPI nối UI–engine, hiện chỉ có __init__.py rỗng
  GameEngine/
    GameObject/
      objects.py                # Cell, Board, Verdict, Clue, PuzzleDefinition
      constraints.py            # Comparison, Count, CountConstraint, ParityConstraint,
                                 # ConnectedConstraint, AllOf, Constraint
      board_utils.py            # row_ids, column_ids, neighbor_ids, profession_ids
    GameState.py                 # GameState, PublicState
    ConstraintChecker.py         # Protocol ConstraintChecker.has_solution
    GameEngine.py                 # GameEngine, SubmitOutcome, SubmitResult
    validation.py                 # validate_puzzle
docs/
  BO_KHUNG_VA_PHAN_CONG.md      # Bảng công dụng file/hàm + phân công nhân sự
FrontEnd/                        # Chưa tồn tại
```

## 3. Trạng thái hiện tại

Toàn bộ repo mới ở mức **khung khai báo (type/dataclass/signature)**, chưa có logic:

- Mọi hàm/method/property đều `raise NotImplementedError` hoặc là thân rỗng.
- `requirement.txt` rỗng — chưa khai báo dependency nào (kể cả FastAPI).
- `BackEnd/APIs/` chỉ có `__init__.py` trống.
- `FrontEnd/` chưa có file nào.
- Không có test nào trong repo.

Nói cách khác: data model (`objects.py`, `constraints.py`) đã được thiết kế khá đầy đủ về kiểu dữ liệu, nhưng **không có gì chạy được** — mọi người đang cài phần logic của mình trên cùng một khung đã thống nhất.

## 4. Phân công (từ `docs/BO_KHUNG_VA_PHAN_CONG.md`)

| Người | Phạm vi | Hạn |
| --- | --- | --- |
| Minh | `objects.py`, `board_utils.py` | 7/11 |
| Minh Phan | `constraints.py` | Trưa 8/11 |
| Bảo | `FrontEnd/` | 8/11 |
| **Lộc** | `GameEngine.py`, `GameState.py`, `ConstraintChecker.py`, `validation.py` | **Trưa 8/11** |
| Hải | `BackEnd/APIs/` | Trưa 8/11 |

## 5. Phân tích task của Lộc

Lộc phụ trách **lõi engine và kiểm tra logic** — phần "trọng tài" của game. Đây là lớp điều phối nằm trên data model (Minh) và constraint system (Minh Phan), nên về mặt kỹ thuật phụ thuộc vào 2 phần đó đã có interface ổn định (đã có, dù thân hàm chưa cài).

### 5.1. `GameState.py` — trạng thái

- `GameState.proved_statuses: dict[int, bool]` — đã có field, không cần implement thêm (đây là state nội bộ, engine sẽ đọc/viết trực tiếp).
- `PublicState.is_complete` (property) — **cần cài**: trả `True` khi `len(proved_statuses) == board.cell_count` (so với tổng số ô của `board`, dùng `Board.cell_count` mà Minh sẽ cài).

### 5.2. `ConstraintChecker.py` — interface kiểm tra nghiệm

- Đây là `Protocol`, bản thân không cần cài logic — chỉ định nghĩa hợp đồng `has_solution(public_state, assumption=None) -> bool`.
- Lộc **không viết implementation cụ thể** ở đây (ví dụ SAT/backtracking solver) — chỉ giữ interface; việc cần làm là đảm bảo `GameEngine` và `validate_puzzle` gọi đúng hợp đồng này. Cần làm rõ với nhóm: ai cài class implement `ConstraintChecker` thật (có thể là chính Lộc, hoặc một phần riêng không nằm trong bảng phân công — nên hỏi lại).

### 5.3. `GameEngine.py` — điều phối ván chơi (phần nặng nhất)

Cần cài 4 chỗ:

1. **`__init__(puzzle, checker)`**: lưu `_puzzle`, `_checker`; khởi tạo `_state = GameState(proved_statuses={v.cell_id: v.is_criminal for v in puzzle.initial_verdicts})`.
2. **`get_public_state()`**: dựng `PublicState` từ `_state` + `_puzzle` — phải là **bản sao read-only**, không để lộ `puzzle.solution` hay các `Clue` chưa mở. Cần quyết định cơ chế "clue nào đã mở" — hiện `PublicState.revealed_clues` tồn tại nhưng `GameState` **chưa có field lưu danh sách clue đã mở**. Đây là một lỗ hổng thiết kế cần xử lý trước khi code chạy đúng: có thể cần thêm `revealed_clue_ids: set[int]` vào `GameState` (một thay đổi ngoài phạm vi "chỉ sửa 4 file" nếu muốn giữ nguyên `objects.py`/`GameState.py` do người khác phụ trách — nên trao đổi với Minh/Minh Phan).
3. **`submit_verdict(cell_id, status)`**:
   - Kiểm tra `cell_id` hợp lệ trong board → nếu không, trả `INVALID_CELL`.
   - Nếu `cell_id` đã có trong `proved_statuses` → trả `ALREADY_PROVED`.
   - Dùng `checker.has_solution(public_state, assumption=Verdict(cell_id, not status))` — nếu **không có nghiệm** khi giả định ngược lại thì verdict `status` được chứng minh chắc chắn → cập nhật state, mở các `Clue` có `source_cell_id == cell_id`, trả `ACCEPTED`.
   - Nếu giả định ngược lại vẫn có nghiệm nhưng giả định `status` đúng cũng có nghiệm → `NOT_PROVABLE`.
   - Nếu giả định `status` đúng mà **không** có nghiệm (verdict mâu thuẫn với dữ kiện) → `CONTRADICTED`.
4. **`restart()`**: reset `_state` về `initial_verdicts`/clue công khai ban đầu, trả `PublicState` mới.

### 5.4. `validation.py` — kiểm tra đề hợp lệ

`validate_puzzle(puzzle, checker)` cần kiểm tra 3 việc (theo mô tả trong `BO_KHUNG_VA_PHAN_CONG.md`):

1. **Cấu trúc hợp lệ**: mọi `cell_id` trong `clues`/`solution`/`initial_verdicts` tồn tại trong `board`; không trùng `Cell.id`.
2. **Đáp án duy nhất**: `puzzle.solution` là nghiệm duy nhất thỏa mọi constraint — có thể cài bằng cách duyệt toàn bộ tổ hợp verdict còn lại (hoặc nhờ `checker` liệt kê), so sánh với `solution`.
3. **Giải được không cần đoán**: mô phỏng lại toàn bộ ván chơi từ `initial_verdicts`, lần lượt dùng `checker.has_solution` để kiểm tra có luôn tồn tại ít nhất một ô "suy ra được chắc chắn" ở mỗi bước, đến khi `is_complete` — nếu có bước nào bị "kẹt" (không ô nào chứng minh được) thì đề không hợp lệ.

Hàm này không trả gì khi hợp lệ (`-> None`) — cần quyết định: raise exception khi không hợp lệ, hay đổi signature trả `bool`/danh sách lỗi? Hiện chưa có cách báo lỗi, nên nên thống nhất sớm với nhóm (ảnh hưởng cách Hải dùng nó trong API).

### 5.5. Việc cần làm trước khi code (phối hợp nhóm)

- Chốt với Minh Phan: `ConstraintChecker` thật implement bằng cách nào (brute-force theo `board.cell_count` nhỏ, hay SAT solver) — ai viết class implement.
- Chốt cơ chế lưu "clue đã mở" trong `GameState` (thêm field) trước khi cài `GameEngine.get_public_state()`/`submit_verdict()`.
- Chốt cách `validate_puzzle` báo lỗi (exception vs return value).
- Viết test cho 4 file này sau khi `objects.py`/`board_utils.py`/`constraints.py` có logic thật (phụ thuộc Minh và Minh Phan hoàn thành trước 7–8/11).

**Hạn: Trưa 8/11/2026.**
