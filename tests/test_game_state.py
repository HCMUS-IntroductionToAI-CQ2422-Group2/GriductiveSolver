from BackEnd.GameEngine.GameState import GameState
from tests.helpers import make_board, make_public_state


def test_is_complete_false_when_one_cell_missing():
    board = make_board(2, 2)
    state = make_public_state(board, proved={0: True, 1: False, 2: True})
    assert state.is_complete is False


def test_is_complete_true_when_all_cells_proved():
    board = make_board(2, 2)
    state = make_public_state(board, proved={0: True, 1: False, 2: True, 3: False})
    assert state.is_complete is True


def test_is_complete_false_when_nothing_proved():
    board = make_board(2, 3)
    assert make_public_state(board, proved={}).is_complete is False


def test_game_state_defaults_are_independent():
    a, b = GameState(), GameState()
    a.revealed_clue_ids.add(1)
    a.proved_statuses[0] = True
    assert b.revealed_clue_ids == set()
    assert b.proved_statuses == {}
