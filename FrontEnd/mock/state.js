// Public-only demo data. Keep hidden solutions and unrevealed clues out of FrontEnd.
export const initialPublicState = {
  puzzleId: "riverside-demo",
  height: 3,
  width: 3,
  cells: [
    { id: 0, row: 0, column: 0, name: "Abel", profession: "Architect" },
    { id: 1, row: 0, column: 1, name: "Bea", profession: "Botanist" },
    { id: 2, row: 0, column: 2, name: "Clara", profession: "Chef" },
    { id: 3, row: 1, column: 0, name: "Derek", profession: "Dentist" },
    { id: 4, row: 1, column: 1, name: "Eliza", profession: "Editor" },
    { id: 5, row: 1, column: 2, name: "Franz", profession: "Florist" },
    { id: 6, row: 2, column: 0, name: "Grant", profession: "Gardener" },
    { id: 7, row: 2, column: 1, name: "Hannah", profession: "Historian" },
    { id: 8, row: 2, column: 2, name: "Ivy", profession: "Illustrator" }
  ],
  // Public starter example: Abel's status and the row clue are already visible.
  provedStatuses: { 0: "CRIMINAL" },
  revealedClues: [{
    id: 1,
    sourceCellId: 0,
    description: "Exactly two characters in Row 1 are criminals.",
    targetCellIds: [0, 1, 2]
  }],
  demo: true
};

