from BackEnd.GameEngine.GameObject.objects import Board, Cell


CHARACTERS = (
    ("An", "Thợ mộc"), ("Bình", "Bác sĩ"), ("Chi", "Đầu bếp"),
    ("Dũng", "Tài xế"), ("Giang", "Giáo viên"), ("Hà", "Thợ may"),
    ("Hùng", "Bảo vệ"), ("Khoa", "Thám tử"), ("Lan", "Họa sĩ"),
    ("Long", "Thủy thủ"), ("Mai", "Kế toán"), ("Minh", "Kỹ sư"),
    ("Nam", "Nhạc sĩ"), ("Ngọc", "Y tá"), ("Oanh", "Dược sĩ"),
    ("Phúc", "Thủ thư"), ("Quân", "Kiến trúc sư"), ("Sơn", "Thợ điện"),
    ("Tâm", "Nhiếp ảnh gia"), ("Thảo", "Nhà báo"), ("Trang", "Luật sư"),
    ("Tuấn", "Lập trình viên"), ("Uyên", "Nhà nghiên cứu"),
    ("Vy", "Ca sĩ"), ("Yến", "Nhà khảo cổ"),
)


def make_board(size: int) -> Board:
    cells = tuple(
        Cell(cell_id, divmod(cell_id, size), name, profession)
        for cell_id, (name, profession) in enumerate(CHARACTERS[:size * size])
    )
    return Board(tuple(cells[row * size:(row + 1) * size] for row in range(size)))
