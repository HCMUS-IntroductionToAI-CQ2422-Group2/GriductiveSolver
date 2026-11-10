// Public-only offline data, cùng shape với PublicStateResponse (BackEnd/APIs/schemas.py)
// Không đưa đáp án hoặc clue chưa mở vào FrontEnd.

export const demo3x3State = {
  puzzle_id: "demo-3x3",
  height: 3,
  width: 3,
  cells: [
    { id: 0, row: 0, column: 0, character_name: "An", profession: "Thợ mộc", is_criminal: false },
    { id: 1, row: 0, column: 1, character_name: "Bình", profession: "Bác sĩ", is_criminal: null },
    { id: 2, row: 0, column: 2, character_name: "Chi", profession: "Đầu bếp", is_criminal: null },
    { id: 3, row: 1, column: 0, character_name: "Dũng", profession: "Tài xế", is_criminal: null },
    { id: 4, row: 1, column: 1, character_name: "Giang", profession: "Giáo viên", is_criminal: null },
    { id: 5, row: 1, column: 2, character_name: "Hà", profession: "Thợ may", is_criminal: null },
    { id: 6, row: 2, column: 0, character_name: "Lan", profession: "Họa sĩ", is_criminal: null },
    { id: 7, row: 2, column: 1, character_name: "Minh", profession: "Kỹ sư", is_criminal: null },
    { id: 8, row: 2, column: 2, character_name: "Nam", profession: "Nhạc sĩ", is_criminal: null }
  ],
  revealed_clues: [
    {
      id: 1,
      source_cell_id: 0,
      description_nl: "Có đúng một tội phạm ở hàng 2. Dũng và Giang vô tội.",
      referenced_cell_ids: [3, 4, 5]
    }
  ],
  is_complete: false
};

export const demo4x4State = {
  puzzle_id: "case-4x4-harbor",
  height: 4,
  width: 4,
  cells: [
    { id: 0, row: 0, column: 0, character_name: "An", profession: "Thợ mộc", is_criminal: false },
    { id: 1, row: 0, column: 1, character_name: "Bình", profession: "Bác sĩ", is_criminal: null },
    { id: 2, row: 0, column: 2, character_name: "Chi", profession: "Đầu bếp", is_criminal: null },
    { id: 3, row: 0, column: 3, character_name: "Dũng", profession: "Tài xế", is_criminal: null },
    { id: 4, row: 1, column: 0, character_name: "Giang", profession: "Giáo viên", is_criminal: null },
    { id: 5, row: 1, column: 1, character_name: "Hà", profession: "Thợ may", is_criminal: null },
    { id: 6, row: 1, column: 2, character_name: "Hùng", profession: "Cảnh sát", is_criminal: null },
    { id: 7, row: 1, column: 3, character_name: "Khoa", profession: "Luật sư", is_criminal: null },
    { id: 8, row: 2, column: 0, character_name: "Lan", profession: "Họa sĩ", is_criminal: null },
    { id: 9, row: 2, column: 1, character_name: "Long", profession: "Thủy thủ", is_criminal: null },
    { id: 10, row: 2, column: 2, character_name: "Mai", profession: "Kế toán", is_criminal: null },
    { id: 11, row: 2, column: 3, character_name: "Minh", profession: "Kỹ sư", is_criminal: null },
    { id: 12, row: 3, column: 0, character_name: "Nam", profession: "Nhạc sĩ", is_criminal: null },
    { id: 13, row: 3, column: 1, character_name: "Ngọc", profession: "Y tá", is_criminal: null },
    { id: 14, row: 3, column: 2, character_name: "Oanh", profession: "Dược sĩ", is_criminal: null },
    { id: 15, row: 3, column: 3, character_name: "Phúc", profession: "Thủ thư", is_criminal: null }
  ],
  revealed_clues: [
    {
      id: 1,
      source_cell_id: 0,
      description_nl: "Có đúng hai tội phạm ở cột A và cột B. Long và Mai ở giữa khu vực cảng không phải đồng phạm.",
      referenced_cell_ids: [0, 4, 8, 12, 1, 5, 9, 13]
    },
    {
      id: 2,
      source_cell_id: null,
      description_nl: "Số lượng tội phạm ở hàng 1 và hàng 4 bằng nhau.",
      referenced_cell_ids: [0, 1, 2, 3, 12, 13, 14, 15]
    }
  ],
  is_complete: false
};

export const demo5x5State = {
  puzzle_id: "case-5x5-syndicate",
  height: 5,
  width: 5,
  cells: [
    { id: 0, row: 0, column: 0, character_name: "An", profession: "Thợ mộc", is_criminal: false },
    { id: 1, row: 0, column: 1, character_name: "Bình", profession: "Bác sĩ", is_criminal: null },
    { id: 2, row: 0, column: 2, character_name: "Chi", profession: "Đầu bếp", is_criminal: null },
    { id: 3, row: 0, column: 3, character_name: "Dũng", profession: "Tài xế", is_criminal: null },
    { id: 4, row: 0, column: 4, character_name: "Giang", profession: "Giáo viên", is_criminal: null },
    { id: 5, row: 1, column: 0, character_name: "Hà", profession: "Thợ may", is_criminal: null },
    { id: 6, row: 1, column: 1, character_name: "Hùng", profession: "Cảnh sát", is_criminal: null },
    { id: 7, row: 1, column: 2, character_name: "Khoa", profession: "Luật sư", is_criminal: null },
    { id: 8, row: 1, column: 3, character_name: "Lan", profession: "Họa sĩ", is_criminal: null },
    { id: 9, row: 1, column: 4, character_name: "Long", profession: "Thủy thủ", is_criminal: null },
    { id: 10, row: 2, column: 0, character_name: "Mai", profession: "Kế toán", is_criminal: null },
    { id: 11, row: 2, column: 1, character_name: "Minh", profession: "Kỹ sư", is_criminal: null },
    { id: 12, row: 2, column: 2, character_name: "Nam", profession: "Nhạc sĩ", is_criminal: null },
    { id: 13, row: 2, column: 3, character_name: "Ngọc", profession: "Y tá", is_criminal: null },
    { id: 14, row: 2, column: 4, character_name: "Oanh", profession: "Dược sĩ", is_criminal: null },
    { id: 15, row: 3, column: 0, character_name: "Phúc", profession: "Thủ thư", is_criminal: null },
    { id: 16, row: 3, column: 1, character_name: "Quân", profession: "Kiến trúc sư", is_criminal: null },
    { id: 17, row: 3, column: 2, character_name: "Sơn", profession: "Nhà báo", is_criminal: null },
    { id: 18, row: 3, column: 3, character_name: "Tâm", profession: "Nhiếp ảnh gia", is_criminal: null },
    { id: 19, row: 3, column: 4, character_name: "Thảo", profession: "Biên tập viên", is_criminal: null },
    { id: 20, row: 4, column: 0, character_name: "Trang", profession: "Nhà văn", is_criminal: null },
    { id: 21, row: 4, column: 1, character_name: "Tuấn", profession: "Lập trình viên", is_criminal: null },
    { id: 22, row: 4, column: 2, character_name: "Uyên", profession: "Thám tử tư", is_criminal: null },
    { id: 23, row: 4, column: 3, character_name: "Vy", profession: "Nhà hóa học", is_criminal: null },
    { id: 24, row: 4, column: 4, character_name: "Yến", profession: "Nhà khảo cổ", is_criminal: null }
  ],
  revealed_clues: [
    {
      id: 1,
      source_cell_id: 0,
      description_nl: "Vụ án mạng tại biệt thự Syndicate: Trong số 5 người ở hàng trung tâm (Mai, Minh, Nam, Ngọc, Oanh), có đúng 2 kẻ chủ mưu tiếp tay cho băng đảng tội phạm ngầm.",
      referenced_cell_ids: [10, 11, 12, 13, 14]
    },
    {
      id: 2,
      source_cell_id: null,
      description_nl: "Bốn góc bàn cờ (An [A1], Giang [E1], Trang [A5], Yến [E5]) đều có chứng cứ ngoại phạm xác thực trong đêm xảy ra vụ án.",
      referenced_cell_ids: [0, 4, 20, 24]
    }
  ],
  is_complete: false
};

export const initialPublicState = demo3x3State;
