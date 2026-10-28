export default class ChessPuzzle {
    constructor() {
        this.rating = 1000;
        this.puzzles = [];
    }

    async load() {
        const response = await fetch("assets/data/sampled_puzzles_25.csv");
        if (!response.ok) throw new Error(`Failed to load puzzles: ${response.status}`);
        const text = await response.text();
        
        const lines = text.trim().split(/\r?\n/);
        const headers = lines[0].split(",");

        for (const line of lines.slice(1)) {
            const values = line.split(",");

            const row = Object.fromEntries(
                headers.map((header, i) => [header, values[i]])
            );

            const puzzle = {
                id: row.PuzzleId,
                fen: row.FEN,
                moves: row.Moves.split(" "),
                rating: Number(row.Rating),
                ratingDeviation: Number(row.RatingDeviation),
                popularity: Number(row.Popularity),
                nbPlays: Number(row.NbPlays),
                themes: row.Themes.split(" "),
                gameUrl: row.GameUrl,
                openingTags: row.OpeningTags ? row.OpeningTags.split(" ") : [],
                dailyDate: row.DailyDate || null,
            };

            this.puzzles.push(puzzle);
        }

        this.puzzles = this.puzzles.sort((a, b) => a.rating - b.rating);
        console.log(`Loaded ${lines.slice(1).length} puzzles`);
    }

    lowerBound(rating) {
        let left = 0;
        let right = this.puzzles.length;

        while (left < right) {
            const mid = Math.floor((left + right) / 2);

            if (this.puzzles[mid].rating < rating) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        return left;
    }

    getRandomPuzzle(rating, range=100) {
        const minIndex = this.lowerBound(rating - range);
        const maxIndex = this.lowerBound(rating + range + 1);

        if (minIndex === maxIndex) return null;

        const index = minIndex + Math.floor(Math.random() * (maxIndex - minIndex));
        return this.puzzles[index];
    }

    evaluateMove(puzzle, moveIndex, moveUCI) {
        return puzzle.moves[moveIndex] === moveUCI;
    }
}
