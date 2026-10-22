import Chess from "../../Logicore/chess.js";

export default class ChessPosition {
    constructor() {
        this.games = [];
    }

    parsePGN(pgn) {
        const headers = {};

        // Parse headers: [Event "Rated Blitz game"], [Date "2026.09.01"], etc.
        for (const match of pgn.matchAll(/^\[(\w+)\s+"((?:\\.|[^"\\])*)"\]\s*$/gm)) {
            headers[match[1]] = match[2];
        }

        // Extract moves section: 1. d4 { [%eval 0.15] [%clk 0:03:00] } 1... c6 { [%eval 0.33] [%clk 0...
        const moveText = pgn.replace(/^\[.*\]\s*$/gm, "").trim();

        // tokenize the moves, including both colors into a list: [ "1.", "e4", "{ [%clk 0:01:00] }", "1...", "e6", ...]
        const tokens = moveText.match(/\d+\.(?:\.\.)?|\{[^}]*\}|[^\s{}]+/g) || [];

        let turn = 0;
        let color = "white";

        const moves = [];
        for (const token of tokens) {
            // token: 1.
            if (/^\d+\.$/.test(token)) {
                turn = parseInt(token);
                color = "white";
                continue;
            }

            // token: 1...
            if (/^\d+\.\.\.$/.test(token)) {
                turn = parseInt(token);
                color = "black";
                continue;
            }

            // parses { [%eval 0.15] [%clk 0:03:00] }
            if (token.startsWith("{")) {
                // split and parse to seconds: [%clk 0:03:00]
                const clock = token.match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/);

                if (clock && moves.length) {
                    moves[moves.length - 1].time =
                        Number(clock[1]) * 3600 +
                        Number(clock[2]) * 60 +
                        Number(clock[3]);
                }

                // split and parse evaluations: [%eval 0.15]
                const evaluation = token.match(/\[%eval\s+([#-]?\d+(?:\.\d+)?)\]/);

                if (evaluation && moves.length) {
                    const value = evaluation[1];
                    moves[moves.length - 1].eval = value.startsWith("#") ? value : Number(value);
                }

                continue;
            }

            if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue; // skip game result like 1-0 white wins

            if (/^\$\d+$/.test(token)) continue; // skip chess NAG like $1 = Good Move

            moves.push({
                turn,
                color,
                move: token,
                time: null,
                eval: null,
            });

            color = color === "white" ? "black" : "white";
        }

        return {
            event: headers.Event ?? null,
            date: headers.Date ?? null,
            white: headers.White ?? null,
            black: headers.Black ?? null,
            result: headers.Result ?? null,
            utcDate: headers.UTCDate ?? null,
            utcTime: headers.UTCTime ?? null,
            whiteElo: Number(headers.WhiteElo) || null,
            blackElo: Number(headers.BlackElo) || null,
            whiteRatingDiff: headers.WhiteRatingDiff != null
                ? Number(headers.WhiteRatingDiff)
                : null,
            blackRatingDiff: headers.BlackRatingDiff != null
                ? Number(headers.BlackRatingDiff)
                : null,
            eco: headers.ECO ?? null,
            opening: headers.Opening ?? null,
            timeControl: headers.TimeControl ?? null,
            termination: headers.Termination ?? null,
            moves
        };
    }

    async load() {
        const response = await fetch("assets/data/sampled_games_25.pgn");
        if (!response.ok)throw new Error(`Failed to load PGN: ${response.status}`);
        const text = await response.text();

        const games = text
            .split(/(?=\[Event\s+")/)
            .filter(game => game.trim());
        
        for (const pgn of games) {
            const game = this.parsePGN(pgn);

            if (game.whiteElo === null || game.blackElo === null) continue;
            game.rating = Math.floor((game.whiteElo + game.blackElo) / 2)
            this.games.push(game);
        }

        this.games = this.games.sort((a, b) => a.rating - b.rating);
        console.log(`Loaded ${games.length} games`);
    }

    lowerBound(rating) {
        let left = 0;
        let right = this.games.length;

        while (left < right) {
            const mid = Math.floor((left + right) / 2);

            if (this.games[mid].rating < rating) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        return left;
    }

    getRandomMoveIndex(game) {
        const total = game.moves.length;

        // At least 2 full moves played, 1 full move remaining
        const min = 4;
        const max = total - 2;

        if (max < min) return Math.ceil(game.moves.length / 2);

        return min + Math.floor(Math.random() * (max - min + 1));
    }

    getRandomPosition(rating, range=100) {
        const minIndex = this.lowerBound(rating - range);
        const maxIndex = this.lowerBound(rating + range + 1);

        if (minIndex === maxIndex) return null;

        const index = 61; // minIndex + Math.floor(Math.random() * (maxIndex - minIndex));
        const position = structuredClone(this.games[index]);
        const moveIndex = 11; // this.getRandomMoveIndex(position);
        console.log(index, moveIndex);
        position.moves = position.moves.slice(0, moveIndex);
        return position;
    }

    async evaluateMove(chessAnalysis, fen, move) {
        const chess = new Chess(fen);
        chess.makeMove(move);
        return chessAnalysis.requestAnalysis(chess.getFen());
    }
}
