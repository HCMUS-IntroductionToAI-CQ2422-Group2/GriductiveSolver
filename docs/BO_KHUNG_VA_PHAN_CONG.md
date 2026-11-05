# Bộ khung và phân công

Hiện tại chỉ có khai báo dữ liệu và hàm; logic game chưa được cài đặt.
Các đường dẫn dưới đây tính từ thư mục gốc dự án.

## Công dụng các file

| File / thư mục | Công dụng |
| --- | --- |
| `BackEnd/GameEngine/GameObject/objects.py` | Khai báo `Cell`, `Board`, `Verdict`, `Clue`, `PuzzleDefinition`: ô, bàn, kết luận, manh mối và đề kèm đáp án. |
| `BackEnd/GameEngine/GameObject/constraints.py` | Biểu diễn logic clue: đếm, so sánh, chẵn/lẻ, liên thông và kết hợp nhiều ràng buộc. Chưa có hàm xử lý. |
| `BackEnd/GameEngine/GameObject/board_utils.py` | Lấy các nhóm ID ô theo hàng, cột, hàng xóm hoặc nghề nghiệp. |
| `BackEnd/GameEngine/GameState.py` | `GameState` lưu verdict đã xác nhận; `PublicState` chứa thông tin được phép công khai. |
| `BackEnd/GameEngine/ConstraintChecker.py` | Khai báo giao diện bộ kiểm tra nghiệm từ thông tin công khai. |
| `BackEnd/GameEngine/GameEngine.py` | Điều phối ván, nhận verdict, công khai clue; khai báo `SubmitOutcome` và `SubmitResult`. |
| `BackEnd/GameEngine/validation.py` | Kiểm tra tính hợp lệ và khả năng giải của đề. |
| `BackEnd/APIs/` | Phần FastAPI kết nối UI với engine; hiện chỉ có `__init__.py`. |
| `FrontEnd/` | Phần giao diện bàn chơi; hiện chưa có file. |
| Các file `__init__.py` | Đánh dấu package Python; hiện chưa có logic. |

## Công dụng các hàm và property

| Hàm / property | Công dụng dự kiến |
| --- | --- |
| `Board.height`, `Board.width`, `Board.cell_count` | Trả số hàng, số cột và tổng số ô. |
| `row_ids(board, row)` | Lấy ID các ô trong một hàng. |
| `column_ids(board, column)` | Lấy ID các ô trong một cột. |
| `neighbor_ids(board, cell_id)` | Lấy ID hàng xóm, gồm đường chéo, không gồm chính ô đó. |
| `profession_ids(board, profession)` | Lấy ID các ô có cùng nghề nghiệp. |
| `PublicState.is_complete` | Kiểm tra toàn bộ ô đã có verdict được xác nhận chưa. |
| `ConstraintChecker.has_solution(public_state, assumption)` | Kiểm tra có nghiệm thỏa thông tin công khai và verdict giả định tùy chọn không. |
| `GameEngine.__init__(puzzle, checker)` | Nhận đề, bộ kiểm tra và khởi tạo trạng thái ban đầu. |
| `GameEngine.get_public_state()` | Trả bản sao chỉ đọc của thông tin công khai, không lộ đáp án và clue ẩn. |
| `GameEngine.submit_verdict(cell_id, status)` | Kiểm tra verdict có được chứng minh; nếu chấp nhận thì cập nhật trạng thái và mở clue. |
| `GameEngine.restart()` | Khôi phục trạng thái ban đầu của đề. |
| `validate_puzzle(puzzle, checker)` | Kiểm tra cấu trúc, đáp án duy nhất và tiến trình giải không cần đoán. |

## Phân công

Phân chia file theo các đầu việc trong ảnh; các file API/UI sẽ do người phụ trách tạo.

| Người | File / phạm vi phụ trách | Hạn |
| --- | --- | --- |
| Minh | `BackEnd/GameEngine/GameObject/objects.py`, `BackEnd/GameEngine/GameObject/board_utils.py` — Game Object và truy vấn bàn. | 7/11 |
| Minh Phan | `BackEnd/GameEngine/GameObject/constraints.py` — biểu diễn clue; hỗ trợ Bảo tìm assets cho UI. | Trưa 8/11 |
| Bảo | Các file trong `FrontEnd/` — UI và tích hợp assets. | 8/11 |
| Lộc | `BackEnd/GameEngine/GameEngine.py`, `BackEnd/GameEngine/GameState.py`, `BackEnd/GameEngine/ConstraintChecker.py`, `BackEnd/GameEngine/validation.py` — engine và kiểm tra logic. | Trưa 8/11 |
| Hải | Các file trong `BackEnd/APIs/` — FastAPI và kết nối engine. | Trưa 8/11 |
