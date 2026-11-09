# Avatar assets

25 SVG portraits in the Open Peeps style (Pablo Stanley, CC0 1.0), one per character.

## How the UI finds a portrait

`showAvatar()` in `static/js/app.js` turns `character_name` into a file name: it strips accents, lowercases, turns `đ` into `d` and joins words with `-`. Examples: `Bình` → `binh.svg`, `Thành Bảo` → `thanh-bao.svg`. The backend (`GET /app/avatars.json`) lists every `*.svg` in this folder, so you only need to drop the file here and refresh. If no file matches, the card keeps the initials avatar.

Current names: An, Bình, Chi, Dũng, Giang, Hà, Lan, Minh, Nam (the 9 used in `demo.py`), plus Hùng, Khoa, Long, Mai, Ngọc, Oanh, Phúc, Quân, Sơn, Tâm, Thảo, Trang, Tuấn, Uyên, Vy, Yến for a 5 × 5 board. **Puzzle files must use these exact names** (or regenerate, see below).

## Regenerating / adding names

`FrontEnd/tools/build_avatars.py` builds the portraits from the Open Peeps data file `open-peeps.json` (from https://github.com/dicebear/styles, `src/open-peeps.json`). The same name always gives the same portrait.

1. Edit the `NAMES` list in the script.
2. Run:

   ```bash
   python3 FrontEnd/tools/build_avatars.py path/to/open-peeps.json FrontEnd/static/avatars
   ```

Design choices in the script: a 4:5 crop (fits the 46 × 57 `.portrait` slot), soft backgrounds taken from `app.css`, calm expressions only, no masks or facial hair, and the `hijab` / `bear` head variants are excluded because they render incorrectly with this data.

No solution or unrevealed clue data is stored here.
