class GameEngine:
    def __init__(self, board, state):
        self.board = board
        self.state = state

    def get_public_state(self):
        # Chỉ trả về clues và verdicts đã công khai
        raise NotImplementedError

    def submit_verdict(self, cell_id: int, status: bool):
        # Kiểm tra verdict có được chứng minh không
        raise NotImplementedError

    def restart(self):
        raise NotImplementedError
