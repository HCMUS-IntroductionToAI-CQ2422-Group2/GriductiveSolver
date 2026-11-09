# UI redesign — Griductive Solver

Người phụ trách: Bảo (FrontEnd). Phạm vi: chỉ thư mục `FrontEnd/`. Không đổi API, không đổi tên field/biến dùng chung với backend.

Mục tiêu: người chơi luôn nhìn thấy manh mối, đưa ra phán quyết nhanh, và không bị modal chặn mỗi lần thao tác.

## Kế hoạch theo PR

| PR | Nội dung | Trạng thái |
| --- | --- | --- |
| ① Bố cục + panel manh mối | Bỏ sidebar; thanh trên cùng gồm case + Load a case, tiến độ, Hint / Auto solve / Restart; bảng ~65% + panel clue luôn mở ~35%; clue mới nổi lên đầu với nhãn NEW; rê chuột clue ↔ nhân vật để highlight hai chiều; bỏ nút Inspect clue; gom chữ UI vào `TEXT` trong `app.js` | Đang review |
| ② Chơi mượt | Phán quyết Innocent/Criminal ngay trên thẻ (bỏ verdict panel); phím tắt ←↑→↓, `I`, `C`, `H`, `Esc`, `?`; đoán sai → thẻ rung + toast thay cho modal; bộ đếm "Mistakes · Hints" (reset khi Restart / Load a case); Hint 2 nấc (sáng ô trước, nói phán quyết sau) | Chưa làm |
| ③ Trình diễn | Phát lại Auto solve từng bước trên bảng (~700ms/bước, khoá bảng, Pause/Skip); kết quả khi thắng hiện ngay trên trang (Mistakes, Hints, Play again, Next case); dải thông báo offline + Retry connection | Chưa làm |

Chỉ 3 hiệu ứng chuyển động (chuyển màu khi chứng minh, rung khi sai, clue trượt vào), tất cả tắt khi người dùng bật `prefers-reduced-motion`.

## Giữ nguyên có chủ đích

- **Ngôn ngữ UI:** tiếng Anh. Clue từ backend vẫn là tiếng Việt. Toàn bộ chữ UI nằm trong object `TEXT` ở đầu `static/js/app.js`, đổi ngôn ngữ chỉ sửa một chỗ.
- **Load a case:** vẫn xoay vòng sang đề kế tiếp như cũ, chỉ chuyển nút lên thanh trên cùng.
- **Thuật ngữ trên UI** (revealed / verdict / clue): giữ như hiện tại.

## Cần leader chốt (không nằm trong phạm vi FrontEnd)

1. **Thuật ngữ chung của nhóm.** Code và UI đang dùng nhiều từ cho cùng một khái niệm: `cell` / card / character cho một ô; revealed / proved / public knowledge cho một nhân vật đã có phán quyết. Đề xuất:
   - Nhân vật (character): một ô trên bảng.
   - Phán quyết (verdict): kết luận Innocent / Criminal cho một nhân vật.
   - Đã chứng minh (proven): nhân vật đã có phán quyết được chấp nhận.
   - Manh mối (clue): nội dung mở ra khi một nhân vật được chứng minh.
   - Manh mối công khai (public clue): manh mối có sẵn từ đầu (`source_cell_id = null`).
2. **Danh sách đề.** Muốn cho người chơi chọn đề thay vì xoay vòng thì `GET /api/puzzles` nên trả thêm kích thước bảng (ví dụ `[{puzzle_id, height, width}]`). Việc này thuộc người phụ trách API.

## Kiểm tra

Mỗi PR được chạy thử bằng Chrome headless trên cả backend thật lẫn chế độ mock: bàn 3×3 và 5×5, màn hình rộng 1440px và hẹp 820px.
