import Chess from "../../Logicore/chess.js";
import ChessPuzzle from "./chessPuzzle.js";
import ChessPosition from "./chessPosition.js";
import ChessAnalysis from "./chessAnalysis.js";
import { DEFAULT_FEN } from "../Logicore/chess_constants.js";

export default class ChessChallenge {
    // Type
    static PUZZLE = "puzzle";
    static POSITION = "position";
    
    constructor() {
        this.chess;
        this.pool = [];
        this.chessPuzzle = new ChessPuzzle();
        this.chessPosition = new ChessPosition();
        this.chessAnalysis = new ChessAnalysis();
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

    getRandomNumber5(minElo = 0, maxElo = 3000) {
        const t = Math.max(0, Math.min(1, (this.positionRating - minElo) / (maxElo - minElo)));

        // Weights for numbers 1-6
        const lowElo  = [86, 8, 3, 2, 1];
        const highElo = [28, 40, 28, 2.5, 1.5];

        const weights = lowElo.map((w, i) =>
            w + (highElo[i] - w) * t
        );

        let roll = Math.random() * 100;

        for (let i = 0; i < weights.length; i++) {
            roll -= weights[i];
            if (roll < 0) return i + 1;
        }

        return 1;
    }

    async nextChallenge() {
        const [newPool, value] = ChessChallenge.randomPoolNumber(this.pool, 6);
        this.pool = newPool;

        const isPuzzle = false; // value % 2 === 0;
        if (isPuzzle) {
            this.challenge = {
                type: ChessChallenge.PUZZLE,
                puzzle: this.chessPuzzle.getRandomPuzzle(this.puzzleRating),
                moveIndex: 1,
            };
            this.chess = new Chess(this.challenge.puzzle.fen);
            this.chess.makeMove(this.challenge.puzzle.moves[0]);
        } else {
            this.challenge = {
                type: ChessChallenge.POSITION,
                position: this.chessPosition.getRandomPosition(this.positionRating),
                maxMoves: this.getRandomNumber5(),
                moveIndex: 1,
                // currentScore,
                // bestMove,
            };

            this.chess = new Chess();
            this.challenge.position.moves.forEach(entry => this.chess.makeMove(entry.move));

            const analysis = await this.chessAnalysis.requestAnalysis(this.chess.getFen());
            console.log(analysis);
        }
    }

    async evaluateMove(move) {
        let evaluation = {
            isCorrect: false,
            isSolved: false,
            nextMove: null,
        };
        
        if (this.challenge.type === ChessChallenge.PUZZLE) {
            const moveUCI = this.chess.parseToUCINotation(move);
            evaluation.isCorrect = this.chessPuzzle.evaluateMove(this.challenge.puzzle, this.challenge.moveIndex, moveUCI);
            if (evaluation.isCorrect) {
                this.challenge.moveIndex++;
                if(this.challenge.moveIndex < this.challenge.puzzle.moves.length) {
                    evaluation.nextMove = this.chess.parseChessMove(this.challenge.puzzle.moves[this.challenge.moveIndex]);
                    this.chess.makeMove(evaluation.nextMove);
                    this.challenge.moveIndex++;

                } else evaluation.isSolved = true;
            }
        } else if (this.challenge.type === ChessChallenge.POSITION) {
            const moveScore = this.chessPosition.evaluateMove(this.challenge.chess.getFen(), move);
            evaluation.isCorrect = false;
            evaluation.nextMove = null;
            evaluation.moveEval = "bad";

            if (evaluation.isCorrect) {
                this.challenge.moveIndex++;
                if (this.challenge.moveIndex > this.challenge.maxMoves) {
                    evaluation.isSolved = true;
                    return evaluation;
                }
            }
        }
        return evaluation;
    }
}
