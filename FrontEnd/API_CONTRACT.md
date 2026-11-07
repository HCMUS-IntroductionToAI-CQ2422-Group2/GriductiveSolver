# Frontend/API contract status

The backend API contract has not been agreed yet. The frontend currently uses only `mock/state.js`; it does not assume JSON field names or call guessed endpoints.

Before switching `static/js/api.js` to HTTP, coordinate with the API owner and record the agreed request and response shapes here for:

- Loading a puzzle's public state (board dimensions, cells, public clues, proved statuses).
- Submitting a verdict and distinguishing `ACCEPTED`, `NOT_PROVABLE`, and `CONTRADICTED`.
- Restarting the puzzle.
- Hint and Auto Solve availability/results.

The browser must receive public knowledge only. Never include a solution or unrevealed clues in API responses or frontend data.
