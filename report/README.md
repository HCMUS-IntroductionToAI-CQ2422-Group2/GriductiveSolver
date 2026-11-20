# Báo cáo FIT-HCMUS — PDFLaTeX

Đây là bản LaTeX của [lenbui/report-template](https://github.com/lenbui/report-template/tree/ae917274977e2de03d5eec9f51fc609a99aad829/latex), đã chỉnh để biên dịch bằng **PDFLaTeX** trong Prism.

## Dùng trong Prism

1. Tải toàn bộ thư mục này lên Prism, giữ nguyên main.tex, fit_hcmus.sty, sections/, figures/ và references.bib.
2. Chọn **main.tex** làm tài liệu chính.
3. Chọn **PDFLaTeX** làm compiler rồi build lại.

Không chỉ tải riêng main.tex: tệp này dùng package fit_hcmus.sty, các phần trong sections/ và logo trong figures/.

## Cấu trúc nội dung và cách viết

- `main.tex` ghép các phần, tài liệu tham khảo và phụ lục; giữ nguyên cấu hình bìa trong file này.
- `sections/01_introduction.tex` đến `sections/08_conclusion.tex` là các file tổng hợp: mỗi file khai báo một `\section` và nạp các file con bằng `\input`.
- Thư mục con giữ quy ước `<tên_phần>_<số_thứ_tự>`, tương tự `introduction_01/` đã có. Mỗi file con tương ứng một `\subsection` và bắt đầu bằng tiêu đề cùng comment `% Note:` hướng dẫn nội dung cần viết.
- Chỉ chia đến cấp `\subsection`; các ý chi tiết hơn được mô tả trong Note. Note là comment trong mã nguồn, không xuất hiện trong PDF.
- `sections/front_matter/` chứa tóm tắt và danh mục ký hiệu dưới dạng `\subsection*` không đánh số.
- `sections/09_appendix.tex` ghép các file trong `sections/appendix_09/`, được nạp sau tài liệu tham khảo.
- Giữ hình trong `figures/`, khai báo nguồn thực tế trong `references.bib` và trích dẫn ở nơi sử dụng. Không giữ các tài liệu tham khảo mẫu không liên quan trong bản nộp.
- Bảng thành viên hiện có được giữ nguyên; nhóm cần xác nhận các mức hoàn thành bằng minh chứng trước khi nộp.

| Phần | Nhóm phụ trách nội dung |
| --- | --- |
| 01 — Giới thiệu và kế hoạch | Cả nhóm |
| 02 — Mô hình hóa bài toán | Game Engine và Game Agent |
| 03 — Game Engine | Game Engine |
| 04 — CNF và thuật toán suy luận | Game Agent |
| 05 — UI và API | UI & API |
| 06 — Thiết kế và kiểm chứng map | Check 6 map |
| 07 — Thực nghiệm | Benchmark |
| 08 — Kết luận | Cả nhóm |
| 09 — Phụ lục | Thành viên phụ trách từng nội dung |

## Biên dịch tại máy

Chạy trong thư mục này:

```sh
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

Cần chạy lại PDFLaTeX sau BibTeX để cập nhật tài liệu tham khảo và mục lục. Nếu Prism tự chạy BibTeX, chỉ cần dùng lệnh build thông thường của Prism.

Mục tài liệu tham khảo chỉ hiện các mục đã được trích dẫn trong nội dung. Mẫu hiện chưa có lệnh `\cite`; hãy trích dẫn một khóa trong references.bib, chẳng hạn `\cite{goodfellow2016deep}`. Dùng `\nocite{*}` nếu muốn hiện tất cả mục mẫu.

## Các thay đổi để tương thích PDFLaTeX

- Bỏ fontspec, vốn yêu cầu XeLaTeX hoặc LuaLaTeX.
- Dùng VnTeX với mã hóa T5/UTF-8 để hiển thị tiếng Việt.
- Thay Times New Roman bằng bộ chữ Times tương thích TeX (mathptmx) và Consolas bằng Courier (courier). Hai font thay thế gần với bản gốc nhưng không giống tuyệt đối.
- Thêm kiểm tra engine để báo lỗi rõ nếu vô tình build bằng engine khác.

Phần bìa, bố cục, màu sắc, các chương mẫu và tệp tham khảo được giữ lại từ nguồn.
