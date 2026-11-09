// Public-only offline data, cùng shape với PublicStateResponse (BackEnd/APIs/schemas.py)
// và cùng nội dung với trạng thái ban đầu của make_demo_puzzle() (BackEnd/APIs/demo.py).
// Không đưa đáp án hoặc clue chưa mở vào FrontEnd.
export const initialPublicState = {
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
  revealed_clues: [{
    id: 1,
    source_cell_id: 0,
    description_nl: "Có đúng một tội phạm ở hàng 2. Dũng và Giang vô tội.",
    referenced_cell_ids: [3, 4, 5]
  }],
  is_complete: false
};
