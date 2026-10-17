import Chess from "../../Logicore/chess.js";
import ChessPuzzle from "./chessPuzzle.js";
import ChessPosition from "./chessPosition.js";

export default class ChessChallenge {
    // Type
    static PUZZLE = "puzzle";
    static POSITION = "position";
    
    constructor() {
        this.chess;
        this.pool = [];
        this.chessPuzzle = new ChessPuzzle();
        this.chessPosition = new ChessPosition();
        this.puzzleRating = 1000;
        this.positionRating = 1000;
        this.challenge;
    }

    async load() {
        await this.chessPuzzle.load();
        await this.chessPosition.load();
    }

    static randomPoolNumber(pool, n) {
        if (pool.length === 0) {
            pool = Array.from({length: n}, (_, i) => i);
        }

        const randIdx = Math.floor(Math.random() * pool.length);
        const value = pool.splice(randIdx, 1)[0];
        return [pool, value];
    }

    setupChallenge() {
        const [newPool, value] = ChessChallenge.randomPoolNumber(this.pool, 6);
        this.pool = newPool;

        const isPuzzle = value % 2 === 0;
        if (isPuzzle) {
            this.challenge = {
                type: ChessChallenge.PUZZLE,
                puzzle: this.chessPuzzle.getRandomPuzzle(this.puzzleRating),
            };
            this.chess = new Chess(this.challenge.puzzle.fen);
        } else {
            this.challenge = {
                type: ChessChallenge.POSITION,
                position: this.chessPosition.getRandomPosition(this.positionRating),
            };
            this.chess = new Chess();
            this.challenge.position.moves.forEach(entry => this.chess.makeMove(entry.move));
        }
    }

    evaluateMove(move) {
        return false;
    }
}
