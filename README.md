# Griductive Solver

Đồ án 2 môn Cơ sở Trí tuệ Nhân tạo (CSC14003), HCMUS. Game suy luận Griductive dạng "no-guess": người chơi chỉ được đưa ra phán quyết Innocent / Criminal khi các manh mối công khai buộc kết luận đó. Backend kiểm tra từng phán quyết và có solver tự giải từng bước.

- `BackEnd/GameEngine/`: luật chơi, trạng thái ván, bộ kiểm tra ràng buộc.
- `BackEnd/APIs/`: FastAPI, phục vụ cả API (`/api/...`) lẫn giao diện (`/app/`).
- `FrontEnd/`: giao diện HTML/CSS/JS thuần, không cần build. Hợp đồng API xem tại [FrontEnd/API_CONTRACT.md](FrontEnd/API_CONTRACT.md).
- `tests/`: test cho GameEngine (pytest).

## Cách chạy

Cần Python 3.10 trở lên. Mọi lệnh đều chạy từ **thư mục gốc của repo**.

### 1. Tạo môi trường ảo (làm một lần)

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirement.txt
```

Windows (PowerShell):

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirement.txt
```

Nếu PowerShell chặn script khi kích hoạt venv, chạy `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` một lần rồi thử lại.

Những lần sau chỉ cần kích hoạt lại venv (`source .venv/bin/activate` hoặc `.venv\Scripts\Activate.ps1`). Thư mục `.venv/` đã có trong `.gitignore`.

### 2. Chạy server

```bash
python -m uvicorn BackEnd.APIs.main:app --reload
```

- Giao diện chơi: http://127.0.0.1:8000/app/ (góc trên bên phải phải hiện **LIVE API**)
- Tài liệu API (Swagger): http://127.0.0.1:8000/docs

Tắt server bằng `Ctrl + C`. Nếu trình duyệt vẫn hiện giao diện cũ sau khi pull code mới, tải lại trang mà không dùng cache: `Cmd + Shift + R` (macOS) hoặc `Ctrl + Shift + R` (Windows/Linux).

### 3. Chạy test

pytest chưa có trong `requirement.txt`, nên cài riêng trong venv:

```bash
python -m pip install pytest
python -m pytest
```

## Lỗi thường gặp

**`[Errno 48] Address already in use`** (macOS) **/ `[Errno 98]`** (Linux) **/ `[WinError 10048]`** (Windows)

Cổng 8000 đang bị chiếm, thường là do một server uvicorn cũ vẫn chạy ở cửa sổ terminal khác. Bạn có hai cách:

- Tắt server cũ. Trên macOS / Linux: xem tiến trình bằng `lsof -i :8000`, nếu đó là Python thì tắt bằng `kill $(lsof -ti :8000)`. Trên Windows: `netstat -ano | findstr :8000` để lấy PID, rồi `taskkill /PID <PID> /F`.
- Hoặc chạy ở cổng khác: `python -m uvicorn BackEnd.APIs.main:app --reload --port 8001`, rồi mở http://127.0.0.1:8001/app/.

**Giao diện hiện dải vàng "Backend unreachable" / nhãn OFFLINE · MOCK**

Trang được mở mà server không chạy (ví dụ mở thẳng `FrontEnd/index.html`). UI sẽ dùng dữ liệu mẫu, chỉ xem được. Hãy chạy server như bước 2, mở đúng địa chỉ `/app/`, rồi bấm **Retry connection**.

**`ModuleNotFoundError: No module named 'BackEnd'`**

Lệnh không được chạy từ thư mục gốc của repo. Hãy `cd` về thư mục chứa `BackEnd/` và `FrontEnd/` rồi chạy lại.

**`ModuleNotFoundError: No module named 'fastapi'`**

Venv chưa được kích hoạt, hoặc chưa cài thư viện. Kích hoạt venv rồi chạy lại `python -m pip install -r requirement.txt`.
