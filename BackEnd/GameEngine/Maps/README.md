# Playable maps

Six original maps using the engine's `PuzzleDefinition` and native constraints.
Clues are in Vietnamese. Cell IDs are row-major, starting at zero; player
coordinates use column letters and one-based rows, such as A1 or E5.

| Map ID | Size | Difficulty | Starting character | Clues | Deduction waves |
| --- | --- | --- | --- | ---: | ---: |
| `medium-3x3-market` | 3×3 | Medium | An (A1) | 5 | 3 |
| `medium-3x3-gallery` | 3×3 | Medium | Bình (B1) | 5 | 4 |
| `medium-4x4-harbor` | 4×4 | Medium | An (A1) | 7 | 4 |
| `medium-4x4-theatre` | 4×4 | Medium | Dũng (D1) | 8 | 6 |
| `medium-5x5-museum` | 5×5 | Medium | Long (E2) | 16 | 5 |
| `expert-5x5-observatory` | 5×5 | Expert / siêu khó | Lan (D2) | 9 | 8 |

A wave contains all verdicts forced by the information available at its start;
new testimony is used in the following wave. These are author-assigned
difficulty levels based on inference structure, not measured player ratings.

## Design

- All maps begin with exactly one character already proved innocent. Only that
  character's single clue is visible; there are no public, source-less clues.
- Proving a character reveals their testimony, whether innocent or criminal.
- The declared solution satisfies every clue and is unique. Every verdict can
  be proved from the public information available during play, without guessing.
- The museum starts with Long naming three innocents. Their clues combine
  with Long's known innocence to open row 2, then constrain successive rows.
- The observatory starts with only C1 newly provable. Consecutive runs, parity
  and count comparisons create successive gates through C2, C3/C4 and C5.
- The theatre names exactly two criminals in B2, C2 and B3 who share an edge.
  Only B2 belongs to both possible pairs, so its testimony unlocks the arms.

The starting-card and reveal loop follows the
[Griductive rules](https://knotwise.games/games/griductive/how-to-play).
The maps and their testimony are original; the existing engine already supports
the loop through `initial_verdicts` and `Clue.source_cell_id`.

### Observatory opening walkthrough (spoilers)

1. Lan (D2) is already innocent. Her clue says exactly three criminals occupy
   consecutive cells in row 1. The possibilities are A1–C1, B1–D1 and C1–E1;
   all contain C1, so Chi (C1) must be criminal.
2. Chi's clue says B1 and D1 differ, eliminating B1–D1. In either remaining
   run, exactly one of A1/E1 is criminal. Since A2 matches A1 and B2 matches E1,
   exactly one of A2/B2 is criminal. The count of one across A2/B2/C2 therefore
   proves Khoa (C2) innocent.
3. Khoa says A2 and D2 match. Lan's known innocence proves A2 innocent, selecting
   the C1–E1 run. Khoa's remaining counts resolve row 2; E1's clue opens row 3.
4. Later testimony narrows the case through C3 and C4. On row 5, the counts in
   A5/B5 and D5/E5 match, so their combined count is even. Row 5 has three
   criminals, forcing C5 criminal and revealing the final clue.

Solutions stay in these backend modules and are not included in public API
responses. Hidden clues are absent from the public state until unlocked.

## Loading

`PUZZLES` in `__init__.py` is the catalog, ordered as listed above. The API
registers all six maps and starts with `medium-3x3-market`. `GET /api/puzzles`
returns that order, which the existing **New case** button follows.

If the backend is running without auto-reload, restart it to load the catalog.
The frontend's read-only offline demo remains a separate fallback.

## Verification

`tests/test_maps.py` checks the requested map distribution, unique solutions,
one starting character and one visible clue, hidden-clue privacy, and the
expert's first two deduction gates. Every map is also played to completion
through repeated API hint/verdict calls using only public state, then checked
with restart and auto-solve. The starter is excluded from the solve trace.

Run from the repository root in the selected project environment, or `DL_Env`
when no project environment exists:

```sh
PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
  /home/nhminh/miniconda3/envs/DL_Env/bin/python -m pytest -q -s \
  -p no:cacheprovider tests/test_maps.py tests/test_integration.py tests/test_validation.py
```

The focused verification run passed 50 tests. The API tests use an isolated
in-process app and do not modify the game in a separately running server.
