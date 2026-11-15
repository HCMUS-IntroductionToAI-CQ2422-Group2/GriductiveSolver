# Kế hoạch nâng cấp UI/UX — Griductive Solver

> Phạm vi: chỉ `FrontEnd/`. Không đổi API, không đổi schema (`BackEnd/APIs/schemas.py`).
> Tài liệu này **thay thế hướng thiết kế "Detective Dossier"** hiện tại. Không cần giữ template, bố cục hay class CSS cũ.
> Ngày lập: 15/11/2026. Trạng thái triển khai: xem [§15](#15-trạng-thái-triển-khai).

Mục lục

1. [Mục tiêu](#1-mục-tiêu)
2. [Tham khảo: Griductive của Knotwise Games](#2-tham-khảo-griductive-của-knotwise-games)
3. [Audit UI hiện tại: vấn đề và thiếu sót](#3-audit-ui-hiện-tại-vấn-đề-và-thiếu-sót)
4. [Hướng thiết kế mới: "Spotlight Noir"](#4-hướng-thiết-kế-mới-spotlight-noir)
5. [Design tokens](#5-design-tokens)
6. [Bố cục](#6-bố-cục)
7. [Đặc tả component](#7-đặc-tả-component)
8. [Chuyển động và hiệu ứng](#8-chuyển-động-và-hiệu-ứng)
9. [Âm thanh (tuỳ chọn)](#9-âm-thanh-tuỳ-chọn)
10. [Accessibility](#10-accessibility)
11. [Nội dung chữ (microcopy)](#11-nội-dung-chữ-microcopy)
12. [Kiến trúc kỹ thuật](#12-kiến-trúc-kỹ-thuật)
13. [Lộ trình theo PR](#13-lộ-trình-theo-pr)
14. [Checklist nghiệm thu](#14-checklist-nghiệm-thu)
15. [Trạng thái triển khai](#15-trạng-thái-triển-khai)

---

## 1. Mục tiêu

| # | Mục tiêu | Đo bằng gì |
|---|---|---|
| G1 | **Mọi manh mối đã mở luôn đọc được cùng lúc**, không phải hover từng thẻ. | Người chơi giải xong 3×3 mà không cần hover lần nào. |
| G2 | **Bàn chơi là nhân vật chính**: nằm trong màn hình đầu tiên (above the fold) ở 1366×768 và 390×844. | Toàn bộ lưới 5×5 thấy được mà không cuộn ở 1366×768. |
| G3 | **Mỗi hành động có phản hồi rõ, sướng tay**: lật thẻ khi đúng, rung khi sai, ăn mừng khi thắng. | Mọi kết quả của API có hiệu ứng riêng (xem §8). |
| G4 | **Thấy được AI suy luận thế nào** mà không nói quá sự thật. | Journal chỉ hiện dữ liệu backend thực sự trả về (xem §7.9). |
| G5 | **Người mới chơi được trong 60 giây** nhờ tutorial tương tác. | Có tutorial 3 bước trên một lưới nhỏ. |
| G6 | **Có bản sắc riêng**: lấy cảm hứng chứ không sao chép bản tham khảo. | Bảng màu, logo, chữ ký thị giác ("sợi chỉ manh mối") là của riêng nhóm. |
| G7 | Đạt WCAG 2.1 AA, có dark mode, chơi được hoàn toàn bằng bàn phím. | Xem checklist §10. |

---

## 2. Tham khảo: Griductive của Knotwise Games

Nguồn: https://knotwise.games/games/griductive. Trang render bằng Next.js nên chỉ đọc được phần chữ, bảng màu và keyframes trong CSS công khai. Dưới đây là những gì **đáng học**. Ta sẽ không sao chép giao diện của họ (§4 có hướng riêng).

### 2.1 Những điều rút ra

| Quan sát | Bài học cho mình |
|---|---|
| Bảng màu "giấy và mực" ấm (paper `#f4eee3`, ink `#2b2320`) kèm 5 màu kẹo: honey, mint, coral, plum, sky. Mỗi màu có biến thể `D` đậm hơn để làm bóng. | Dùng **một nền trung tính + một bộ màu nhấn nhỏ có nghĩa rõ ràng**. Mỗi màu nhấn đi kèm một màu bóng (shadow) để làm nút và thẻ có cảm giác "bấm được". |
| Nút có `--btn-shadow` theo màu: bóng đặc lệch xuống dưới, kiểu "tactile". | Nút và thẻ có **bóng đặc lệch 3–4px**. Khi bấm thì nhấn xuống (translateY + giảm bóng). Đây là cách tạo cảm giác "game" thay vì "form web". |
| Viền dùng chính màu mực (`--line: ink`), bo góc lớn (`--radius: .875rem`). | Viền dày, đậm, bo tròn giúp thẻ đọc tốt ở cỡ nhỏ và trông thân thiện. |
| Có dark mode thật: paper `#211b18`, ink `#f0e8db`, viền mực 22% alpha. | Thiết kế token theo cặp sáng/tối ngay từ đầu. |
| Font: Newsreader (tiêu đề), **Atkinson Hyperlegible** (chữ thường), Source Code Pro (số). | Font thân chữ phải ưu tiên **dễ đọc** (clue là chữ dài). Atkinson Hyperlegible hỗ trợ tiếng Việt và miễn phí. |
| Animation `cell-flip`: lật thẻ theo trục Y 0.5s, đổi mặt ở giữa (`cell-old-face` step-end). Có `--flip-delay` để lật dây chuyền. | **Đúng phán quyết → thẻ lật** để lộ mặt sau mang màu phán quyết và lời khai mới. Đây là khoảnh khắc "thưởng" quan trọng nhất. |
| `griductive-pop` (scale 1→1.08→1), `griductive-check` (dấu tick phóng to rồi mờ dần), `griductive-shake` (rung ngang 6px). | Ba vi-hiệu ứng cho ba kết quả: đúng, gợi ý, sai. |
| `kw-firework-spark`: tia pháo hoa 8 hướng, màu honey/mint/coral, có delay so le. | Màn thắng cần một **khoảnh khắc ăn mừng** ngắn, nhẹ (dưới 1.5s), không chặn thao tác. |
| `kw-chip-lock`: chip phóng to 1.15 và toả vòng sáng khi "khoá" đúng. | Clue chip có thể "khoá" khi mọi ô nó nhắc tới đã có phán quyết (clue hết giá trị). |
| Có timer 00:00 ở header, link theme toggle. | Thêm **đồng hồ** và **nút đổi theme**. |
| Luật: "không mất mạng", hint "luôn trả về điều gì đó", solver chạy trong worker để lưới luôn mượt. | Đừng phạt người chơi bằng popup. Khi chờ API, UI vẫn phải phản hồi (trạng thái loading trên đúng thẻ được bấm). |
| Có tutorial tương tác trên lưới nhỏ. Mẹo chơi: "bắt đầu từ clue hẹp nhất", "mỗi phán quyết mở lại mọi clue". | Tutorial 3 bước + một màn "Cách chơi" ngắn gọn bằng tiếng Việt. |
| Thuật ngữ "rail" cho dải manh mối. | Clue nằm trong **một dải riêng, luôn mở** cạnh bàn chơi. |

### 2.2 Những điều KHÔNG làm theo

- Không dùng lại bảng màu, tên màu (honey/mint/coral…), logo hay bố cục cụ thể của Knotwise.
- Không làm chế độ "daily puzzle" (backend của mình là danh sách đề cố định).
- Không bỏ phần AI. Đồ án này cần **trình diễn solver**, đó là điểm khác biệt lớn nhất so với bản tham khảo.

---

## 3. Audit UI hiện tại: vấn đề và thiếu sót

Mức độ: 🔴 nghiêm trọng (cản trở việc chơi) · 🟠 quan trọng · 🟡 nên sửa.

### 3.1 Bố cục và thứ bậc thông tin

| Mức | Vấn đề | Vị trí |
|---|---|---|
| 🔴 | **Lời khai chỉ nằm trên thẻ**: 2 dòng, cỡ 9.5px, nghiêng, serif. Muốn đọc hết phải hover hoặc focus từng thẻ. Game suy luận cần nhìn nhiều clue cùng lúc, nên đây là lỗi UX lớn nhất. | `app.css` `.card-attached-clue`, `app.js` `makeCard` |
| 🔴 | **Bàn chơi bị đẩy xuống dưới màn hình đầu**. Trước bàn chơi có: brand, nhãn kết nối, tag "CONFIDENTIAL // CASE INVESTIGATION", h1 "Who's involved?", mô tả, 4 nút, khối case, thanh tiến độ, panel thắng, banner clue công khai, toolbar. Ở 1366×768 chỉ thấy khoảng 1–2 hàng thẻ. | `index.html` `.dossier-heading` |
| 🟠 | Clue công khai và clue của nhân vật hiển thị ở hai nơi, hai kiểu khác nhau. Không có một nơi duy nhất để "đọc hồ sơ vụ án". | `#public-evidence-banner` và `.card-attached-clue` |
| 🟠 | Panel AI Journal ở dưới 1400px đè lên bàn chơi (`position: fixed`). Ở ≥1400px nó chèn vào layout làm bàn chơi co lại đột ngột. | `app.css` media queries |
| 🟠 | Không có trình chọn đề. "New case" chỉ xoay vòng. Người chơi không biết có mấy đề, độ khó hay kích thước, dù ID đề đã chứa sẵn thông tin này (`medium-5x5-museum`, `expert-5x5-observatory`). | `app.js` `#load-case` |
| 🟡 | Panel thắng nằm giữa header và bàn chơi, đẩy bàn chơi xuống thêm. Thắng xong phải cuộn mới thấy kết quả trên lưới. | `#win-panel` |
| 🟡 | Legend màu ở dưới bàn chơi, xa chỗ người chơi nhìn. | `.board-caption` |

### 3.2 Màu sắc

| Mức | Vấn đề |
|---|---|
| 🟠 | Bảng màu be/nâu đơn điệu, độ tương phản giữa các trạng thái thẻ thấp: unrevealed `#f4efe4` so với card `#fcfbf8` gần như không phân biệt được. |
| 🟠 | Trạng thái "đã chứng minh" chỉ thể hiện bằng **một nhãn 8px** ở góc thẻ. Nhìn tổng thể bàn chơi không biết ngay ô nào xanh, ô nào đỏ. |
| 🟠 | 77 mã hex viết cứng dù đã có token. Màu teal `#087f72` ở logo và focus ring header không thuộc bảng màu nào. Focus ring header màu teal, focus ring thẻ màu brass. |
| 🟠 | `.card-flag` 8px, màu `#8c8577` trên `#ede7da`: contrast khoảng **2.9:1**, trượt WCAG AA. |
| 🟡 | Không có dark mode. |
| 🟡 | Các trạng thái highlight (`is-highlighted`, `is-hinted`, `is-playback`) đều dùng cùng màu brass, chỉ khác độ đậm viền, nên khó phân biệt "được clue nhắc tới", "được gợi ý" và "AI đang xét". |

### 3.3 Typography

| Mức | Vấn đề |
|---|---|
| 🔴 | Có 11 cỡ chữ khác nhau (8 / 8.5 / 9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 13 / 14px). Nhiều chữ quan trọng nhỏ hơn 10px. |
| 🟠 | Lời khai, thứ người chơi đọc nhiều nhất, lại dùng **serif nghiêng 9.5px**, kiểu khó đọc nhất. |
| 🟠 | Tải 3 họ font từ Google Fonts với nhiều weight. Không có mạng thì rơi về font hệ thống, và `static/fonts/` không có file font nào. |
| 🟡 | Lạm dụng chữ HOA + letter-spacing (CONFIDENTIAL, PUBLIC STARTING CLUES, UNREVEALED, FORMAL PROOF…) gây cảm giác "ồn". |

### 3.4 Tương tác và phản hồi

| Mức | Vấn đề | Vị trí |
|---|---|---|
| 🔴 | **Phán quyết đúng không có khoảnh khắc thưởng**: chỉ đổi nhãn và hiện toast. Không lật thẻ, không có hiệu ứng, lời khai mới xuất hiện lặng lẽ trên thẻ. | `render()` |
| 🟠 | Thắng không có ăn mừng, chỉ hiện một panel tĩnh. | `renderWin` |
| 🟠 | Mọi thông báo đều đi qua một toast duy nhất ở góc, 3.6s, ghi đè lẫn nhau. Thông báo quan trọng ("Không chứng minh được, +1 lỗi") cũng chung chỗ với thông tin vặt. | `showToast` |
| 🟠 | Nút Innocent/Criminal chỉ hiện khi đã chọn thẻ, nằm ở đáy thẻ, rất nhỏ ở 5×5. Trên điện thoại khó bấm. | `.card-actions` |
| 🟠 | Khi chờ API, chỉ có `aria-busy` trên lưới. Thẻ vừa bấm không có trạng thái loading. | `run()` |
| 🟠 | Không có liên kết trực quan giữa clue và các ô nó nhắc tới, ngoài việc tô viền khi hover. | `renderHighlights` |
| 🟡 | Phím mũi tên và Esc vẫn đổi selection khi đang phát lại Auto solve. Ở chế độ offline, bấm I/C không có phản hồi. | `moveSelection`, `submitVerdict` |
| 🟡 | Không có đồng hồ, không có thống kê sau ván (thời gian, số gợi ý, số lỗi, sao). | — |

### 3.5 Phần AI (Journal, Hint, Auto solve)

| Mức | Vấn đề |
|---|---|
| 🔴 | "Basis: Clue #…" liệt kê **mọi clue đang mở**, không phải clue thực sự dùng để suy ra. Bước sinh từ Hint thì hiện "Prior deduction" vì `active_clue_ids: []`. Cả hai đều sai sự thật. |
| 🟠 | Mỗi bước liệt kê **tất cả** query SAT, kể cả query của những ô khác bị bỏ qua (có thể tới 1 + 2n dòng). Query không có giả định hiện "Assume All possibilities", khó hiểu. |
| 🟠 | Copy nói quá: "formally verified", "in real time". |
| 🟠 | Auto solve xoá lịch sử Hint. Trong lúc phát lại, journal bị dựng lại `innerHTML` mỗi frame. |
| 🟡 | Journal ẩn mặc định sau một nút. Phần "AI" là điểm nhấn của đồ án nhưng lại bị giấu đi. |

### 3.6 Onboarding, trạng thái hệ thống

| Mức | Vấn đề |
|---|---|
| 🟠 | Không có tutorial hay màn "Cách chơi". Chỉ có một câu "Every clue is always true…" và modal phím tắt dạng văn bản thuần. |
| 🟡 | Không có màn loading. Lúc khởi động chỉ có chữ "CONNECTING…" và lưới trống. |
| 🟡 | Banner offline dạng dải vàng đè lên mọi thứ. Chế độ mock vẫn hiện đầy đủ nút nhưng nút không làm gì. |

### 3.7 Accessibility

| Mức | Vấn đề |
|---|---|
| 🟠 | Thẻ `role="button"` chứa `<button>` và `role="note"` focus được bên trong (phần tử tương tác lồng nhau). |
| 🟠 | Clue box `tabIndex = 0` cố định, phá roving tabindex của lưới. |
| 🟠 | Modal tự làm bằng `div`: không trap focus, không focus vào nút, không trả focus khi đóng. |
| 🟡 | Panel overlay không chuyển focus vào panel, không đóng khi bấm ra ngoài. |

### 3.8 Mobile

| Mức | Vấn đề |
|---|---|
| 🟠 | 5×5 với `minmax(95px)` thì cuộn ngang mà không có gợi ý là cuộn được. Hover để đọc clue không tồn tại trên cảm ứng. |
| 🟡 | Header chiếm gần hết màn hình đầu trên điện thoại. |

### 3.9 Code frontend

- `app.js` dài khoảng 1000 dòng, khoảng 15 biến global, render thủ công rải rác. Khó thêm hiệu ứng mà không vỡ.
- `app.css` dài khoảng 1900 dòng, có nhiều `!important` và z-index chồng chéo (1, 5, 60, 70, 80, 90, 100).
- Danh sách avatar có 3 nguồn: `DEFAULT_AVATARS`, `FrontEnd/avatars.json`, và route `/app/avatars.json`.
- Chữ tĩnh trong `index.html` không nằm trong object `TEXT`.

---

## 4. Hướng thiết kế mới: "Spotlight Noir"

### 4.1 Ý tưởng

> **Bàn làm việc của thám tử lúc nửa đêm.** Lưới nghi phạm như những tấm thẻ dày, bóng đặc, ghim trên một bảng điều tra. Ngọn đèn bàn (spotlight) chiếu vào nghi phạm đang chọn. Khi một manh mối được rê chuột, **những sợi chỉ đỏ** căng từ người khai tới những người bị nhắc tên, như bảng điều tra trong phim trinh thám.

- **Tactile:** thẻ và nút có viền đậm, bo tròn, bóng đặc lệch. Bấm vào có cảm giác ấn xuống.
- **Tương phản cao:** dark mode là mặc định ("nửa đêm"), light mode là "giấy hồ sơ ban ngày". Cả hai đều được thiết kế đầy đủ.
- **Màu có nghĩa:** chỉ 3 màu ngữ nghĩa là Innocent (xanh ngọc), Criminal (đỏ son), Spotlight (vàng hổ phách) và một màu phụ là AI (tím điện). Không màu nào chỉ để trang trí.
- **Chữ ký thị giác:** *Clue Threads*, các sợi chỉ SVG nối clue với ô. Đây là thứ giúp nhóm khác biệt, vừa đẹp vừa có ích thật.

### 4.2 Moodboard bằng lời

- Bảng ghim điều tra, ghim đồng, sợi chỉ đỏ.
- Thẻ hồ sơ bìa cứng, góc bo, tem đóng dấu INNOCENT/GUILTY nghiêng.
- Ánh đèn bàn vàng ấm trên nền xanh than.
- Giao diện "trò chơi cờ bàn hiện đại" chứ không phải "trang quản trị".

---

## 5. Design tokens

Mọi màu, cỡ chữ, khoảng cách, bóng đều là biến CSS trong `tokens.css`. **Không viết mã hex ở bất kỳ file nào khác.**

### 5.1 Màu

| Token | Dark (mặc định) | Light | Dùng cho |
|---|---|---|---|
| `--bg` | `#12141c` | `#f3efe6` | Nền trang |
| `--bg-board` | `#1a1d29` | `#e8e1d3` | Mặt bảng điều tra |
| `--surface` | `#232736` | `#fffdf8` | Thẻ, panel |
| `--surface-raised` | `#2c3144` | `#ffffff` | Thẻ đang hover hoặc chọn |
| `--ink` | `#f2ede4` | `#1d1b22` | Chữ chính, viền đậm |
| `--ink-2` | `#b9b4c4` | `#4d4857` | Chữ phụ |
| `--ink-3` | `#8a8699` | `#6f6a78` | Chú thích (vẫn ≥ 4.5:1 trên `--surface`) |
| `--line` | `#3a3f55` | `#1d1b22` | Viền thẻ |
| `--innocent` | `#3fd0a4` | `#14876a` | Phán quyết vô tội |
| `--innocent-shadow` | `#1e7a60` | `#0b5643` | Bóng đặc |
| `--innocent-tint` | `#3fd0a41f` | `#14876a1a` | Nền thẻ vô tội |
| `--criminal` | `#ff5a5f` | `#c8323a` | Phán quyết tội phạm |
| `--criminal-shadow` | `#a8262c` | `#7e1a20` | Bóng đặc |
| `--criminal-tint` | `#ff5a5f1f` | `#c8323a14` | Nền thẻ tội phạm |
| `--spotlight` | `#ffc145` | `#d68a00` | Ô đang chọn, gợi ý, clue mới |
| `--spotlight-shadow` | `#a8740f` | `#8a5800` | Bóng đặc |
| `--thread` | `#ff4d6d` | `#d6304f` | Sợi chỉ manh mối |
| `--ai` | `#9b8cff` | `#5b48e0` | Mọi thứ thuộc solver: journal, playback, nút Auto solve |
| `--ai-shadow` | `#5243b8` | `#3a2aa6` | Bóng đặc |
| `--focus` | `#7cc4ff` | `#0b63c9` | Focus ring, thống nhất toàn trang |

Kiểm tra bắt buộc: `--ink`, `--ink-2`, `--ink-3` trên `--surface` ≥ 4.5:1. Chữ trên nền `--innocent`/`--criminal` (nhãn tem) ≥ 4.5:1. Các màu trạng thái trên `--bg-board` ≥ 3:1.

**Không bao giờ chỉ dùng màu để truyền tải trạng thái.** Mỗi phán quyết luôn có icon (✓ vô tội, ✕ hoặc còng tay cho tội phạm) và chữ.

### 5.2 Typography

| Vai trò | Font | Ghi chú |
|---|---|---|
| Tiêu đề, tên vụ án, tem | **Fraunces** (variable, có trục `SOFT` và `WONK`) | Hiển thị cá tính, hỗ trợ tiếng Việt. |
| Thân chữ, clue, nút | **Be Vietnam Pro** | Thiết kế cho tiếng Việt, rất dễ đọc ở cỡ nhỏ. |
| Toạ độ, số liệu, đồng hồ | **JetBrains Mono** | Giữ từ bản cũ. |

Self-host file `woff2` (chỉ các weight dùng tới, subset `latin` + `vietnamese`) trong `static/fonts/`. Google Fonts chỉ là phương án dự phòng.

Thang cỡ chữ (5 bậc + 1 hiển thị), **không chữ nào nhỏ hơn 12px**:

| Token | Cỡ | Dùng cho |
|---|---|---|
| `--fs-xs` | 12px | Toạ độ, nhãn phụ |
| `--fs-sm` | 13px | Nghề nghiệp, meta |
| `--fs-md` | 15px | Clue, nút, thân chữ |
| `--fs-lg` | 18px | Tên nhân vật (3×3, 4×4), tiêu đề panel |
| `--fs-xl` | 24px | Tên vụ án |
| `--fs-display` | clamp(32px, 5vw, 56px) | Màn thắng, tutorial |

Ở 5×5, tên nhân vật dùng `--fs-md`. Dùng `container queries` trên thẻ để tự co cỡ chữ theo kích thước thẻ, không viết riêng từng `data-size`.

### 5.3 Khoảng cách, bo góc, bóng, lớp

- Spacing theo bậc 4px: `--sp-1: 4px` … `--sp-8: 48px`.
- Bo góc: `--r-sm: 8px` (chip), `--r-md: 14px` (thẻ, nút), `--r-lg: 20px` (panel, modal).
- Bóng đặc (chữ ký tactile): `--press: 0 4px 0 var(--x-shadow)`. Hover: `0 6px 0`. Active: `0 1px 0` kèm `translateY(3px)`.
- Bóng mềm cho lớp nổi (modal, popover): `--elev: 0 20px 50px #0008`.
- Thang z-index cố định: `--z-board: 1`, `--z-threads: 5`, `--z-card-active: 10`, `--z-rail: 20`, `--z-sheet: 40`, `--z-toast: 60`, `--z-modal: 80`. Cấm dùng `!important` cho z-index.

---

## 6. Bố cục

### 6.1 Desktop (≥ 1100px)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ◆ Griductive   │ Vụ án: Bảo tàng · 5×5 · Medium ▾ │ ⏱ 03:12  ✕2  💡1  ☀/☾ ⚙ │  ← Top bar 56px
├──────────────────────────────────────────────────┬────────────────────────┤
│                                                  │ [ Hồ sơ ] [ AI ]       │  ← Tabs của rail
│   ████ 12/25 đã xác định ░░░░░░░░                │ ─────────────────────  │
│                                                  │ ◈ Công khai            │
│      A        B        C        D        E       │  "Có đúng 2 tội phạm   │
│  1 ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   ở hàng 1"   →A1 B1…  │
│    │ 🧑 An│ │ 🧑 Bì│ │ ...  │ │      │ │      │  │                        │
│    └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │ ● NEW  Bình (B1)       │
│  2   ...  ╲ sợi chỉ manh mối ╱                   │  "Lan và Minh cùng     │
│  3                                               │   trạng thái"          │
│  4                                               │                        │
│  5                                               │ ○ An (A1)   ✓ đã khoá  │
│                                                  │                        │
│        [ 💡 Gợi ý  H ]   [ ▶ AI tự giải ]   [↺]   │                        │
└──────────────────────────────────────────────────┴────────────────────────┘
          Bàn chơi ~68%                                   Rail ~32% (min 320px)
```

- **Top bar** cao 56px, một hàng duy nhất: logo, trình chọn vụ án (dropdown), đồng hồ, số lỗi, số gợi ý, theme, cài đặt. Bỏ hẳn h1, tag "CONFIDENTIAL", mô tả dài và nhãn kết nối to. Trạng thái kết nối thu gọn thành một chấm nhỏ cạnh logo (tooltip "Đã kết nối backend"), chỉ nổi bật khi offline.
- **Bàn chơi** ở giữa, căn giữa theo cả hai chiều trong vùng còn lại. Kích thước thẻ tính theo `min(chiều rộng khả dụng / cột, chiều cao khả dụng / hàng)` để **cả lưới luôn vừa màn hình**.
- **Thanh hành động** nổi ở đáy bàn chơi: Gợi ý, AI tự giải, Chơi lại.
- **Rail bên phải luôn mở**, có 2 tab:
  - **Hồ sơ**: mọi clue đã mở (công khai ở trên cùng, sau đó clue mới nhất lên đầu).
  - **AI**: journal suy luận. Tab này tự chuyển sang khi bấm "AI tự giải" và có badge số bước.

### 6.2 Tablet (700–1099px)

Rail chuyển xuống dưới bàn chơi thành khối có chiều cao cố định khoảng 40vh, cuộn được. Top bar giữ nguyên, ẩn bớt nhãn chữ (chỉ còn icon).

### 6.3 Mobile (< 700px)

```
┌─────────────────────────┐
│ ◆  Bảo tàng 5×5 ▾  ⏱ ⚙ │  ← 48px
│ ████████░░░ 12/25 ✕2 💡1│
├─────────────────────────┤
│   A   B   C   D   E     │
│ 1 ▢   ▢   ▢   ▢   ▢     │  ← Lưới vừa khít chiều ngang,
│ 2 ▢   ▢   ▢   ▢   ▢     │    thẻ thu gọn: avatar + tên
│ 3 ▢   ▢   ▣   ▢   ▢     │
│ 4 ▢   ▢   ▢   ▢   ▢     │
│ 5 ▢   ▢   ▢   ▢   ▢     │
├─────────────────────────┤
│ ═══  Hồ sơ (7)  AI (3)  │  ← Bottom sheet kéo lên được
│ ● NEW Bình: "Lan và…"   │    (3 nấc: thu gọn / nửa / đầy)
├─────────────────────────┤
│ [ Vô tội ]  [ Tội phạm ]│  ← Action bar cố định khi đã chọn ô
│ 💡 Gợi ý    ▶ AI    ↺   │    (nút ≥ 48px)
└─────────────────────────┘
```

- **Không cuộn ngang.** Ở 5×5 trên màn 360px, thẻ còn khoảng 62px: chỉ hiện avatar, tên rút gọn và màu phán quyết. Chạm vào thẻ thì bottom sheet hiện chi tiết người đó (nghề, lời khai).
- Nút phán quyết chuyển từ trong thẻ xuống **action bar cố định ở đáy**, dễ bấm bằng ngón cái.

---

## 7. Đặc tả component

### 7.1 Top bar

- Logo: biểu tượng lưới 3×3 với một ô màu spotlight, kèm chữ "Griductive" (Fraunces).
- **Case picker** (dropdown hoặc popover): mỗi dòng gồm tên đề, kích thước và nhãn độ khó, phân tích từ ID (`medium-5x5-museum` → "Museum · 5×5 · Medium"). Có dấu ✓ cho đề đã giải trong phiên này (lưu bằng `localStorage`, bọc trong try/catch). Phím tắt `N` để sang đề tiếp.
- **Đồng hồ** `mm:ss` font mono. Bắt đầu chạy khi có thao tác đầu tiên, dừng khi thắng hoặc khi tab bị ẩn (`visibilitychange`).
- Bộ đếm: `✕ lỗi`, `💡 gợi ý`. Mỗi khi tăng thì số "pop" lên (§8).
- Nút theme (☀/☾), lưu lựa chọn. Mặc định theo `prefers-color-scheme`.
- Nút cài đặt mở panel: tốc độ phát lại AI, bật/tắt âm thanh, giảm chuyển động, xem lại tutorial, phím tắt.

### 7.2 Thanh tiến độ

- Dải mảnh, chia thành **n đoạn** (mỗi ô một đoạn). Đoạn được tô màu đúng với phán quyết (xanh/đỏ) theo thứ tự đã giải. Nhìn vào là biết cả số lượng lẫn tỉ lệ tội phạm đã tìm được.
- Đi kèm chữ "12/25 đã xác định".

### 7.3 Thẻ nghi phạm (component quan trọng nhất)

Cấu trúc: thẻ có hai mặt (front/back) trong một wrapper 3D.

```
 Mặt trước (chưa xác định)        Mặt sau (đã xác định)
┌────────────────────┐          ┌────────────────────┐
│ B2            ?    │          │ B2   ✓ VÔ TỘI      │  ← Tem nghiêng -6°
│      ╭────╮        │          │      ╭────╮        │
│      │ 🧑 │        │   lật →  │      │ 🧑 │        │
│      ╰────╯        │          │      ╰────╯        │
│     Bình           │          │     Bình           │
│     Bác sĩ         │          │  💬 có lời khai     │  ← Bấm để nhảy tới clue
└────────────────────┘          └────────────────────┘
```

- **Lời khai không hiện đầy đủ trên thẻ nữa.** Thẻ chỉ có biểu tượng 💬 và số clue. Bấm vào hoặc hover thì clue tương ứng trong rail được cuộn tới và sáng lên, kèm sợi chỉ.
- Avatar: hình tròn 56px (3×3) đến 36px (5×5), viền `--line`. Nếu không có ảnh thì dùng chữ cái đầu trên nền màu sinh từ hash của tên (8 màu dịu, đủ contrast).

Bảng trạng thái:

| Trạng thái | Dấu hiệu thị giác | Ngoài màu sắc còn có |
|---|---|---|
| Chưa xác định | Nền `--surface`, viền `--line`, bóng đặc trung tính | Dấu `?` ở góc |
| Hover | Nhấc lên 2px, bóng 6px | — |
| Đang chọn | Viền 3px `--spotlight`, quầng sáng spotlight, nền `--surface-raised` | Hai nút phán quyết hiện ra |
| Được clue nhắc tới | Viền nét đứt `--thread`, có đầu sợi chỉ cắm vào | Ghim tròn ở mép thẻ |
| Là người khai của clue đang xem | Ghim `--thread` đặc ở góc trên | — |
| Được gợi ý (nấc 1) | Viền `--spotlight` nhấp nháy chậm (2s), icon 💡 | Chữ "Có thể chứng minh" |
| Đang chờ API | Thẻ hơi mờ, spinner nhỏ ở góc | `aria-busy` |
| Vô tội | Lật sang mặt sau, nền `--innocent-tint`, viền `--innocent`, tem "✓ VÔ TỘI" | Icon ✓ |
| Tội phạm | Lật sang mặt sau, nền `--criminal-tint`, viền `--criminal`, tem "✕ TỘI PHẠM" | Icon ✕ |
| Sai | Rung ngang, viền `--criminal` chớp 1 lần | Thông báo tại chỗ (§7.8) |
| AI đang xét (playback) | Viền `--ai`, quầng tím | Nhãn "AI" |

**Nút phán quyết:** hai nút to, chiếm toàn bộ đáy thẻ khi thẻ đang chọn (desktop), có bóng đặc màu `--innocent`/`--criminal`, kèm phím `I`/`C`. Ở 5×5 thì nút hiện thành popover ngay dưới thẻ, không nằm trong thẻ. Trên mobile thì dùng action bar ở đáy.

**Sửa lỗi a11y cấu trúc:** thẻ là `<div role="gridcell">` bên trong `role="grid"`, phần tử tương tác chính là một `<button>` duy nhất phủ thẻ. Nút phán quyết nằm *ngoài* nút đó (anh em, không lồng nhau).

### 7.4 Rail "Hồ sơ" (danh sách manh mối)

- Nhóm **Công khai** ghim ở đầu, nền hơi khác.
- Sau đó là **clue của nhân vật**, mới nhất lên đầu. Clue mới có nhãn **NEW** màu spotlight cho tới khi được hover hoặc focus lần đầu.
- Mỗi clue là một thẻ gồm:
  - Avatar nhỏ + tên người khai + toạ độ (clue công khai thì có icon ◈).
  - Nội dung clue ở cỡ `--fs-md`, **không cắt chữ**.
  - Hàng chip các ô được nhắc tới (`A1 An`, `B1 Bình`…). Mỗi chip mang màu phán quyết nếu ô đó đã xác định.
- **Clue "đã khoá":** khi *mọi* ô mà clue nhắc tới đều đã có phán quyết, clue mờ đi 50%, có dấu ✓ và tụt xuống cuối danh sách (hiệu ứng `chip-lock`, §8). Người chơi tập trung được vào những clue còn giá trị. Toàn bộ thông tin cần thiết đã có sẵn trong `referenced_cell_ids` + `is_criminal`.
- Hover hoặc focus clue → bật Clue Threads và tô sáng các ô. Bấm → **ghim** clue (giữ threads). Bấm lại thì bỏ ghim.
- Ô tìm kiếm hoặc lọc nhỏ ở đầu rail: "Chỉ hiện clue còn hiệu lực" (mặc định bật khi có hơn 6 clue).

### 7.5 Clue Threads (chữ ký thị giác)

- Một lớp `<svg>` phủ lên bàn chơi (`pointer-events: none`, `z: --z-threads`).
- Khi một clue active (hover, focus hoặc ghim), vẽ **đường cong Bezier** từ tâm thẻ người khai tới tâm từng thẻ được nhắc tới. Clue công khai thì vẽ từ cạnh trên bàn chơi xuống.
- Nét vẽ: `--thread`, dày 2px, đầu có ghim tròn 6px. Hiệu ứng "kéo chỉ": `stroke-dasharray` + `stroke-dashoffset` chạy từ 100% về 0 trong 350ms.
- Ở clue đã khoá, nét chuyển sang `--ink-3` nét đứt.
- Tính lại toạ độ bằng `ResizeObserver` trên bàn chơi. Tắt hoàn toàn khi `prefers-reduced-motion` (vẫn vẽ, nhưng không có hiệu ứng kéo).

### 7.6 Gợi ý (Hint)

Giữ cơ chế 2 nấc, nâng cấp phần trình bày:

1. **Nấc 1:** spotlight quét qua bàn rồi dừng ở ô được gợi ý (ô nhấp nháy viền vàng). Popover nhỏ: "Bình (B2) đã có thể chứng minh. Bấm Gợi ý lần nữa để xem phán quyết."
2. **Nấc 2:** popover hiện phán quyết kèm **lý do dạng người đọc được** từ 2 query của ô đó: "Nếu Bình là Tội phạm → mâu thuẫn. Vậy Bình Vô tội." Người chơi vẫn phải tự bấm phán quyết.

Trạng thái `UNKNOWN`/`SOLVED`/`INCONSISTENT` hiển thị trong cùng popover đó, không dùng modal.

### 7.7 AI tự giải (Auto solve) và phát lại

- Nút "▶ AI tự giải" màu `--ai`. Khi chạy, toàn bộ giao diện chuyển sang **"chế độ AI"**: viền bàn chơi phát sáng tím, rail tự chuyển sang tab AI.
- Thanh điều khiển phát lại thay chỗ thanh hành động: `⏮ ⏯ ⏭ ⏩ | Bước 4/25 | Tốc độ 0.5× 1× 2×`.
  - ⏭ = sang bước tiếp, ⏩ = bỏ qua đến cuối, ⏮ = quay về đầu (phát lại từ `before state` + `trace`, hoàn toàn phía client).
- Mỗi bước: (1) spotlight tím trượt tới ô đang xét, (2) clue liên quan sáng trong rail kèm threads, (3) thẻ lật, (4) bước tương ứng trong journal được tô sáng và cuộn tới.
- Khoá mọi input lên bàn chơi trong lúc phát lại (kể cả phím mũi tên, I, C, H).

### 7.8 Phản hồi và thông báo

Bỏ mô hình "một toast cho mọi thứ". Thông báo được chia thành 3 tầng:

| Tầng | Khi nào | Hình thức |
|---|---|---|
| **Tại chỗ** | Kết quả của phán quyết (ACCEPTED / NOT_PROVABLE / CONTRADICTED) | Bong bóng nhỏ bật lên ngay trên thẻ trong 2s: "✓ Chính xác!", "Chưa đủ căn cứ (+1 lỗi)", "Mâu thuẫn với manh mối (+1 lỗi)". |
| **Toast** | Thông tin hệ thống: đã tải vụ án, đã kết nối lại, đã chơi lại | Góc dưới, xếp chồng tối đa 3, tự ẩn 3s, có nút đóng. |
| **Dialog** | Chỉ những việc cần quyết định: lỗi backend, xác nhận chơi lại khi đang giữa ván | `<dialog>` gốc với `showModal()`. |

Với NOT_PROVABLE, bong bóng có thêm liên kết "Tại sao?" giải thích: "Cả hai khả năng vẫn còn hợp lệ với các manh mối hiện tại."

### 7.9 Tab AI (Journal suy luận)

Viết lại hoàn toàn để **chỉ nói điều backend thực sự trả về**:

```
┌ Bước 04 ─────────────────────── ✓ Vô tội ┐
│ 🧑 Bình (B2)                              │
│                                          │
│ Giả sử Bình là Tội phạm  →  ✕ Mâu thuẫn  │
│ Giả sử Bình là Vô tội    →  ✓ Hợp lệ     │
│ ⇒ Chỉ còn một khả năng: Vô tội            │
│                                          │
│ Mở thêm lời khai: #07 (Bình)             │
│ ▸ Chi tiết: 9 lần kiểm tra SAT            │  ← Mở rộng mới thấy toàn bộ query
└──────────────────────────────────────────┘
```

- Chỉ hiện **2 query của ô được kết luận** (lọc `sat_queries` theo `assumption.cell_id === verdict.cell_id`). Các query còn lại nằm trong phần "Chi tiết" đóng sẵn.
- Query baseline (không có giả định) hiện ở đầu journal một lần: "Các manh mối hiện tại nhất quán ✓".
- **Bỏ dòng "Basis: Clue #…"** cho tới khi backend trả về tập clue tối thiểu thật. Thay bằng "Manh mối đang mở: 6" (đúng sự thật).
- Giữ lịch sử Hint và Auto solve trong cùng journal, mỗi mục có nhãn nguồn (💡 Gợi ý / ▶ AI).
- Hover một bước → tô sáng ô và thread tương ứng trên bàn chơi.
- Render tăng dần (chỉ append bước mới), không dựng lại `innerHTML` mỗi frame.

> Đề xuất cho backend (ngoài phạm vi UI): trả thêm `explanation_clue_ids` là tập clue tối thiểu, tính bằng cách bỏ lần lượt từng clue và kiểm tra giả định ngược còn UNSAT hay không. Khi có trường này, UI bật lại dòng "Dựa trên: #02, #05" kèm threads cho đúng những clue đó.

### 7.10 Màn thắng

- Không đẩy layout. Một **overlay bán trong suốt** phủ lên bàn chơi, các thẻ vẫn nhìn thấy phía dưới.
- Trình tự: các thẻ "sóng" pop lần lượt theo đường chéo (delay 30ms mỗi ô) → tem lớn **"VỤ ÁN KHÉP LẠI"** đập xuống với scale 1.4→1 và xoay -8° → pháo giấy hoặc tia lửa bằng màu innocent/criminal/spotlight.
- Thẻ kết quả: thời gian, số lỗi, số gợi ý, **xếp hạng 1–3 sao** (3 sao: 0 lỗi, 0 gợi ý; 2 sao: tổng ≤ 2; 1 sao: còn lại). Nếu giải bằng AI thì ghi "Giải bởi AI" và không tính sao.
- Hai nút: "Chơi lại" và "Vụ án tiếp theo →" (focus mặc định vào nút sau).
- Có thể đóng overlay để ngắm lại bàn chơi đã giải.

### 7.11 Tutorial và "Cách chơi"

- Lần đầu vào (kiểm tra `localStorage`): hiện tutorial 3 bước trên lưới 2×2 **dựng sẵn phía client** (dữ liệu tĩnh, có đáp án vì chỉ là đề minh hoạ, không phải đề thật):
  1. "Mỗi người hoặc Vô tội hoặc Tội phạm. Mọi manh mối đều đúng." Bàn tay chỉ vào clue công khai.
  2. "Chỉ được kết luận khi manh mối **buộc** điều đó." Bàn tay chỉ vào ô, người chơi bấm Vô tội, thẻ lật.
  3. "Đúng thì thẻ lật và mở lời khai mới. Sai không mất mạng nhưng bị tính lỗi." Người chơi tự làm ô cuối.
- Mục "Cách chơi" trong cài đặt gồm luật + 4 mẹo (bắt đầu từ clue nhắc ít người nhất; sau mỗi phán quyết đọc lại toàn bộ clue; "đúng một" khác "ít nhất một"; nghề nghiệp và tên không phải là manh mối trừ khi clue nhắc tới).
- Modal phím tắt hiển thị dạng bảng với `<kbd>` thay vì văn bản thuần.

### 7.12 Trạng thái hệ thống

- **Loading:** skeleton của lưới (các thẻ xám nhấp nháy shimmer) cùng logo.
- **Offline:** một chip "Ngoại tuyến · chỉ xem" ở top bar thay cho dải vàng. Các nút cần API bị **disable kèm tooltip giải thích**, không ẩn đi. Bấm vào chip để thử kết nối lại.
- **Lỗi API:** dialog có mã lỗi + nút "Thử lại". Chỉ fallback sang mock khi `ApiError.status === 0`.

---

## 8. Chuyển động và hiệu ứng

Nguyên tắc: **nhanh, có nghĩa, không chặn thao tác.** Mọi hiệu ứng dùng `transform`/`opacity` (GPU), không animate `width`/`top`.

| Tên | Kích hoạt | Mô tả | Thời lượng / easing | Reduced motion |
|---|---|---|---|---|
| `card-flip` | ACCEPTED | `rotateY` 0→180° với `backface-visibility`, mặt sau màu phán quyết. Kèm `pop` khi kết thúc. | 520ms `cubic-bezier(.4,0,.2,1)` | Chuyển màu tức thì (crossfade 120ms) |
| `stamp-in` | Tem phán quyết xuất hiện sau khi lật | scale 1.6→1, xoay -12°→-6°, opacity 0→1 | 280ms `cubic-bezier(.34,1.56,.64,1)` (overshoot) | Hiện ngay |
| `shake` | NOT_PROVABLE / CONTRADICTED | `translateX` -6, 5, -3, 2, 0 | 320ms | Viền chớp đỏ 1 lần, không rung |
| `pop` | Bộ đếm tăng, chip được tạo | scale 1→1.12→1 | 220ms | Không |
| `spotlight-move` | Đổi ô đang chọn | Quầng sáng (một phần tử riêng) trượt tới ô mới bằng `transform` | 180ms `ease-out` | Nhảy tức thì |
| `thread-draw` | Clue active | `stroke-dashoffset` 100%→0 | 350ms `ease-out` | Vẽ ngay |
| `clue-enter` | Clue mới vào rail | Trượt từ phải vào + nền spotlight nhạt dần trong 1.2s | 300ms + 1.2s | Chỉ hiện nhãn NEW |
| `chip-lock` | Clue hết hiệu lực | scale 1.15 + vòng sáng toả ra, rồi mờ dần và tụt xuống cuối danh sách (FLIP animation) | 460ms | Mờ ngay |
| `hint-pulse` | Hint nấc 1 | Viền spotlight nhấp nháy opacity | 2s lặp | Viền tĩnh |
| `ai-scan` | Mỗi bước playback | Quầng tím trượt tới ô, rồi `card-flip` | 50% thời lượng bước | Nhảy tức thì |
| `win-wave` | Thắng | Các thẻ `pop` lần lượt theo đường chéo | 30ms/ô | Không |
| `win-stamp` | Thắng | Tem lớn đập xuống | 420ms overshoot | Hiện ngay |
| `confetti` | Thắng | 60 mảnh giấy (canvas hoặc CSS), 3 màu ngữ nghĩa | ≤ 1.5s | Không |
| `skeleton` | Loading | Shimmer gradient | 1.2s lặp | Nền tĩnh |

- Tôn trọng `prefers-reduced-motion` **và** cho phép tự bật hoặc tắt trong cài đặt (thêm class `.reduce-motion` trên `<html>`).
- Chuyển theme mượt bằng View Transitions API nếu trình duyệt hỗ trợ, nếu không thì đổi tức thì.

---

## 9. Âm thanh (tuỳ chọn)

Tắt mặc định, bật trong cài đặt. Dùng WebAudio tổng hợp (không cần file):

- Lật thẻ đúng: tiếng "tách" giấy ngắn + nốt cao (innocent) hoặc nốt trầm (criminal).
- Sai: tiếng "bụp" trầm ngắn.
- Clue mới: tiếng chuông nhỏ.
- Thắng: hợp âm 3 nốt đi lên.

---

## 10. Accessibility

- [ ] Lưới dùng `role="grid"` → `role="row"` → `role="gridcell"`, roving tabindex, điều hướng bằng mũi tên. `Home`/`End` về đầu hoặc cuối hàng.
- [ ] Không lồng phần tử tương tác. Mỗi thẻ có đúng một điểm focus.
- [ ] `aria-label` của thẻ: "B2, Bình, Bác sĩ, Vô tội, có 1 lời khai".
- [ ] Kết quả phán quyết được đọc qua một vùng `aria-live="polite"` riêng (tách khỏi toast).
- [ ] `<dialog>` gốc cho mọi modal (tự trap focus, đóng bằng Esc, trả focus về chỗ cũ).
- [ ] Focus ring thống nhất `--focus`, 3px, offset 2px, luôn thấy được trên cả hai theme.
- [ ] Mọi cặp màu chữ/nền ≥ 4.5:1, thành phần UI ≥ 3:1. Kiểm tra bằng axe hoặc Lighthouse.
- [ ] Trạng thái không bao giờ chỉ truyền bằng màu (luôn có icon + chữ).
- [ ] Vùng chạm ≥ 44×44px trên mobile.
- [ ] Chữ không nhỏ hơn 12px. Zoom 200% không vỡ layout.
- [ ] Threads có `aria-hidden="true"`. Thông tin tương đương (danh sách ô được nhắc tới) nằm trong chip của clue.

---

## 11. Nội dung chữ (microcopy)

- **Chọn một ngôn ngữ cho toàn bộ UI.** Đề xuất **tiếng Việt**, vì tên, nghề và clue từ backend đều là tiếng Việt. Toàn bộ chữ (kể cả chữ tĩnh trong HTML) đưa vào `i18n/vi.js`. Có thể thêm `en.js` sau.
- Giọng văn: ngắn, thân thiện, như một trợ lý điều tra. Tránh chữ HOA cả câu, tránh thuật ngữ khó ("UNSAT" chỉ xuất hiện trong phần Chi tiết của journal).
- Không nói quá về AI: dùng "AI kiểm tra bằng bộ giải SAT (DPLL)", không dùng "formally verified", "real time".

| Hiện tại | Đề xuất |
|---|---|
| Who's involved? | (bỏ, tên vụ án là tiêu đề) |
| Verdict accepted: Bình (B2) is innocent. | ✓ Chính xác! Bình vô tội. |
| Not provable yet: the clues don't force a verdict for Bình. +1 mistake. | Chưa đủ căn cứ để kết luận về Bình. (+1 lỗi) |
| Contradicted: the clues force the opposite status… | Mâu thuẫn: manh mối cho thấy điều ngược lại. (+1 lỗi) |
| Auto solve | AI tự giải |
| AI Reasoning Journal | Nhật ký suy luận |
| JUSTICE SERVED / Case closed | Vụ án khép lại! |
| Backend unreachable… | Ngoại tuyến · chỉ xem |

---

## 12. Kiến trúc kỹ thuật

Vẫn **HTML/CSS/JS thuần, không build**, phục vụ bởi FastAPI tại `/app/`. Giữ nguyên `static/js/api.js` (hợp đồng API không đổi).

```
FrontEnd/
  index.html                 # Khung trang tối giản, chỉ chứa các mount point
  static/
    css/
      tokens.css             # Mọi biến: màu (light/dark), font, spacing, z-index
      base.css               # Reset, typography, focus, utilities
      layout.css             # Top bar, board area, rail, mobile sheet
      components/
        card.css  rail.css  threads.css  controls.css  dialog.css  win.css  tutorial.css
      motion.css             # Mọi @keyframes + quy tắc reduced-motion
    js/
      main.js                # Khởi động, kết nối, điều phối
      api.js                 # (giữ nguyên)
      store.js               # State duy nhất + subscribe(); không còn biến global rời rạc
      i18n/vi.js
      ui/
        topbar.js  board.js  card.js  rail.js  threads.js  journal.js
        playback.js  feedback.js  win.js  tutorial.js  settings.js
      lib/
        motion.js            # flip(), shake(), pop(), FLIP helper, kiểm tra reduced-motion
        dom.js               # h() tạo phần tử, escape, delegate events
        sound.js
    fonts/                   # woff2 self-host
    avatars/
```

Nguyên tắc:

- **Một store, render theo diff:** `store.set(patch)` → các module `subscribe` và chỉ cập nhật phần tử của mình. Không dựng lại `innerHTML` toàn bộ. Thẻ được tạo một lần mỗi đề, sau đó chỉ đổi class hoặc thuộc tính.
- **Event delegation** trên lưới và rail, không gắn listener cho từng phần tử mỗi lần render.
- Hiệu ứng lật thẻ được kích hoạt bằng cách so sánh `is_criminal` cũ và mới trong store. Bất kỳ đường nào làm ô chuyển từ `null` sang có giá trị (người chơi, playback) đều có hiệu ứng như nhau.
- Avatar: chỉ dùng route `/app/avatars.json`. Xoá `DEFAULT_AVATARS` và file `FrontEnd/avatars.json` (hoặc sinh tự động bằng `tools/build_avatars.py` cho chế độ mở file tĩnh).
- Sửa test `tests/test_api_contract.py` khi đổi cấu trúc file (test đang import `FrontEnd/mock/state.js`). Thêm `encoding="utf-8"` cho `subprocess.run` để test chạy được trên Windows.
- Hỗ trợ: Chrome, Edge, Firefox, Safari bản mới (cần `:has()`, container queries, `<dialog>`). Không hỗ trợ IE.

---

## 13. Lộ trình theo PR

Mỗi PR chạy được độc lập và không làm hỏng hợp đồng API.

| PR | Nội dung | Tiêu chí nghiệm thu |
|---|---|---|
| **① Nền móng** | `tokens.css` (light/dark), self-host font, thang chữ, tách `app.js` thành `store` + các module `ui/*`, i18n tiếng Việt. Chưa đổi giao diện nhiều. | Toàn bộ test pass. Không còn mã hex ngoài `tokens.css`. Đổi theme hoạt động. |
| **② Bố cục mới** | Top bar 56px, bàn chơi tự co vừa màn hình, rail 2 tab luôn mở, case picker, bố cục tablet/mobile + bottom sheet + action bar. | Lưới 5×5 thấy trọn ở 1366×768 và 390×844, không cuộn ngang. |
| **③ Thẻ nghi phạm + Rail Hồ sơ** | Thẻ 2 mặt, đủ bảng trạng thái §7.3, rail clue đầy đủ (NEW, chip màu, clue đã khoá, ghim), sửa cấu trúc a11y. | Đọc được mọi clue mà không cần hover thẻ. axe không còn lỗi "nested-interactive". |
| **④ Hiệu ứng + Clue Threads** | `motion.js`, card-flip, stamp, shake, pop, phản hồi tại chỗ, threads SVG, toast xếp chồng, `<dialog>`. | Mọi hiệu ứng trong bảng §8 có mặt và tắt được bằng reduced-motion. |
| **⑤ Phần AI** | Hint 2 nấc dạng popover có lý do, chế độ AI + điều khiển phát lại (⏮⏯⏭⏩, tốc độ), journal mới (§7.9). | Journal chỉ hiện dữ liệu có thật. Phát lại tua được. Input bị khoá khi phát lại. |
| **⑥ Thắng, tutorial, hoàn thiện** | Màn thắng (sóng, tem, confetti, sao), đồng hồ, tutorial 2×2, màn Cách chơi, skeleton loading, chip offline, âm thanh tuỳ chọn, cài đặt. | Người chưa chơi bao giờ giải được 3×3 sau tutorial. Lighthouse Accessibility ≥ 95. |

---

## 14. Checklist nghiệm thu

**Chức năng**
- [ ] Chơi hết cả 6 đề bằng chuột, bằng bàn phím và trên điện thoại (DevTools 390×844).
- [ ] Hint 2 nấc, Auto solve phát lại đầy đủ, tua, đổi tốc độ, bỏ qua.
- [ ] Restart, chuyển đề, thắng → chơi lại hoặc đề tiếp theo.
- [ ] Mất kết nối giữa ván → chip offline, bấm thử lại được.
- [ ] Mở thẳng file `index.html` (không có server) → chế độ chỉ xem, không lỗi console.

**Thị giác**
- [ ] So sánh ảnh chụp light/dark ở 3 kích thước màn hình × 3 kích thước lưới.
- [ ] Không có chữ nhỏ hơn 12px, không có màu ngoài token.
- [ ] Không có layout shift khi mở hoặc đóng tab rail, khi thắng, khi hiện thông báo.

**Hiệu năng**
- [ ] Hiệu ứng giữ 60fps trên laptop phổ thông (DevTools Performance, CPU throttle 4×).
- [ ] Tổng dung lượng font ≤ 250KB. Không tải tài nguyên ngoài khi đã self-host.

**Accessibility**
- [ ] Toàn bộ checklist §10.
- [ ] Thử với NVDA (Windows): nghe được tên ô, trạng thái, kết quả phán quyết.

---

## 15. Trạng thái triển khai

Cập nhật 15/11/2026, nhánh `update_UI`. Cả 6 PR trong §13 đã được làm gộp trong một lần viết lại `FrontEnd/`.

### Đã làm

| Mục | Ghi chú |
|---|---|
| Token sáng/tối, font tự host, thang chữ ≥ 12px | `static/css/tokens.css`, `fonts.css`. Không còn mã hex ngoài `tokens.css` (trừ favicon và `theme-color` ban đầu trong `index.html`). |
| Tách `app.js` thành module | `main.js` (điều khiển), `store.js` (state + event bus), `prefs.js`, `i18n/vi.js`, `ui/*`, `lib/*`. |
| Bố cục mới | Top bar 56px, lưới tự co vừa màn hình (5×5 thấy trọn ở 1366×768), rail 2 tab luôn mở. Dưới 1100px trang chuyển sang dạng cuộn dọc, rail nằm dưới bàn chơi. |
| Thẻ nghi phạm | Một `<button>` mỗi ô trong `role="grid"`, 3 kiểu bố cục theo container query, đủ các trạng thái ở §7.3. |
| Rail Hồ sơ | Mọi clue đọc được cùng lúc, nhãn Mới, chip theo màu phán quyết, clue đã dùng hết tự mờ và tụt xuống cuối (FLIP), ghim, lọc. Clue nhắc tới ô đang xem được viền vàng. |
| Clue Threads | `ui/threads.js`, sợi chỉ SVG có độ võng, hiệu ứng kéo chỉ. |
| Phản hồi 3 tầng | Bong bóng trên thẻ, toast xếp chồng, `<dialog>` gốc. |
| Hiệu ứng | Lật thẻ, tem, rung, pop, spotlight trượt, sóng thắng, pháo giấy, skeleton. Tắt được bằng `prefers-reduced-motion` hoặc trong Cài đặt. |
| Phần AI | Hint 2 nấc kèm lý do, nhật ký chỉ hiện 2 query của ô được kết luận (phần còn lại trong "Chi tiết"), chế độ AI với tua lại / tạm dừng / từng bước / bỏ qua / 3 tốc độ. |
| Màn thắng | Overlay trên bàn chơi, tem, 1–3 sao, thời gian, đánh dấu đề đã giải trong trình chọn vụ án. |
| Khác | Trình chọn vụ án, đồng hồ, tutorial 2×2, màn Cách chơi, cài đặt, âm thanh WebAudio (tắt mặc định), chip ngoại tuyến. |
| Test | Sửa `tests/test_api_contract.py` (thêm `encoding="utf-8"`), toàn bộ 158 test pass. |

### Khác với kế hoạch

- **Mobile:** rail là một khối nằm dưới bàn chơi (cuộn theo trang), chưa phải bottom sheet kéo 3 nấc.
- **Lật thẻ:** dùng một mặt xoay tới 90° rồi đổi nội dung (giống bản tham khảo), không dựng hai mặt thật.
- **Playback:** không vẽ threads trong lúc AI phát lại, vì API chưa cho biết clue nào thực sự dẫn tới kết luận (xem đề xuất `explanation_clue_ids` ở §7.9).
- **Lọc clue:** công tắc "Ẩn manh mối đã dùng hết" mặc định tắt, không tự bật khi có hơn 6 clue.
- **Chơi lại:** chưa có hộp thoại xác nhận khi đang giữa ván.
- **i18n:** chữ sinh từ JS nằm trong `i18n/vi.js`; chữ tĩnh trong `index.html` vẫn viết trực tiếp bằng tiếng Việt.
- **Avatar:** vẫn giữ file `FrontEnd/avatars.json` (route `/app/avatars.json` của backend che nó khi chạy qua FastAPI); đã bỏ `DEFAULT_AVATARS` trong JS.

### Chỉnh sau khi chạy thử (theo phản hồi)

- **Lời khai in ngay trên thẻ.** Thẻ đã xác định và có lời khai chuyển sang dạng "ảnh nhỏ + tên ở trên, lời khai ở dưới". Dòng nào không vừa thì bị cắt gọn theo số dòng; rê chuột (hoặc chọn thẻ) sẽ hiện đầy đủ trong một khung nổi. Trên điện thoại thẻ quá nhỏ nên chỉ hiện biểu tượng, chạm vào thẻ để đọc. Mục 7.3 ("lời khai không hiện trên thẻ") không còn đúng. Tab Hồ sơ vẫn giữ làm danh sách tổng hợp và là nơi duy nhất hiện manh mối công khai.
- **Sợi chỉ chỉ hiện khi rê chuột** vào thẻ hoặc manh mối (hoặc khi ghim manh mối trong Hồ sơ). Thẻ đang được chọn không còn giữ sợi chỉ sau khi chuột rời đi. Trên màn hình cảm ứng (không có hover) thì thẻ đang chọn vẫn hiện sợi chỉ.
- **Nút "Tự chơi tiếp"** trên thanh phát lại AI: dừng AI ở bước hiện tại và trả bàn chơi cho người chơi. Vì backend đã giải xong toàn bộ, UI dựng lại trạng thái bằng cách gọi restart rồi gửi lại lần lượt các phán quyết của người chơi và các bước AI đã phát. Ván có AI giải giúp chỉ được tối đa 1 sao.

- **Tạm dừng (nút cạnh đồng hồ, phím `P`):** dừng đồng hồ, làm mờ và khoá bảng cùng Hồ sơ để không thể suy luận "miễn phí" trong lúc dừng. Bấm Tiếp tục, `P` hoặc `Esc` để quay lại. Không dùng được khi AI đang phát lại (đã có nút tạm dừng riêng) hoặc khi vụ án đã khép.

### Chưa kiểm chứng

- Chưa chạy axe / Lighthouse và chưa thử với NVDA. Độ tương phản mới chỉ được ước lượng khi chọn màu.
- Chưa đo fps bằng DevTools.
- Đã thử bằng Edge headless ở 390×844, 820×1100, 900×700, 1366×640, 1366×768, 1920×1080. Chưa thử trên Firefox, Safari hay thiết bị cảm ứng thật.
